import type { GradeResult } from '../lib/grade'
import type { IdentityField, Lesson } from '../types/lesson'

/**
 * mock.ts(2단계)와 실제 Apps Script 클라이언트(6단계)가 함께 구현하는 공용 계약.
 * 6단계에서 목→실제로 바꿀 때 이 인터페이스를 그대로 만족시키면 되게 하는 것이 목적 —
 * 호출하는 쪽(에디터·플레이어·결과 대시보드) 코드는 한 줄도 안 바뀌어야 한다.
 *
 * 각 액션의 인증 요구사항은 docs/PLAN.md 「Apps Script API」 표와 동일하다.
 */

export type Identity = Partial<Record<IdentityField, string>>

export interface CreateLessonInput {
  title: string
  identityFields: IdentityField[]
}

export interface CreateLessonResult {
  code: string
  /** 서버는 이 값의 해시만 저장한다 — 응답으로 딱 한 번 돌려주고, 클라이언트가 보관해야 한다 */
  editToken: string
}

export interface UploadResult {
  url: string
}

export interface ResponseRecord {
  studentKey: string
  identity: Identity
  startedAt: string
  submittedAt?: string
  /** 조건 분기로 실제 통과한 슬라이드 id 순서 (엑셀의 "진행경로" 열) */
  path: string[]
  /** questionId -> 학생이 제출한 원본 답 값 */
  answers: Record<string, unknown>
  /** questionId -> 채점 결과. 채점기가 없는 유형(서답형 등)은 키 자체가 없다 */
  scores: Record<string, GradeResult>
  /** true면 교사 테스트 모드 응답 — 통계·엑셀 수합에서 제외된다 */
  isTest: boolean
  /** POE 예측처럼 lockAfterSubmit인 문항 중 학생이 잠근 questionId 목록 — 서버는 이 목록에 있는 답을 재수정 요청이 와도 거부한다 */
  lockedQuestionIds?: string[]
}

export interface LiveSnapshot {
  /**
   * 이 화면이 그리는 데 필요한 수업(슬라이드 번호·문항 목록·식별 필드). **정답은 제거돼 있다.**
   *
   * 왜 여기에 실어 보내나: 현황 암호로 들어온 교사는 `getLessonForEdit`(편집 키 전용)을 부를 수
   * 없다. 그렇다고 화면이 슬라이드를 모르면 "몇 번째에 있는지"를 못 그려 쓸모가 없어진다.
   */
  lesson: Lesson
  /** 정식 응답만 (isTest 제외) — getResults와 같은 소스 */
  records: ResponseRecord[]
  /**
   * studentKey -> 마지막으로 진행 상황을 저장한 시각(ISO).
   *
   * 서버는 이 값을 **캐시**에 둔다(응답 시트에 컬럼을 못 넣는다 — `_meta`가 문항의 절대 컬럼
   * 번호를 들고 있어서 고정 컬럼을 끼우면 기존 응답이 한 칸씩 밀린다. docs/DECISIONS.md 참고).
   * 그래서 **키가 없는 학생이 정상적으로 있을 수 있고**, 화면은 그걸 "오래 멈춤"이 아니라
   * "활동 기록 없음"으로 구분해 보여줘야 한다.
   */
  lastSeen: Record<string, string>
  /**
   * 서버가 응답을 만든 시각(ISO). 경과 시간은 반드시 이 값을 기준으로 계산한다 —
   * 교사 기기 시계가 틀어져 있으면 클라이언트 시계로는 음수나 엉뚱한 값이 나온다.
   */
  serverNow: string
}

export interface AggregateResult {
  questionId: string
  totalResponses: number
  /** 보기ID/값(문자열화) -> 응답 수. 문항 유형별 세부 집계는 8~9단계에서 확장 */
  counts: Record<string, number>
}

export interface LessonSummary {
  code: string
  title: string
  published: boolean
  updatedAt: string
  createdAt?: string
  slideCount: number
  /** 발행해서 응답 시트가 생성된 수업만 값이 있다 — 관리자 화면의 "응답 시트" 링크 버튼용 */
  responseSpreadsheetId?: string | null
}

