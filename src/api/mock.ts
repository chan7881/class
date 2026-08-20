import { generateEditToken, generateLessonCode } from '../lib/code'
import { findQuestionInLesson } from '../lib/findQuestion'
import { gradeQuestion, type GradeResult } from '../lib/grade'
import { identitySignature } from '../lib/identity'
import { sha256Hex } from '../lib/hash'
import { migrateLesson } from '../lib/migrate'
import { stripAnswers } from '../lib/stripAnswers'
import { validateViewPassword } from '../lib/viewPassword'
import type { Lesson } from '../types/lesson'
import { createDefaultStore, type KeyValueStore } from './storage'
import type {
  AggregateResult,
  ApiClient,
  CreateLessonInput,
  CreateLessonResult,
  Identity,
  LessonSummary,
  LiveSnapshot,
  ResponseRecord,
  UploadResult,
} from './types'

/**
 * localStorage(또는 메모리) 기반 목 백엔드. docs/PLAN.md 「Apps Script API」 표와 같은
 * 액션을 구현해, 6단계에서 실제 Apps Script로 바꿔도 호출부가 안 바뀌게 한다.
 *
 * 실제 백엔드와 다르게 단순화한 지점(전부 6단계 이후에 다시 볼 것):
 *  - editToken은 여기서도 해시로만 저장하지만, 애초에 서버·클라이언트 경계가 없는 브라우저
 *    안이라 "탈취"라는 개념 자체가 성립하지 않는다. 실제 보안 경계는 6단계 Apps Script부터.
 *  - uploadMedia/uploadStudentMedia는 Drive 대신 `URL.createObjectURL`을 반환한다.
 *    새로고침하면 그 URL은 무효가 된다 — 진짜 영속 업로드는 6단계에서.
 *  - saveProgress/submitResponse/gradeAnswer는 미발행 수업에서도 동작한다(테스트 모드
 *    지원을 위해). `record.isTest`는 `resolveIsTest`로 editToken과 대조해 검증한다
 *    (11단계, docs/DECISIONS.md 참고) — editToken이 없거나 틀리면 조용히 false로 낮춘다.
 */

const PREFIX = 'class:'
const lessonKey = (code: string) => `${PREFIX}lesson:${code}`
const editTokenHashKey = (code: string) => `${PREFIX}editTokenHash:${code}`
const responseKey = (code: string, studentKey: string, isTest: boolean) =>
  `${PREFIX}responses:${code}:${isTest ? 'test' : 'main'}:${studentKey}`
const responsePrefix = (code: string, isTest: boolean) => `${PREFIX}responses:${code}:${isTest ? 'test' : 'main'}:`
const slugKey = (code: string) => `${PREFIX}slug:${code}`
/**
 * 실시간 모니터링용 "마지막 활동 시각" 맵. 실서버(Code.gs)에서는 이게 **CacheService**이고
 * 여기서는 같은 저장소를 쓴다 — 어느 쪽이든 **응답 시트와 분리된 임시 데이터**라는 성질은 같다.
 * 없어져도 진행 정보(슬라이드·문항 수)는 응답에서 그대로 나오므로 화면은 계속 쓸 수 있다.
 */
const lastSeenKey = (code: string) => `${PREFIX}lastSeen:${code}`
/** 현황 암호는 **해시만** 둔다(편집 키와 같은 방침). 원문은 서버 어디에도 남기지 않는다. */
const viewPasswordKey = (code: string) => `${PREFIX}viewPasswordHash:${code}`
/** 시도 횟수 — 사람이 정하는 암호는 짐작당하기 쉬워서 서버가 대입 속도를 직접 눌러야 한다. */
const viewFailKey = (code: string) => `${PREFIX}viewFails:${code}`
export const VIEW_FAIL_LIMIT = 10
export const VIEW_FAIL_WINDOW_MS = 10 * 60 * 1000
const SLUG_PREFIX = `${PREFIX}slug:`

