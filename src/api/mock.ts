import { generateEditToken, generateLessonCode } from '../lib/code'
import { gradeQuestion } from '../lib/grade'
import { sha256Hex } from '../lib/hash'
import { migrateLesson } from '../lib/migrate'
import { stripAnswers } from '../lib/stripAnswers'
import type { Lesson, Question } from '../types/lesson'
import { createDefaultStore, type KeyValueStore } from './storage'
import type {
  AggregateResult,
  ApiClient,
  CreateLessonInput,
  CreateLessonResult,
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
 *    지원을 위해). editToken으로 "정말 그 교사의 테스트 요청인지"를 확인하는 절차는
 *    아직 없다 — 실제 플레이어의 테스트 모드가 생기는 5·9·11단계에서 다시 볼 것
 *    (docs/PROGRESS.md 임시방편 목록 참고).
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

function findQuestion(lesson: Lesson, questionId: string): Question | undefined {
  for (const slide of lesson.slides) {
    for (const block of slide.blocks) {
      if (block.type === 'question' && block.q.id === questionId) return block.q
    }
  }
  return undefined
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
      version: 1,
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
      slides: [],
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

  async saveProgress(code: string, record: Omit<ResponseRecord, 'submittedAt'>): Promise<void> {
    this.readLessonRaw(code)
    this.store.setItem(responseKey(code, record.studentKey, record.isTest), JSON.stringify(record))
  }

  async gradeAnswer(code: string, questionId: string, value: unknown) {
    const lesson = this.readLessonRaw(code)
    const question = findQuestion(lesson, questionId)
    if (!question) throw new ApiError(`존재하지 않는 문항입니다: ${questionId}`)
    return gradeQuestion(question, value)
  }

  async submitResponse(code: string, record: ResponseRecord): Promise<{ scores: ResponseRecord['scores'] }> {
    const lesson = this.readLessonRaw(code)
    const scores: ResponseRecord['scores'] = {}
    for (const [questionId, value] of Object.entries(record.answers)) {
      const question = findQuestion(lesson, questionId)
      if (!question) continue
      const result = gradeQuestion(question, value)
      if (result) scores[questionId] = result
    }
    const finalRecord: ResponseRecord = { ...record, submittedAt: nowIso(), scores }
    this.store.setItem(responseKey(code, record.studentKey, record.isTest), JSON.stringify(finalRecord))
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
}

export const mockApi = new MockApiClient()