export interface ApiClient {
  createLesson(input: CreateLessonInput): Promise<CreateLessonResult>
  /** 학생용. 정답·해설이 제거된 수업만 반환하고, 미발행 수업은 거부한다 */
  getLesson(code: string): Promise<Lesson>
  /** 교사용. 정답 포함 전체 반환 */
  getLessonForEdit(code: string, editToken: string): Promise<Lesson>
  saveLesson(code: string, editToken: string, lesson: Lesson): Promise<void>
  publishLesson(code: string, editToken: string): Promise<void>
  deleteLesson(code: string, editToken: string): Promise<void>
  /**
   * 학생이 6자리 코드 대신 쓸 짧은 주소(별칭)를 설정한다. 빈 문자열이면 해제.
   * 코드 자체는 그대로 살아 있고, 서버는 코드 조회를 먼저 시도한 뒤에만 slug를 찾는다.
   */
  setLessonSlug(code: string, editToken: string, slug: string): Promise<{ slug: string }>
  /** 제출 마감. true면 학생의 저장·제출 요청을 서버가 거부한다(교사 테스트 모드는 예외) */
  setLessonLocked(code: string, editToken: string, locked: boolean): Promise<{ locked: boolean }>
  /** 학생 한 명의 응답만 삭제한다 (중복 행 정리·재응시 허용 등) */
  deleteResponse(code: string, editToken: string, studentKey: string): Promise<{ deleted: number }>
  uploadMedia(code: string, editToken: string, file: Blob, filename: string): Promise<UploadResult>
  uploadStudentMedia(code: string, file: Blob, filename: string): Promise<UploadResult>
  /**
   * `record.isTest`는 `editToken`이 함께 오고 실제로 그 수업의 편집 권한과 일치할 때만 서버가
   * 인정한다 — 그 외에는 서버가 조용히 `isTest:false`로 낮춘다(테스트 모드가 실제 기능이 된
   * 11단계부터 적용, docs/DECISIONS.md 참고). editToken을 안 보내면(실제 학생 제출) 당연히 무시.
   */
  saveProgress(code: string, record: Omit<ResponseRecord, 'submittedAt'>, editToken?: string): Promise<void>
  /** 학생이 기기를 바꾸거나 새로고침해도 같은 식별정보(studentKey)로 이어서 풀 수 있게 한다 */
  /** identity 를 함께 넘긴다 — 기기가 바뀌어 열쇠가 달라져도 같은 학생이면 이어받게 한다 */
  getProgress(code: string, studentKey: string, identity?: Identity): Promise<ResponseRecord | null>
  /** 즉시 피드백(feedbackMode: 'immediate')용 단건 채점. 정답 자체는 절대 돌려주지 않는다 */
  gradeAnswer(code: string, questionId: string, value: unknown): Promise<GradeResult | null>
  /** isTest 검증은 saveProgress와 동일 */
  submitResponse(code: string, record: ResponseRecord, editToken?: string): Promise<{ scores: ResponseRecord['scores'] }>
  getResults(code: string, editToken: string): Promise<ResponseRecord[]>
  /**
   * 수업 중 실시간 모니터링 화면용. `getResults`와 같은 응답에 **마지막 활동 시각**을 얹어 준다.
   * 한 번의 왕복으로 끝내려고 합쳐 뒀다 — 8초마다 폴링하는 화면이라 왕복이 둘이면 그만큼 부담이 는다.
   */
  /**
   * 진행 상황 화면 전용 암호를 설정한다. 빈 문자열이면 해제(그러면 편집 키로만 들어갈 수 있다).
   * 서버는 해시만 저장하고 절대 돌려주지 않는다 — 설정 여부만 `Lesson.hasViewPassword`로 알려준다.
   */
  setViewPassword(code: string, editToken: string, password: string): Promise<{ hasViewPassword: boolean }>
  /**
   * `editToken`이나 `viewPassword` 중 **하나만 맞으면** 통과한다.
   * 현황 암호로 들어온 경우에도 볼 수 있는 것은 이 화면뿐이다 — 수정·발행·삭제·내려받기는 여전히 편집 키가 필요하다.
   */
  getLive(code: string, auth: { editToken?: string; viewPassword?: string }): Promise<LiveSnapshot>
  /**
   * 학생 한 명을 교사가 대신 제출 처리한다. 저장된 답을 그대로 채점하고 제출 시각만 찍는다 —
   * 답은 건드리지 않는다. 권한은 getLive 와 같다(현황 암호로도 된다).
   */
  forceSubmit(
    code: string,
    auth: { editToken?: string; viewPassword?: string },
    studentKey: string,
  ): Promise<{ alreadySubmitted: boolean; submittedAt: string }>
  /**
   * 이미 제출된 응답을 현재 정답으로 다시 채점한다 (정답을 고쳐 재발행할 때).
   * 답은 그대로 두고 점수만 다시 계산한다. 제출 전 학생은 건드리지 않는다.
   */
  /** 아직 제출하지 않은 학생 전원을 한 번에 제출 처리한다. 권한·동작은 forceSubmit 과 같다. */
  forceSubmitAll(
    code: string,
    auth: { editToken?: string; viewPassword?: string },
  ): Promise<{ submitted: number; skipped: number; failed: number }>
  regradeResponses(code: string, editToken: string): Promise<{ regraded: number; failed: number }>
  getAggregate(code: string, questionId: string): Promise<AggregateResult>

  /**
   * 관리자 전용(운영자 비밀번호로만 인증, editToken과 무관) — 전체 수업 컨텐츠 관리 화면용.
   * docs/PLAN.md 원안에는 없던 운영 편의 확장. 비밀번호는 live에서 Apps Script 스크립트
   * 속성(ADMIN_PASSWORD)과 대조하고, mock(로컬 개발)에서는 검증하지 않는다.
   */
  listLessons(password: string): Promise<LessonSummary[]>
  adminGetLesson(code: string, password: string): Promise<Lesson>
  adminDeleteLesson(code: string, password: string): Promise<void>
  /**
   * 서버는 editToken 평문을 절대 저장하지 않으므로(CLAUDE.md 규칙 6), 관리자가 기존 수업을
   * 편집기로 열려면 editToken을 새로 발급해 기존 것을 무효화하는 수밖에 없다 — 교사가 보관 중인
   * 예전 편집 링크는 이 호출 이후 더 이상 동작하지 않는다(2026-07-29 확정, docs/DECISIONS.md 참고).
   */
  adminResetEditToken(code: string, password: string): Promise<{ editToken: string }>
  /** Drive 무료 저장용량(15GB) 임박을 미리 감지하기 위한 관리자 화면용 조회. 바이트 단위. */
  adminGetStorageUsage(password: string): Promise<{ usageBytes: number; limitBytes: number }>
}