/** apps-script/Code.gs의 SLUG_PATTERN과 같은 규칙 — 한쪽만 고치면 로컬과 실서버가 어긋난다 */
const SLUG_PATTERN = /^[0-9A-Za-z가-힣][0-9A-Za-z가-힣_-]{1,19}$/

export class ApiError extends Error {}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * POE 예측처럼 lockAfterSubmit로 한 번 잠근 문항은, 클라이언트가 무엇을 보내든 서버가
 * 이전에 저장해둔 답 값을 그대로 유지한다(재수정 거부 — docs/PLAN.md 9번 항목). 잠금 목록
 * 자체도 합집합으로 유지해 클라이언트가 목록에서 빼서 잠금을 우회할 수 없게 한다.
 */
function enforceLocks<T extends { answers: Record<string, unknown>; lockedQuestionIds?: string[] }>(
  previous: (T & { answers: Record<string, unknown>; lockedQuestionIds?: string[] }) | null,
  incoming: T,
): T {
  if (!previous?.lockedQuestionIds?.length) return incoming
  const answers = { ...incoming.answers }
  for (const id of previous.lockedQuestionIds) {
    if (id in previous.answers) answers[id] = previous.answers[id]
  }
  const lockedQuestionIds = [...new Set([...(previous.lockedQuestionIds ?? []), ...(incoming.lockedQuestionIds ?? [])])]
  return { ...incoming, answers, lockedQuestionIds }
}

export class MockApiClient implements ApiClient {
  private store: KeyValueStore

  constructor(store: KeyValueStore = createDefaultStore()) {
    this.store = store
  }

  private async requireEditToken(code: string, editToken: string): Promise<void> {
    const storedHash = this.store.getItem(editTokenHashKey(code))
    if (!storedHash) throw new ApiError(`존재하지 않는 수업 코드입니다: ${code}`)
    const givenHash = await sha256Hex(editToken)
    if (storedHash !== givenHash) throw new ApiError('편집 권한이 없습니다 (editToken 불일치)')
  }

  /** `isTest:true`는 진짜 그 수업의 editToken이 함께 왔을 때만 인정한다 — 그 외엔 조용히 false로 낮춘다. */
  private async resolveIsTest(code: string, requestedIsTest: boolean, editToken?: string): Promise<boolean> {
    if (!requestedIsTest || !editToken) return false
    try {
      await this.requireEditToken(code, editToken)
      return true
    } catch {
      return false
    }
  }

  private readLessonRaw(code: string): Lesson {
    const raw = this.store.getItem(lessonKey(code))
    if (!raw) throw new ApiError(`존재하지 않는 수업 코드입니다: ${code}`)
    return migrateLesson(JSON.parse(raw))
  }

  private findCodeBySlug(slug: string): string | null {
    const normalized = slug.toLowerCase()
    for (const key of this.store.keysWithPrefix(SLUG_PREFIX)) {
      if ((this.store.getItem(key) ?? '').toLowerCase() === normalized) return key.slice(SLUG_PREFIX.length)
    }
    return null
  }

  /** 입력값이 코드일 수도 slug일 수도 있다. 코드를 먼저 본다(Code.gs의 resolveCode와 같은 순서). */
  private resolveCode(input: string): string {
    const raw = input.trim()
    const upper = raw.toUpperCase()
    if (this.store.getItem(lessonKey(upper))) return upper
    return this.findCodeBySlug(raw) ?? upper
  }

  /** 마감된 수업에는 학생이 더 이상 쓸 수 없다. 교사 테스트 모드는 예외. */
  private assertNotLocked(lesson: Lesson, isTest: boolean): void {
    if (!isTest && lesson.settings.locked) throw new ApiError('제출이 마감된 수업입니다. 선생님께 문의하세요.')
  }

  private writeLesson(code: string, lesson: Lesson): void {
    this.store.setItem(lessonKey(code), JSON.stringify(lesson))
  }

