/**
 * 수업(Lesson) 데이터 모델 — 에디터·플레이어·결과 대시보드·Apps Script 백엔드가 전부 공유한다.
 * 설계 근거는 docs/PLAN.md 「데이터 모델」 절 참고.
 *
 * 스키마를 바꿀 때는 반드시 `version`을 올리고 src/lib/migrate.ts에 변환 함수를 추가한다.
 * (CLAUDE.md 「반드시 지킬 코드 규칙」 5번)
 */

/** 'onSlideLeave': 문항별로 즉시 공개하지 않고, "다음"으로 그 슬라이드를 벗어나기 직전에
 *  제출 후 요약 화면과 같은 방식으로 그 슬라이드의 문항 정오답만 모아 보여준다. */
export type FeedbackMode = 'never' | 'immediate' | 'onFinish' | 'onSlideLeave'
export type IdentityField = 'grade' | 'klass' | 'number' | 'name'

export interface ReferencePanelSettings {
  enabled: boolean
  tabs: ('periodic' | 'constants' | 'units' | 'custom')[]
  customHtml?: string
}

export interface LessonSettings {
  /** 필수 문항에 답하지 않으면 다음 슬라이드로 못 넘어가게 할지 */
  requireAnswerToAdvance: boolean
  allowBackNavigation: boolean
  /** 정오답 공개 시점의 수업 기본값 — 문항별로 feedbackOverride가 있으면 그게 우선 */
  feedbackMode: FeedbackMode
  identityFields: IdentityField[]
  shuffleChoices: boolean
  referencePanel: ReferencePanelSettings
  /** 학생 응답을 보관할 일수. 생략하거나 0이면 무기한(기존 수업의 기본 동작). */
  retentionDays?: number
  /** 마감. true면 학생이 더 이상 제출·수정할 수 없다. */
  locked?: boolean
}

export interface BranchRule {
  questionId: string
  rules: { when: 'correct' | 'incorrect' | `choice:${string}`; goTo: string }[]
  default?: string
}

export interface Slide {
  id: string
  title?: string
  /** true면 직전 메인 슬라이드의 하위 슬라이드 — 번호는 4-1, 4-2처럼 매겨진다 (lib/numbering.ts가 매번 재계산) */
  isSub: boolean
  blocks: Block[]
  branch?: BranchRule
}

export interface Lesson {
  version: 3
  code: string
  title: string
  description?: string
  /** 과목·학년·단원 — 수업이 쌓였을 때 목록에서 골라내기 위한 분류용. 전부 선택 입력이다. */
  subject?: string
  grade?: string
  unit?: string
  /** 단색 강조색. 기본값은 index.css의 --color-accent-500과 동일한 #2563eb */
  accent: string
  /** false면 학생용 getLesson이 거부한다. 교사는 발행 전에도 editToken으로 테스트 모드 진입 가능 */
  published: boolean
  settings: LessonSettings
  slides: Slide[]
  updatedAt: string
  /**
   * 학생이 코드 대신 쓰는 짧은 주소. **수업 JSON에는 저장되지 않는다** — 전역에서 유일해야 해서
   * 서버의 index 시트가 유일한 출처이고, `getLessonForEdit` 응답에만 편의로 실려 온다.
   * (`saveLesson`은 이 필드를 떼어내고 저장한다. 스키마 버전과 무관한 이유가 이것이다.)
   */
  slug?: string
  /**
   * 진행 상황 화면 전용 암호가 설정돼 있는지. **암호 자체가 아니라 설정 여부만** 실려 온다.
   * slug와 같은 성질 — 수업 JSON에는 저장되지 않고 서버 index 시트가 유일한 출처이며,
   * `getLessonForEdit`(교사용) 응답에만 실린다. `saveLesson`은 이 필드를 떼어내고 저장한다.
   *
   * ⚠️ **해시조차 학생용 `getLesson` 응답에 넣으면 안 된다** — 학생이 받아 가면 서버 시도
   * 제한과 무관하게 자기 기기에서 마음껏 대입해 볼 수 있다.
   */
  hasViewPassword?: boolean
}

// ── 블록 ──────────────────────────────────────────────────────────────

interface BlockBase {
  id: string
  /** 'half'면 가로 공간을 덜 차지하는 블록끼리 나란히(2단) 배치한다 — lib/blockLayout.ts가
   *  연속된 'half' 블록 두 개씩 묶어 한 행으로 그린다. 생략하면 'full'(기존 동작)과 같다. */
  layout?: 'full' | 'half'
}

