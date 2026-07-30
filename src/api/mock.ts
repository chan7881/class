import { generateEditToken, generateLessonCode } from '../lib/code'
import { findQuestionInLesson } from '../lib/findQuestion'
import { gradeQuestion } from '../lib/grade'
import { sha256Hex } from '../lib/hash'
import { migrateLesson } from '../lib/migrate'
import { stripAnswers } from '../lib/stripAnswers'
import type { Lesson } from '../types/lesson'
import { createDefaultStore, type KeyValueStore } from './storage'
import type {
  AggregateResult,
  ApiClient,
  CreateLessonInput,
  CreateLessonResult,
  LessonSummary,
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

  private writeLesson(code: string, lesson: Lesson): void {
    this.store.setItem(lessonKey(code), JSON.stringify(lesson))
  }

  private readResponses(code: string, isTest: boolean): ResponseRecord[] {
    return this.store.keysWithPrefix(responsePrefix(code, isTest)).map((key) => JSON.parse(this.store.getItem(key)!) as ResponseRecord)
  }

  async createLesson(input: CreateLessonInput): Promise<CreateLessonResult> {
    let code = generateLessonCode()
    while (this.store.getItem(lessonKey(code))) code = generateLessonCode() // 충돌 시 재시도 (극히 드묾)

    const editToken = generateEditToken()
    const lesson: Lesson = {
      version: 2,
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
    const lesson = this.readLessonRaw(code)
    if (!lesson.published) throw new ApiError('아직 발행되지 않은 수업입니다')
    return stripAnswers(lesson)
  }

  async getLessonForEdit(code: string, editToken: string): Promise<Lesson> {
    await this.requireEditToken(code, editToken)
    return this.readLessonRaw(code)
  }

  async saveLesson(code: string, editToken: string, lesson: Lesson): Promise<void> {
    await this.requireEditToken(code, editToken)
    this.writeLesson(code, { ...lesson, code, updatedAt: nowIso() })
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
    for (const key of this.store.keysWithPrefix(responsePrefix(code, false))) this.store.removeItem(key)
    for (const key of this.store.keysWithPrefix(responsePrefix(code, true))) this.store.removeItem(key)
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
    this.readLessonRaw(code)
    const isTest = await this.resolveIsTest(code, record.isTest, editToken)
    const safeRecord = { ...record, isTest }
    const key = responseKey(code, safeRecord.studentKey, isTest)
    const previousRaw = this.store.getItem(key)
    const previous = previousRaw ? (JSON.parse(previousRaw) as ResponseRecord) : null
    // 이미 제출된 응답에 뒤늦게 도착한 자동저장(디바운스)이 덮어써서 "미제출"로 되돌리는 것을 막는다
    // (saveProgress 페이로드에는 submittedAt이 아예 없어 그대로 덮어쓰면 제출 기록이 사라진다).
    if (previous?.submittedAt) return
    this.store.setItem(key, JSON.stringify(enforceLocks(previous, safeRecord)))
  }

  async getProgress(code: string, studentKey: string): Promise<ResponseRecord | null> {
    // isTest 여부를 모르는 상태로 조회하므로 정식 응답을 먼저 찾고, 없으면 테스트 응답도 본다.
    const main = this.store.getItem(responseKey(code, studentKey, false))
    if (main) return JSON.parse(main) as ResponseRecord
    const test = this.store.getItem(responseKey(code, studentKey, true))
    return test ? (JSON.parse(test) as ResponseRecord) : null
  }

  async gradeAnswer(code: string, questionId: string, value: unknown) {
    const lesson = this.readLessonRaw(code)
    const question = findQuestionInLesson(lesson, questionId)
    if (!question) throw new ApiError(`존재하지 않는 문항입니다: ${questionId}`)
    return gradeQuestion(question, value)
  }

  async submitResponse(code: string, record: ResponseRecord, editToken?: string): Promise<{ scores: ResponseRecord['scores'] }> {
    const lesson = this.readLessonRaw(code)
    const isTest = await this.resolveIsTest(code, record.isTest, editToken)
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
    return { scores }
  }

  async getResults(code: string, editToken: string): Promise<ResponseRecord[]> {
    await this.requireEditToken(code, editToken)
    return this.readResponses(code, false)
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