  /**
   * 학생이 방금 활동했음을 기록한다. `saveProgress`·`submitResponse`에서만 부른다.
   * 교사 테스트 응답(isTest)은 학급 명단이 아니므로 남기지 않는다.
   */
  private touchLastSeen(code: string, studentKey: string, isTest: boolean): void {
    if (isTest) return
    const map = this.readLastSeen(code)
    map[studentKey] = nowIso()
    this.store.setItem(lastSeenKey(code), JSON.stringify(map))
  }

  private readLastSeen(code: string): Record<string, string> {
    const raw = this.store.getItem(lastSeenKey(code))
    if (!raw) return {}
    try {
      return JSON.parse(raw) as Record<string, string>
    } catch {
      return {} // 손상된 값은 없는 것으로 친다 (Code.gs의 withCache와 같은 방침)
    }
  }

  private readResponses(code: string, isTest: boolean): ResponseRecord[] {
    return this.store.keysWithPrefix(responsePrefix(code, isTest)).map((key) => JSON.parse(this.store.getItem(key)!) as ResponseRecord)
  }

  async createLesson(input: CreateLessonInput): Promise<CreateLessonResult> {
    let code = generateLessonCode()
    while (this.store.getItem(lessonKey(code))) code = generateLessonCode() // 충돌 시 재시도 (극히 드묾)

    const editToken = generateEditToken()
    const lesson: Lesson = {
      version: 3,
      code,
      title: input.title,
      accent: '#2563eb',
      published: false,
      settings: {
        requireAnswerToAdvance: true,
        allowBackNavigation: true,
        feedbackMode: 'onFinish',
        identityFields: input.identityFields,
        shuffleChoices: false,
        referencePanel: { enabled: false, tabs: [] },
      },
      // 슬라이드 0개인 수업은 편집기가 다룰 수 없다(슬라이드 목록의 "마지막 슬라이드는 못 지움" 규칙과
      // 같은 전제) — 처음부터 빈 슬라이드 1개로 시작한다.
      slides: [{ id: crypto.randomUUID(), isSub: false, blocks: [] }],
      updatedAt: nowIso(),
    }

    this.writeLesson(code, lesson)
    this.store.setItem(editTokenHashKey(code), await sha256Hex(editToken))

    return { code, editToken }
  }

  async getLesson(code: string): Promise<Lesson> {
    // 학생이 짧은 주소(slug)로 들어왔을 수 있다 — 여기서 한 번만 실제 코드로 바꾼다.
    const lesson = this.readLessonRaw(this.resolveCode(code))
    if (!lesson.published) throw new ApiError('아직 발행되지 않은 수업입니다')
    return stripAnswers(lesson)
  }

  async getLessonForEdit(code: string, editToken: string): Promise<Lesson> {
    const resolved = this.resolveCode(code)
    await this.requireEditToken(resolved, editToken)
    return {
      ...this.readLessonRaw(resolved),
      slug: this.store.getItem(slugKey(resolved)) ?? '',
      // 설정 여부만 알려준다 — 해시조차 내보내지 않는다
      hasViewPassword: this.store.getItem(viewPasswordKey(resolved)) !== null,
    }
  }

  async saveLesson(code: string, editToken: string, lesson: Lesson): Promise<void> {
    await this.requireEditToken(code, editToken)
    // slug·hasViewPassword는 별도 저장소가 유일한 출처다 — 수업 JSON 안에 눌러앉지 않게
    // 떼어낸다(Code.gs와 동일). 특히 hasViewPassword가 JSON에 남으면 학생용 응답에도 새어 나간다.
    const { slug: _slug, hasViewPassword: _hasViewPassword, ...rest } = lesson
    this.writeLesson(code, { ...rest, code, updatedAt: nowIso() })
  }

  async publishLesson(code: string, editToken: string): Promise<void> {
    await this.requireEditToken(code, editToken)
    const lesson = this.readLessonRaw(code)
    this.writeLesson(code, { ...lesson, published: true, updatedAt: nowIso() })
  }