export interface TextBlock extends BlockBase {
  type: 'text'
  /** TipTap이 만드는 리치텍스트 HTML. 인라인 수식(mathInline)·첨자 포함 가능 */
  html: string
}

export interface HeadingBlock extends BlockBase {
  type: 'heading'
  level: 1 | 2 | 3
  /** TipTap 리치텍스트 HTML(텍스트 블록과 같은 서식 적용 가능) — v1의 평문 `text` 필드를
   *  대체한다(lib/migrate.ts 1→2 변환 참고) */
  html: string
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  src: string
  alt: string
  caption?: string
  width: 'full' | 'half'
}

export interface VideoBlock extends BlockBase {
  type: 'video'
  provider: 'youtube' | 'vimeo' | 'file'
  url: string
  /** 초 단위 구간 재생 시작·종료 */
  start?: number
  end?: number
  loop: boolean
  autoplay: boolean
  caption?: string
}

export interface CalloutBlock extends BlockBase {
  type: 'callout'
  tone: 'info' | 'tip' | 'warn'
  html: string
}

export interface DividerBlock extends BlockBase {
  type: 'divider'
}

/** URL을 붙여넣거나(source:'url', 화이트리스트 도메인만) 직접 만든 단일 self-contained HTML
 *  파일을 업로드해서(source:'file') 학생이 페이지 이동 없이 시뮬레이션을 실행하게 한다.
 *  source 생략 시 기존 데이터(v2 스키마 안의 구버전 블록)와의 호환을 위해 'url'로 취급한다.
 *  source:'file'은 업로드한 HTML 원문을 Drive에 별도 저장하지 않고 수업 JSON 안에 그대로
 *  담아(html 필드) <iframe srcdoc>으로 렌더링한다 — 텍스트 블록의 html 필드와 같은 패턴.
 *  Drive에 올려 별도 URL로 서빙하려면 GET 라우트가 새로 필요하고 Content-Type을 text/html로
 *  보장하기 까다로워서(doGet 라우트를 실제로 시도했다가 되돌림, 2026-07-30 — docs/DECISIONS.md
 *  참고) 이 방식으로 정했다. */
export interface EmbedBlock extends BlockBase {
  type: 'embed'
  source?: 'url' | 'file'
  /** source:'url'일 때만 의미 있음 */
  url: string
  /** source:'file'일 때만 의미 있음 — 업로드한 HTML 원문 그대로 */
  html?: string
  /** source:'file'일 때만 의미 있음 — 재업로드 안내용 원본 파일명 */
  filename?: string
}

export interface ChartSpec {
  chartType: 'line' | 'bar' | 'scatter'
  columns: { key: string; label: string }[]
  rows: (string | number)[][]
  xKey: string
  yKeys: string[]
}

/** 교사가 데이터를 입력해 보여주는 차트 (학생 입력 그래프는 dataTable 문항 쪽) */
export interface ChartBlock extends BlockBase {
  type: 'chart'
  spec: ChartSpec
}

/** 예측-관찰-설명(POE) 묶음. 예측 문항을 제출하면 잠기고, 관찰·설명 단계가 열린다 */
export interface PoeGroupBlock extends BlockBase {
  type: 'poeGroup'
  predictId: string
  observeIds: string[]
  explainId: string
}

export interface QuestionBlock extends BlockBase {
  type: 'question'
  q: Question
}

export type Block =
  | TextBlock
  | HeadingBlock
  | ImageBlock
  | VideoBlock
  | CalloutBlock
  | DividerBlock
  | EmbedBlock
  | ChartBlock
  | PoeGroupBlock
  | QuestionBlock

export type BlockType = Block['type']

// ── 문항 ──────────────────────────────────────────────────────────────

interface QuestionBase {
  id: string
  /** 리치텍스트(수식 포함 가능) */
  prompt: string
  required: boolean
  points: number
  explanation?: string
  /** 수업 기본 feedbackMode를 이 문항만 덮어쓸 때 */
  feedbackOverride?: FeedbackMode
  /** 켜면 학급 전체의 익명 집계 분포를 학생에게 보여준다 */
  shareClassResponses?: boolean
  /** POE 예측 문항처럼, 한 번 제출하면 서버가 재수정을 거부해야 하는 문항 */
  lockAfterSubmit?: boolean
  /** 교육과정 성취기준 코드 등 교사가 직접 다는 자유 태그(검색/모아보기 없이 문항 에디터 표시용) */
  standardsTags?: string[]
}