  async deleteLesson(code: string, editToken: string): Promise<void> {
    await this.requireEditToken(code, editToken)
    this.store.removeItem(lessonKey(code))
    this.store.removeItem(editTokenHashKey(code))
    this.store.removeItem(slugKey(code))
    this.store.removeItem(lastSeenKey(code))
    this.store.removeItem(viewPasswordKey(code))
    this.store.removeItem(viewFailKey(code))
    for (const key of this.store.keysWithPrefix(responsePrefix(code, false))) this.store.removeItem(key)
    for (const key of this.store.keysWithPrefix(responsePrefix(code, true))) this.store.removeItem(key)
  }

  async setLessonSlug(code: string, editToken: string, slug: string): Promise<{ slug: string }> {
    await this.requireEditToken(code, editToken)
    const trimmed = slug.trim()
    if (!trimmed) {
      this.store.removeItem(slugKey(code))
      return { slug: '' }
    }
    if (!SLUG_PATTERN.test(trimmed)) {
      throw new ApiError('주소는 한글·영문·숫자로 시작하는 2~20자여야 하고, - 와 _ 만 함께 쓸 수 있어요')
    }
    if (/^[A-Z0-9]{6}$/.test(trimmed.toUpperCase())) {
      throw new ApiError('수업 코드와 같은 형식(영문 대문자·숫자 6자리)은 주소로 쓸 수 없어요')
    }
    const owner = this.findCodeBySlug(trimmed)
    if (owner && owner !== code) throw new ApiError('이미 다른 수업이 쓰고 있는 주소예요')
    this.store.setItem(slugKey(code), trimmed)
    return { slug: trimmed }
  }

  async setLessonLocked(code: string, editToken: string, locked: boolean): Promise<{ locked: boolean }> {
    await this.requireEditToken(code, editToken)
    const lesson = this.readLessonRaw(code)
    this.writeLesson(code, { ...lesson, settings: { ...lesson.settings, locked }, updatedAt: nowIso() })
    return { locked }
  }

  async deleteResponse(code: string, editToken: string, studentKey: string): Promise<{ deleted: number }> {
    await this.requireEditToken(code, editToken)
    let deleted = 0
    for (const isTest of [false, true]) {
      const key = responseKey(code, studentKey, isTest)
      if (this.store.getItem(key)) {
        this.store.removeItem(key)
        deleted++
      }
    }
    return { deleted }
  }

  async uploadMedia(code: string, editToken: string, file: Blob): Promise<UploadResult> {
    await this.requireEditToken(code, editToken)
    return { url: URL.createObjectURL(file) }
  }

  async uploadStudentMedia(code: string, file: Blob): Promise<UploadResult> {
    this.readLessonRaw(code) // 수업 존재 확인
    return { url: URL.createObjectURL(file) }
  }

  async saveProgress(code: string, record: Omit<ResponseRecord, 'submittedAt'>, editToken?: string): Promise<void> {
    const lesson = this.readLessonRaw(code)
    const isTest = await this.resolveIsTest(code, record.isTest, editToken)
    this.assertNotLocked(lesson, isTest)
    const safeRecord = { ...record, isTest }
    const key = responseKey(code, safeRecord.studentKey, isTest)
    const previousRaw = this.store.getItem(key)
    const previous = previousRaw ? (JSON.parse(previousRaw) as ResponseRecord) : null
    // 이미 제출된 응답에 뒤늦게 도착한 자동저장(디바운스)이 덮어써서 "미제출"로 되돌리는 것을 막는다
    // (saveProgress 페이로드에는 submittedAt이 아예 없어 그대로 덮어쓰면 제출 기록이 사라진다).
    if (previous?.submittedAt) return
    this.store.setItem(key, JSON.stringify(enforceLocks(previous, safeRecord)))
    this.touchLastSeen(code, safeRecord.studentKey, isTest)
  }

  async getProgress(code: string, studentKey: string, identity?: Identity): Promise<ResponseRecord | null> {
    // isTest 여부를 모르는 상태로 조회하므로 정식 응답을 먼저 찾고, 없으면 테스트 응답도 본다.
    const main = this.store.getItem(responseKey(code, studentKey, false))
    if (main) return JSON.parse(main) as ResponseRecord
    const test = this.store.getItem(responseKey(code, studentKey, true))
    if (test) return JSON.parse(test) as ResponseRecord
    // 열쇠로 못 찾으면 다듬은 식별정보로 한 번 더 본다 — 실제 백엔드(Code.gs)와 같은 규칙이다.
    // 목 백엔드는 열쇠를 localStorage 키로 쓰므로 전부 훑어야 한다(수업당 학생 수가 적어 문제없다).
    if (!identity) return null
    const want = identitySignature(identity)
    if (want.replace(/:/g, '') === '') return null // 식별칸이 전부 비면 대조하지 않는다
    for (const isTest of [false, true]) {
      for (const k of this.store.keysWithPrefix(responsePrefix(code, isTest))) {
        const raw = this.store.getItem(k)
        if (!raw) continue
        const rec = JSON.parse(raw) as ResponseRecord
        if (identitySignature(rec.identity ?? {}) === want) return rec
      }
    }
    return null
  }

  async gradeAnswer(code: string, questionId: string, value: unknown) {
    const lesson = this.readLessonRaw(code)
    const question = findQuestionInLesson(lesson, questionId)
    if (!question) throw new ApiError(`존재하지 않는 문항입니다: ${questionId}`)
    return gradeQuestion(question, value)
  }

  /** 여러 문항 일괄 채점 — 없는 문항은 조용히 건너뛴다(Code.gs 와 같은 동작). */
  async gradeAnswers(code: string, items: { questionId: string; value: unknown }[]) {
    const lesson = this.readLessonRaw(code)
    const out: Record<string, GradeResult> = {}
    for (const item of items ?? []) {
      const question = findQuestionInLesson(lesson, item.questionId)
      if (!question) continue
      const result = gradeQuestion(question, item.value)
      if (result) out[item.questionId] = result
    }
    return out
  }

  /**
   * 진입 — 이어받기 + 자리 잡기를 한 번에. 이미 있으면 **그대로 돌려주고 아무것도 안 쓴다.**
   * (Code.gs `enterLesson` 과 같은 동작이어야 한다 — 규칙 4)
   */
  async enterLesson(
    code: string,
    input: { studentKey: string; identity: Identity; startedAt: string; path: string[]; isTest?: boolean },
    editToken?: string,
  ): Promise<ResponseRecord | null> {
    const lesson = this.readLessonRaw(code)
    const isTest = await this.resolveIsTest(code, Boolean(input.isTest), editToken)
    this.assertNotLocked(lesson, isTest)
    const existing = await this.getProgress(code, input.studentKey, input.identity)
    if (existing) {
      this.touchLastSeen(code, existing.studentKey, isTest)
      return existing
    }
    const record: ResponseRecord = {
      studentKey: input.studentKey,
      identity: input.identity,
      startedAt: input.startedAt,
      path: input.path,
      answers: {},
      scores: {},
      lockedQuestionIds: [],
      isTest,
    }
    this.store.setItem(responseKey(code, record.studentKey, isTest), JSON.stringify(record))
    this.touchLastSeen(code, record.studentKey, isTest)
    return null
  }