export type ClozeSegment =
  | { t: 'text'; v: string }
  | { t: 'blank'; mode: 'input' | 'select'; options?: string[]; answer?: string[] }

export interface ClozeQuestion extends QuestionBase {
  kind: 'cloze'
  segments: ClozeSegment[]
}

export interface ChoiceOption {
  id: string
  label: string
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice'
  options: ChoiceOption[]
  multiple: boolean
  answer?: string[]
}

export interface ShortQuestion extends QuestionBase {
  kind: 'short'
  rows: number
  answer?: string[]
  /** 'keywords'는 lib/keywordMatch.ts 문법(쉼표=AND, 괄호 안 쉼표=OR)으로 keywordExpr을 채점한다.
   *  'none'은 자동 채점을 하지 않는다 — 결과 화면에 정오답 표시 없이 학생이 쓴 답만 보여준다. */
  matchMode?: 'exact' | 'contains' | 'keywords' | 'none'
  keywordExpr?: string
}

export interface ComboStatement {
  id: string
  label: string
}

export interface ComboOption {
  id: string
  label: string
  set: string[]
}

/** 합답형: "① ㄱ  ② ㄱㄴ  ③ ㄱㄴㄷ" 같은 보기 중 진술 조합이 맞는 것을 고르는 문항 */
export interface ComboQuestion extends QuestionBase {
  kind: 'combo'
  statements: ComboStatement[]
  options: ComboOption[]
  answer?: string
}

export interface OrderItem {
  id: string
  label: string
}

export interface OrderQuestion extends QuestionBase {
  kind: 'order'
  items: OrderItem[]
  answer?: string[]
}

export interface MatchItem {
  id: string
  label: string
}

export interface MatchQuestion extends QuestionBase {
  kind: 'match'
  left: MatchItem[]
  right: MatchItem[]
  answer?: [string, string][]
}

export interface NumericQuestion extends QuestionBase {
  kind: 'numeric'
  answer?: number
  tolerance?: { mode: 'abs' | 'pct'; value: number }
  unit?: string
  unitMode?: 'none' | 'required' | 'convertible'
  sigFigs?: number
}

export type MathKeyboardLayer = 'basic' | 'letters' | 'fraction' | 'symbols' | 'greek' | 'unit' | 'chem'

export interface MathQuestion extends QuestionBase {
  kind: 'math'
  /** LaTeX 문자열, 복수 정답 허용 */
  answer?: string[]
  keyboards: MathKeyboardLayer[]
  compareMode: 'normalized' | 'symbolic'
}

/** 화학식 버튼 입력 — 자동 첨자 변환 없음 (사용자 지시, docs/DECISIONS.md 참고) */
export interface ChemQuestion extends QuestionBase {
  kind: 'chem'
  answer?: string[]
}

export interface DrawingQuestion extends QuestionBase {
  kind: 'drawing'
  /** 밑그림 이미지 URL (모눈종이, 도해 등) */
  background?: string
  tools: ('pen' | 'line' | 'eraser')[]
}

export interface PhotoQuestion extends QuestionBase {
  kind: 'photo'
  maxFiles: number
}

export interface DataTableColumn {
  key: string
  label: string
  type: 'number' | 'text' | 'computed'
  /** type: 'computed'일 때 lib/formula.ts로 평가할 수식 (eval 금지 — 안전한 파서로 계산) */
  formula?: string
  unit?: string
}

export interface DataTableQuestion extends QuestionBase {
  kind: 'dataTable'
  columns: DataTableColumn[]
  rowCount: number
  /** 데이터표는 정오답 개념이 없는 탐구 활동 문항이다 — 그래프는 표시만 하고 채점하지 않는다 */
  chart?: {
    type: 'scatter' | 'line' | 'bar'
    x: string
    y: string[]
    trendline?: boolean
    errorBar?: string
  }
}

export type Question =
  | ClozeQuestion
  | ChoiceQuestion
  | ShortQuestion
  | ComboQuestion
  | OrderQuestion
  | MatchQuestion
  | NumericQuestion
  | MathQuestion
  | ChemQuestion
  | DrawingQuestion
  | PhotoQuestion
  | DataTableQuestion

export type QuestionKind = Question['kind']