  async submitResponse(code: string, record: ResponseRecord, editToken?: string): Promise<{ scores: ResponseRecord['scores'] }> {
    const lesson = this.readLessonRaw(code)
    const isTest = await this.resolveIsTest(code, record.isTest, editToken)
    this.assertNotLocked(lesson, isTest)
    const safeRecord = { ...record, isTest }
    const key = responseKey(code, safeRecord.studentKey, isTest)
    const previousRaw = this.store.getItem(key)
    const previous = previousRaw ? (JSON.parse(previousRaw) as ResponseRecord) : null
    const lockedRecord = enforceLocks(previous, safeRecord)

    const scores: ResponseRecord['scores'] = {}
    for (const [questionId, value] of Object.entries(lockedRecord.answers)) {
      const question = findQuestionInLesson(lesson, questionId)
      if (!question) continue
      const result = gradeQuestion(question, value)
      if (result) scores[questionId] = result
    }
    const finalRecord: ResponseRecord = { ...lockedRecord, submittedAt: nowIso(), scores }
    this.store.setItem(key, JSON.stringify(finalRecord))
    this.touchLastSeen(code, safeRecord.studentKey, isTest)
    return { scores }
  }

  async getResults(code: string, editToken: string): Promise<ResponseRecord[]> {
    await this.requireEditToken(code, editToken)
    this.purgeExpiredResponses(code)
    return this.readResponses(code, false)
  }

  async setViewPassword(code: string, editToken: string, password: string): Promise<{ hasViewPassword: boolean }> {
    await this.requireEditToken(code, editToken)
    const value = String(password ?? '')
    if (!value) {
      this.store.removeItem(viewPasswordKey(code))
      this.store.removeItem(viewFailKey(code)) // 해제하면 잠금도 같이 푼다
      return { hasViewPassword: false }
    }
    const problem = validateViewPassword(value, code)
    if (problem) throw new ApiError(problem)
    this.store.setItem(viewPasswordKey(code), await sha256Hex(value))
    this.store.removeItem(viewFailKey(code))
    return { hasViewPassword: true }
  }

  /**
   * 진행 상황 화면의 문지기. 편집 키와 현황 암호 **둘 중 하나만** 맞으면 통과한다.
   *
   * 시도 제한은 **현황 암호 쪽에만** 건다 — 사람이 정하는 값이라 짐작당할 수 있어서다.
   * 편집 키는 256비트 무작위라 대입이 무의미하고, 여기에 잠금을 걸면 남이 일부러 틀려서
   * 교사를 못 들어오게 만드는 수단이 된다.
   */
  private async requireLiveAccess(code: string, auth: { editToken?: string; viewPassword?: string }): Promise<void> {
    if (auth.editToken) {
      try {
        await this.requireEditToken(code, auth.editToken)
        return
      } catch {
        // 편집 키가 아니면 아래에서 현황 암호로 한 번 더 본다
      }
    }
    const storedHash = this.store.getItem(viewPasswordKey(code))
    if (!storedHash) {
      // 암호를 설정한 적이 없으면 편집 키만이 유일한 길이다
      throw new ApiError('편집 권한이 없습니다 (editToken 불일치)')
    }
    const fails = this.readViewFails(code)
    if (fails >= VIEW_FAIL_LIMIT) {
      throw new ApiError('암호 시도가 너무 많아 잠시 후 다시 시도해주세요 (약 10분 후 자동 해제)')
    }
    if (!auth.viewPassword || (await sha256Hex(auth.viewPassword)) !== storedHash) {
      this.store.setItem(viewFailKey(code), JSON.stringify({ n: fails + 1, at: Date.now() }))
      throw new ApiError('암호가 올바르지 않습니다')
    }
    this.store.removeItem(viewFailKey(code))
  }

  /** 시간 창이 지난 실패 기록은 없던 것으로 본다(Code.gs의 CacheService TTL과 같은 효과). */
  private readViewFails(code: string): number {
    const raw = this.store.getItem(viewFailKey(code))
    if (!raw) return 0
    try {
      const { n, at } = JSON.parse(raw) as { n: number; at: number }
      return Date.now() - at > VIEW_FAIL_WINDOW_MS ? 0 : n
    } catch {
      return 0
    }
  }

  /**
   * 아직 제출하지 않은 학생 전원을 한 번에 제출 처리한다 (Code.gs 의 forceSubmitAll — 규칙 4).
   */
  async forceSubmitAll(
    code: string,
    auth: { editToken?: string; viewPassword?: string },
  ): Promise<{ submitted: number; skipped: number; failed: number }> {
    await this.requireLiveAccess(code, auth)
    const lesson = this.readLessonRaw(code)
    let submitted = 0
    let skipped = 0
    for (const key of this.store.keysWithPrefix(responsePrefix(code, false))) {
      const record = JSON.parse(this.store.getItem(key)!) as ResponseRecord
      if (record.submittedAt) {
        skipped++
        continue
      }
      const scores: ResponseRecord['scores'] = {}
      for (const [questionId, value] of Object.entries(record.answers)) {
        const question = findQuestionInLesson(lesson, questionId)
        if (!question) continue
        const result = gradeQuestion(question, value)
        if (result) scores[questionId] = result
      }
      this.store.setItem(key, JSON.stringify({ ...record, submittedAt: nowIso(), scores }))
      submitted++
    }
    return { submitted, skipped, failed: 0 }
  }

  /**
   * 이미 제출된 응답을 현재 정답으로 다시 채점한다 (Code.gs 의 regradeResponses 와 같은 동작 — 규칙 4).
   * 답은 그대로 두고 점수만 다시 계산한다. 제출 전 학생은 건드리지 않는다.
   */
  async regradeResponses(code: string, editToken: string): Promise<{ regraded: number; failed: number }> {
    await this.requireEditToken(code, editToken)
    const lesson = this.readLessonRaw(code)
    let regraded = 0
    for (const key of this.store.keysWithPrefix(responsePrefix(code, false))) {
      const record = JSON.parse(this.store.getItem(key)!) as ResponseRecord
      if (!record.submittedAt) continue
      const scores: ResponseRecord['scores'] = {}
      for (const [questionId, value] of Object.entries(record.answers)) {
        const question = findQuestionInLesson(lesson, questionId)
        if (!question) continue
        const result = gradeQuestion(question, value)
        if (result) scores[questionId] = result
      }
      this.store.setItem(key, JSON.stringify({ ...record, scores }))
      regraded++
    }
    return { regraded, failed: 0 }
  }

  /**
   * 교사가 학생 한 명을 대신 제출 처리한다 (Code.gs 의 forceSubmit 과 같은 동작 — 규칙 4).
   * 저장된 답을 그대로 채점하고 제출 시각만 찍는다. 답은 건드리지 않는다.
   */
  async forceSubmit(
    code: string,
    auth: { editToken?: string; viewPassword?: string },
    studentKey: string,
  ): Promise<{ alreadySubmitted: boolean; submittedAt: string }> {
    await this.requireLiveAccess(code, auth)
    const lesson = this.readLessonRaw(code)
    const key = responseKey(code, studentKey, false)
    const raw = this.store.getItem(key)
    if (!raw) throw new ApiError('그 학생의 기록을 찾지 못했습니다')
    const record = JSON.parse(raw) as ResponseRecord
    // 이미 제출한 학생을 다시 눌러도 제출 시각이 밀리지 않는다.
    if (record.submittedAt) return { alreadySubmitted: true, submittedAt: record.submittedAt }

    const scores: ResponseRecord['scores'] = {}
    for (const [questionId, value] of Object.entries(record.answers)) {
      const question = findQuestionInLesson(lesson, questionId)
      if (!question) continue
      const result = gradeQuestion(question, value)
      if (result) scores[questionId] = result
    }
    const submittedAt = nowIso()
    this.store.setItem(key, JSON.stringify({ ...record, submittedAt, scores }))
    return { alreadySubmitted: false, submittedAt }
  }

  async getLive(code: string, auth: { editToken?: string; viewPassword?: string }): Promise<LiveSnapshot> {
    await this.requireLiveAccess(code, auth)
    this.purgeExpiredResponses(code)
    return {
      // 정답을 제거해서 보낸다 — 현황 화면은 지문·슬라이드 구조만 있으면 되고,
      // 현황 암호로 들어온 사람에게 정답까지 줄 이유가 없다.
      lesson: stripAnswers(this.readLessonRaw(code)),
      records: this.readResponses(code, false),
      lastSeen: this.readLastSeen(code),
      serverNow: nowIso(),
    }
  }

  /**
   * settings.retentionDays보다 오래된 응답을 지운다(Code.gs의 purgeExpiredResponses와 같은 규칙).
   * 값이 없거나 0이면 무기한 — 보관기간을 정한 적 없는 수업의 응답이 갑자기 사라지면 안 된다.
   */
  private purgeExpiredResponses(code: string): void {
    const days = this.readLessonRaw(code).settings.retentionDays
    if (!days || days <= 0) return
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    for (const isTest of [false, true]) {
      for (const key of this.store.keysWithPrefix(responsePrefix(code, isTest))) {
        const record = JSON.parse(this.store.getItem(key)!) as ResponseRecord
        const startedAt = new Date(record.startedAt).getTime()
        if (!Number.isNaN(startedAt) && startedAt < cutoff) this.store.removeItem(key)
      }
    }
  }

  async getAggregate(code: string, questionId: string): Promise<AggregateResult> {
    const records = this.readResponses(code, false)
    const counts: Record<string, number> = {}
    let totalResponses = 0

    for (const record of records) {
      const value = record.answers[questionId]
      if (value === undefined) continue
      totalResponses += 1
      const bucket = Array.isArray(value) ? value : [value]
      for (const v of bucket) {
        const key = String(v)
        counts[key] = (counts[key] ?? 0) + 1
      }
    }

    return { questionId, totalResponses, counts }
  }

  // 관리자 전용 — mock(로컬 개발)은 운영자 계정 개념이 없어 비밀번호를 검증하지 않는다.
  // 실제 검증은 live 모드(Code.gs, 스크립트 속성 ADMIN_PASSWORD)에서만 의미가 있다.
  async listLessons(_password: string): Promise<LessonSummary[]> {
    return this.store
      .keysWithPrefix(lessonKey(''))
      .map((key) => JSON.parse(this.store.getItem(key)!) as Lesson)
      .map((lesson) => ({
        code: lesson.code,
        title: lesson.title,
        published: lesson.published,
        updatedAt: lesson.updatedAt,
        slideCount: lesson.slides.length,
        // mock은 로컬 스토리지에만 저장하고 실제 Google Sheets가 없어 항상 null —
        // "응답 시트" 버튼은 live 모드에서만 의미가 있다.
        responseSpreadsheetId: null,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async adminGetLesson(code: string, _password: string): Promise<Lesson> {
    return this.readLessonRaw(code)
  }

  async adminDeleteLesson(code: string, _password: string): Promise<void> {
    this.store.removeItem(lessonKey(code))
    this.store.removeItem(editTokenHashKey(code))
    this.store.removeItem(slugKey(code))
    this.store.removeItem(lastSeenKey(code))
    this.store.removeItem(viewPasswordKey(code))
    this.store.removeItem(viewFailKey(code))
    for (const key of this.store.keysWithPrefix(responsePrefix(code, false))) this.store.removeItem(key)
    for (const key of this.store.keysWithPrefix(responsePrefix(code, true))) this.store.removeItem(key)
  }

  async adminResetEditToken(code: string, _password: string): Promise<{ editToken: string }> {
    this.readLessonRaw(code) // 수업 존재 확인
    const editToken = generateEditToken()
    this.store.setItem(editTokenHashKey(code), await sha256Hex(editToken))
    return { editToken }
  }

  // mock은 로컬 스토리지라 실제 Drive 용량 개념이 없다 — 화면 표시만 확인할 수 있게 임의 고정값 반환.
  async adminGetStorageUsage(_password: string): Promise<{ usageBytes: number; limitBytes: number }> {
    return { usageBytes: 0, limitBytes: 15 * 1024 * 1024 * 1024 }
  }
}

export const mockApi = new MockApiClient()
