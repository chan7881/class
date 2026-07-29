# 과학 수업용 인터랙티브 학습지 도구 — 구현 계획

> **이 문서가 계획의 단일 원본(single source of truth)이다.**
> 최초 작성: 2026-07-28 · 상태: 승인 대기 (구현 미착수)
> 다른 세션에서 이어서 작업할 때는 이 문서와 `docs/PROGRESS.md`를 함께 읽을 것.

## Context

교사가 Notion처럼 블록을 쌓아 슬라이드형 학습지를 만들고, 학생이 모바일/PC에서 슬라이드를 넘기며 문제를 풀고, 교사가 그 답안을 엑셀로 수합하는 웹 도구를 만든다. 작업 디렉터리는 현재 비어 있는 신규 프로젝트다.

해결하려는 문제: 교사가 만든 학습 자료(PPT/학습지)와 학생 응답 수합(구글폼)이 분리되어 있어, "읽고 → 바로 답하고 → 다음으로" 이어지는 탐구형 수업 흐름이 끊긴다. Rubin Observatory의 Investigations처럼 자료와 문항이 한 흐름에 섞인 형태를 만들되, 교사가 코딩 없이 저작할 수 있게 하고 **과학 수업에 특화**한다.

### 확정된 결정 사항 (사용자 승인 완료)
- 백엔드: GitHub Pages 정적 SPA + Google Apps Script 웹앱 + Google Drive/Sheets
- 배포 모델: **중앙 배포 1개** — 운영자 계정에 Apps Script를 한 번만 배포, 모든 교사가 공유
- 스택: React + Vite + TypeScript
- 학생 식별: 수업 코드 + 이름/학번 입력 (로그인 없음)
- 그래프: 교사 데이터 → 차트 **AND** 학생 입력 데이터 → 실시간 그래프
- 채점: 정답 설정 + 자동 채점, 정오답 즉시 공개 여부는 **수업 기본값 + 문항별 덮어쓰기**
- 교사 **미리보기 + 테스트 모드** 포함
- 영상 블록: **URL 붙여넣기 + 구간 재생** (시청 강제·중간질문은 범위 밖)
- 과학 특화: 수식 입력, 허용오차·유효숫자 채점, 단위 판정, 화학식 버튼 입력, 사진 업로드 답안, 데이터표 자동계산·추세선, 그리기 답안, 참고자료 패널, 학급 응답 집계 공유, POE 잠금, 조건 분기(4-1/4-2 번호)
- **Node.js 미설치** → `winget install OpenJS.NodeJS.LTS`로 설치 (승인됨)
- **새 GitHub 리포지토리** 생성 후 푸시 (gh CLI가 없으므로 리포 생성은 사용자가 github.com에서 직접, 이후 remote 연결·푸시는 내가 처리)
- 이 사이트는 수업 후 **지속적으로 수정·개선**되며, **다른 세션에서도 이어서 작업**할 수 있어야 한다 → 아래 「세션 간 연속성」 항목이 0단계다

### 입력 방식에 대한 핵심 제약 (사용자 지시)
> **학생은 LaTeX 문법을 모른다고 가정한다.** 수식·화학식은 전부 **버튼**으로 입력할 수 있어야 하고, 화학식 첨자는 자동 변환이 아니라 명시적인 위/아래첨자 버튼으로 넣는다.

이 제약이 수식 관련 라이브러리 선택을 결정한다 → **MathLive** (시각적 수식 편집 + 커스터마이즈 가능한 가상 버튼 키보드, 출력은 LaTeX). 학생은 버튼만 누르고, 저장되는 값은 LaTeX 문자열이다.

---

## 아키텍처

```
┌─ GitHub Pages (정적 SPA, HashRouter) ──────────────────┐
│  /#/                  홈: 수업코드 입력 / 교사 시작      │
│  /#/editor/:code      교사 블록 에디터 (+미리보기 토글)  │
│  /#/play/:code        학생 슬라이드 플레이어             │
│  /#/play/:code?test=… 교사 테스트 모드 (동일 코드 재사용)│
│  /#/results/:code     교사 결과 대시보드 + 엑셀 내려받기 │
└───────────────────┬────────────────────────────────────┘
                    │ fetch POST
                    │ Content-Type: text/plain;charset=utf-8  ← CORS preflight 회피 (필수)
                    ▼
┌─ Apps Script 웹앱 (운영자 계정, "모든 사용자" 액세스) ──┐
│  doPost({action,...}) → LockService → Drive/Sheets      │
│  CacheService: 집계 응답 10초 캐시                       │
└───────────────────┬─────────────────────────────────────┘
                    ▼
┌─ 운영자 Google Drive ───────────────────────────────────┐
│  /InteractiveClass/lessons/<CODE>.json     수업 정의     │
│  /InteractiveClass/media/<CODE>/…          교사 이미지   │
│  /InteractiveClass/uploads/<CODE>/…        학생 사진·그림│
│  /InteractiveClass/responses/<CODE>        스프레드시트  │
│      "responses" 시트 · "_test" 시트 · "_meta" 시트      │
│  /InteractiveClass/_index                  코드↔파일 매핑│
└─────────────────────────────────────────────────────────┘
```

### 중앙 배포에 따른 필수 대응
1. **동시 실행 충돌** → 모든 쓰기 경로에서 `LockService.getScriptLock().waitLock(20000)`. 응답은 `studentKey` 기준 행 upsert.
2. **개인정보 집중** → 학생 이름·**사진·그림**이 전부 운영자 계정 Drive에 쌓인다. 대응: 수업 생성 시 식별 필드 선택(학번만/익명 가능), 사진 업로드 문항이 있으면 교사에게 경고 배너 표시, 학생 입장 화면에 데이터 보관 주체 명시, 교사용 **수업 데이터 완전 삭제** 버튼(수업 JSON + 미디어 + 학생 업로드 + 응답 시트 일괄 삭제), 수업별 자동 만료(기본 180일) 옵션.
3. **소유권 검증 (로그인 없음)** → 서버가 `code`(학생용 6자, 혼동문자 I·O·L·0·1 제외)와 `editToken`(32자 난수)을 발급하고 `sha256(editToken)`만 저장. 편집·결과조회·테스트모드는 `editToken` 필수. 교사 브라우저 localStorage 보관 + **교사용 복구 링크**를 발행 화면에 크게 노출(복사 버튼, 분실 시 복구 불가 경고).

### 응답 스프레드시트 스키마
`responses` 시트 — 1행 헤더, 학생 1명 = 1행.

| studentKey | 학번 | 이름 | 시작시각 | 제출시각 | 진행경로 | Q1_답 · Q1_정오 · Q1_점수 · Q2_답 … |
|---|---|---|---|---|---|---|

- `studentKey = sha1(code + 식별필드값)` — 재접속 시 덮어쓰기용
- `진행경로` — 조건 분기로 실제 통과한 슬라이드 순서(예: `1,2,3,4,4-1,5`)
- 사진·그림 답안은 Drive 공유 URL 문자열로 기록 (엑셀에서 클릭 가능)
- 데이터표 답안은 CSV 문자열, 수식 답안은 LaTeX 문자열
- 서답형은 정오답 열을 비워 교사 수기 채점용으로 남긴다
- 별도 `_meta` 시트에 `문항ID ↔ 열 인덱스` 매핑을 저장해, 교사가 나중에 문항을 추가해도 기존 열이 밀리지 않게 한다
- 교사 테스트 모드 응답은 `_test` 시트로 분리 저장되어 통계·엑셀에서 제외된다

---

## 데이터 모델 (`src/types/lesson.ts`)

```ts
type Lesson = {
  version: 1
  code: string
  title: string; description?: string
  accent: string                                   // 단색 강조색 (기본 #2563eb)
  settings: {
    requireAnswerToAdvance: boolean                // 기본 true
    allowBackNavigation: boolean
    feedbackMode: 'never' | 'immediate' | 'onFinish'
    identityFields: ('grade'|'klass'|'number'|'name')[]
    shuffleChoices: boolean
    referencePanel: { enabled: boolean; tabs: ('periodic'|'constants'|'units'|'custom')[]; customHtml?: string }
  }
  slides: Slide[]
  updatedAt: string
}

type Slide = {
  id: string
  title?: string
  isSub: boolean                                   // true면 직전 메인 슬라이드의 하위 → "4-1" 표기
  blocks: Block[]
  branch?: {                                       // 조건 분기
    questionId: string
    rules: { when: 'correct'|'incorrect'|`choice:${string}`; goTo: string }[]
    default?: string
  }
}
```

**블록**
```ts
type Block =
  | { id; type:'text';    html: string }            // TipTap (인라인 수식·첨자 포함)
  | { id; type:'heading'; level: 1|2|3; text: string }
  | { id; type:'image';   src; alt; caption?; width:'full'|'half' }
  | { id; type:'video';   provider:'youtube'|'vimeo'|'file'; url; start?:number; end?:number;
                          loop:boolean; autoplay:boolean; caption? }
  | { id; type:'callout'; tone:'info'|'tip'|'warn'; html }
  | { id; type:'divider' }
  | { id; type:'embed';   url }                     // GeoGebra/PhET 등 화이트리스트 iframe (최소 구현)
  | { id; type:'chart';   spec: ChartSpec }         // 교사 데이터 → 차트
  | { id; type:'poeGroup'; predictId; observeIds: string[]; explainId }   // 예측-관찰-설명 묶음
  | { id; type:'question'; q: Question }
```

**문항**
```ts
type QuestionBase = {
  id; prompt: string                               // 리치텍스트(수식 포함)
  required: boolean; points: number
  explanation?: string
  feedbackOverride?: 'never'|'immediate'|'onFinish'
  shareClassResponses?: boolean                    // 학급 응답 집계 공유 켜기
  lockAfterSubmit?: boolean                        // POE 예측 문항용 잠금
}

type Question = QuestionBase & (
  | { kind:'cloze';  segments: ({t:'text',v} | {t:'blank', mode:'input'|'select', options?, answer?})[] }
  | { kind:'choice'; options:{id,label}[]; multiple:boolean; answer?: string[] }
  | { kind:'short';  rows:number; answer?: string[]; matchMode?:'exact'|'contains' }
  | { kind:'combo';  statements:{id,label}[]; options:{id,label,set:string[]}[]; answer?: string }
  | { kind:'order';  items:{id,label}[]; answer?: string[] }
  | { kind:'match';  left:{id,label}[]; right:{id,label}[]; answer?: [string,string][] }

  // ── 과학 특화 ──────────────────────────────────────────────
  | { kind:'numeric'; answer?: number; tolerance?: {mode:'abs'|'pct', value:number}
                    ; unit?: string; unitMode?: 'none'|'required'|'convertible'
                    ; sigFigs?: number }                       // 허용오차·유효숫자·단위 채점
  | { kind:'math';    answer?: string[]                        // LaTeX 복수 정답
                    ; keyboards: ('basic'|'letters'|'fraction'|'symbols'|'greek'|'unit'|'chem')[]
                    ; compareMode: 'normalized'|'symbolic' }   // symbolic은 Compute Engine 지연 로드
  | { kind:'chem';    answer?: string[] }                      // 버튼 기반 화학식 입력
  | { kind:'drawing'; background?: string; tools: ('pen'|'line'|'eraser')[] }   // 스케치 답안
  | { kind:'photo';   maxFiles: number }                       // 사진 업로드 답안
  | { kind:'dataTable';                                        // 데이터표 자동계산 + 추세선
      columns: { key; label; type:'number'|'text'|'computed'; formula?: string; unit?: string }[]
      rowCount: number; seed?: (string|number)[][]
      chart?: { type:'scatter'|'line'|'bar'; x:string; y:string[]
              ; trendline?: boolean; errorBar?: string }
      answerTargets?: { slope?: number; intercept?: number; tolerance?: number } }
)
```

---

## 과학 특화 기능 설계

### 1. 수식 입력 — 버튼만으로 (`mathlive`)
- **교사 본문**: TipTap 커스텀 인라인 노드 `mathInline`. 툴바 `∑` 버튼 → MathLive `<math-field>` 팝오버로 편집, 저장은 LaTeX, 표시는 KaTeX(경량 렌더).
- **학생 답안** (`kind:'math'`): MathLive math-field + **커스텀 가상 키보드**. 시스템 키보드를 띄우지 않고 항상 버튼 키보드를 쓴다. 교사가 문항별로 켤 키보드 레이어를 고른다:
  - `basic` — 숫자, `+ − × ÷ = ( )`, 지수, 아래첨자
  - `letters` — 영문 대소문자 (물리 키보드 없이도 변수명을 입력할 수 있게, 2026-07-29 추가)
  - `fraction` — 분수, 루트, n제곱근, 절댓값, 로그, 지수함수
  - `symbols` — 부등호(≤ ≥ ≠)·근사/동치(≈ ≡ ≃ ≅ ≑ ∝ ∼)·±∓·집합/논리(∈ ∉ ⊂ ⊃ ∀ ∃ ∅)·기하(∠ ⊥ ∥)·미적분(∑ ∫ ∂ lim)·화살표(→ ⇒ ⇔)·∴ ∵ (2026-07-29 추가, 사용자 요청)
  - `greek` — α β γ Δ θ λ μ π ρ σ ω
  - `unit` — m, s, kg, N, J, W, Pa, mol, ℃, K, 상용 조합 단위
  - `chem` — 아래 3번과 동일한 화학 기호 세트
- **채점** (`lib/grade.ts`):
  - `normalized`(기본) — 공백·`\left\right`·중복 중괄호 제거 후 문자열 비교 + 교사가 등록한 복수 정답 대조
  - `symbolic`(옵션) — `@cortex-js/compute-engine`을 **동적 import**해 `ce.parse(a).isSame(ce.parse(b))`로 동치 판정. 번들 크기가 커서 이 모드를 쓰는 문항이 있을 때만 로드.

### 2. 수치 답안 — 허용오차·유효숫자·단위 (`kind:'numeric'`)
- 입력 UI: 숫자 칸 + (단위 사용 시) 단위 칸. 단위 칸은 **드롭다운 + 자주 쓰는 단위 버튼**으로 제공해 오타를 막는다. 지수 표기는 `×10^` 버튼.
- 채점 순서: ① 값 파싱(`3.0e8`, `3.0×10^8` 모두 허용) → ② 단위 정규화 → ③ 허용오차 판정 → ④ 유효숫자 자릿수 판정.
- 단위 정규화는 **소규모 단위 레지스트리**를 직접 구현한다(SI 접두어 + 기본 7단위 + 자주 쓰는 유도단위 N·J·W·Pa·V·Ω·C·Hz·L·mol/L·m/s·m/s²). 범용 차원해석 엔진은 만들지 않는다 — 과잉 구현이다.
- `unitMode:'convertible'`이면 1 km = 1000 m처럼 환산해 맞다고 처리, `'required'`면 단위까지 정확히 일치해야 한다.

### 3. 화학식 — 자동변환 없이 버튼으로 (`kind:'chem'`)
- 입력칸 위 고정 툴바: `X₂`(아래첨자 토글) · `X²`(위첨자 토글) · `→` · `⇌` · `Δ` · `·` · `⁺` · `⁻` · `(s) (l) (g) (aq)`
- 첨자는 토글 버튼을 누른 뒤 타이핑하는 방식(누르는 순간 커서 이후 입력이 첨자로 들어감). H2O를 자동으로 H₂O로 바꾸는 동작은 **하지 않는다.**
- 교사 본문도 동일하게 TipTap Subscript/Superscript 버튼으로 처리.
- 채점 정규화: 공백 제거, 유니코드 첨자 ↔ 일반 문자 통일, `->` ↔ `→` 통일, 계수 `1` 생략 허용.

### 4. 그리기 답안 (`kind:'drawing'`)
- HTML Canvas + Pointer Events(터치·펜·마우스 통합). 도구: 펜(굵기 3단계), 직선(작도용), 지우개, 색 6종, 실행취소, 전체 지우기.
- 교사가 **밑그림 이미지**를 배경으로 깔 수 있다(모눈종이, 광학 도해, 지도 등).
- 저장은 스트로크 JSON + 렌더 PNG 두 가지를 함께 보관 — JSON은 학생이 나중에 이어서 수정할 수 있게, PNG는 교사가 바로 볼 수 있게.
- 화면 회전·리사이즈 시 좌표가 깨지지 않도록 스트로크는 정규화 좌표(0~1)로 저장한다.

### 5. 사진 업로드 답안 (`kind:'photo'`)
- `<input type="file" accept="image/*" capture="environment">` — 모바일에서 카메라가 바로 열린다.
- 클라이언트에서 최대 1600px·JPEG 0.82로 리사이즈(원본 10MB까지 허용, 리사이즈 후 2MB 초과 시 거부) → Apps Script `uploadStudentMedia` → Drive 저장 → URL 반환.
- 결과 화면에서 썸네일 격자로 보고, 엑셀에는 URL이 들어간다.

### 6. 데이터표 자동계산·추세선 (`kind:'dataTable'`)
- 열 유형: 측정값 열(학생 입력) / 계산 열(교사가 수식 지정).
- 계산 수식은 **직접 만든 안전한 미니 파서**로 평가한다. `eval`·`Function` 생성자는 쓰지 않는다. 지원: `+ - * / ^ ( )`, 열 참조(`A`,`B`…), 함수 `avg sum min max count stdev abs sqrt log ln`.
- 차트: 산점도/꺾은선/막대 + **선형 회귀 추세선**(기울기·절편·R² 표시) + 오차막대(열 지정). 학생이 값을 입력하는 즉시 다시 그려진다.
- `answerTargets`로 기울기·절편 자체를 허용오차 안에서 자동 채점할 수 있다(예: "그래프의 기울기가 중력가속도").

### 7. 참고자료 패널
- 화면 우하단 플로팅 버튼 → 드로어(모바일은 바텀시트). 슬라이드를 벗어나지 않고 언제든 연다.
- 탭: **주기율표**(원소 클릭 시 상세 정보, 118종 한국어 명칭 포함 정적 JSON을 번들) · **과학 상수표** · **단위 환산기**(위 단위 레지스트리 재사용) · **교사 커스텀 자료**(리치텍스트).
- 교사가 수업별로 패널 표시 여부와 켤 탭을 고른다.

### 8. 학급 응답 집계 공유
- Apps Script `getAggregate(code, questionId)` — 응답 시트를 읽어 **집계만** 반환(이름·학번 절대 미포함).
- 학생이 답을 제출한 뒤, `shareClassResponses`가 켜진 문항이면 아래에 분포가 나타난다: 선택형·합답형은 막대, 수치형은 히스토그램, 서답형은 짧은 답안 익명 목록.
- 폴링은 **해당 문항이 화면에 보일 때만** 10초 간격(IntersectionObserver로 제어), 화면을 벗어나면 즉시 중단. 서버는 `CacheService`로 10초 캐시해 중앙 배포 부하를 막는다.

### 9. 예측-관찰-설명(POE) 잠금
- `poeGroup` 블록이 예측 문항 1개 + 관찰 블록 여러 개 + 설명 문항 1개를 묶는다.
- 예측을 제출하면 **잠긴다** — 입력 비활성 + 자물쇠 아이콘 + "예측은 수정할 수 없어요" 안내. 관찰·설명 단계는 예측 제출 후에 열린다.
- 서버도 `lockedAt`이 찍힌 예측 답안의 재수정을 거부한다(개발자도구로 우회 방지).
- 마지막 요약 화면에서 **내 예측 vs 내 설명**을 나란히 보여줘 개념 변화를 스스로 확인하게 한다.

### 10. 조건 분기 + 4-1 / 4-2 슬라이드 번호
- 에디터에서 슬라이드를 **"보조 슬라이드"** 로 지정하면 직전 메인 슬라이드의 하위가 되어 `4-1`, `4-2`로 번호가 자동 매겨진다(`lib/numbering.ts`가 슬라이드 배열에서 매번 재계산 — 번호를 데이터에 저장하지 않는다).
- 슬라이드 하단에 분기 규칙을 설정한다: "1번 문항이 **틀리면** → 4-1(보충)", "**맞으면** → 5", 보기별 분기도 가능.
- 진행 바는 **메인 슬라이드 기준**으로 계산해 보조 슬라이드로 빠져도 진행률이 요동치지 않게 하고, 현재 위치는 `4-1`로 표시한다.
- 분기로 건너뛴 슬라이드의 문항은 미응답 검사에서 제외한다(`lib/validate.ts`).
- 에디터가 **순환 분기**와 **도달 불가 슬라이드**를 검사해 경고를 띄운다.

---

## 교사 미리보기 / 테스트 모드 (2단계로 분리)

**① 미리보기 — 에디터 내 토글**
현재 편집 중인 슬라이드를 학생 화면 그대로 렌더한다. 저장·제출·채점 기록 없음. 상단에서 **모바일(390×844) / 데스크톱** 프레임을 전환해 모바일 레이아웃을 즉시 확인한다. 플레이어 컴포넌트를 읽기 전용 모드로 그대로 재사용한다.

**② 테스트 모드 — `/#/play/:code?test=<editToken>`**
처음부터 끝까지 학생과 **완전히 동일한 흐름**으로 진행한다. 다만:
- 상단에 눈에 띄는 `테스트 모드` 배너 + `처음부터 다시` 버튼
- 응답은 `_test` 시트에 저장되고 통계·엑셀 수합에서 **제외**된다
- 테스트 모드에서만 쓸 수 있는 도구: `정답 보기` 토글, `잠금 무시하고 넘기기`(진행 잠금·POE 잠금이 걸리는지 확인한 뒤 빠르게 통과), 하단에 현재 통과한 **분기 경로** 표시
- 이 링크는 `editToken`을 담고 있으므로 학생에게 주면 안 된다는 경고를 함께 노출

---

## 화면 설계

### 홈 (`/#/`)
- 학생용 수업 코드 입력 + "참여하기" / 교사용 "새 수업 만들기"·"수업 파일(.json) 가져오기"·**"QR코드 생성하기"**(2026-07-29 추가, 사용자 지적: 입장 코드 없이 QR/직접입장 링크를 만드는 기능이 에디터 화면 안에 묻혀 있어 찾기 어려웠다 — 홈 화면에서 수업 코드만 입력하면 바로 QR·링크를 보여주도록 전면 배치). QR 썸네일을 누르면 화면 전체를 채우는 확대 오버레이(`components/QrCode.tsx`, 에디터의 "학생 참여 링크" QR과 동일 컴포넌트 재사용).
- 맨 아래 "관리자" 링크(`/#/admin`).

### 교사 에디터 (`/#/editor/:code`) — Notion식 입력 UI
- **레이아웃**: 좌 슬라이드 목록(드래그 재정렬·복제·삭제·보조슬라이드 지정) / 중앙 캔버스 / 우 선택 블록 속성 패널. 모바일에서는 좌·우가 바텀시트로 전환.
- **블록 추가**: 빈 문단에서 `/` → 슬래시 커맨드 팔레트. 블록 왼쪽 hover 시 `⊕`·`⠿` 핸들. 재정렬은 `@dnd-kit`.
- **리치텍스트**: TipTap(ProseMirror). contentEditable을 직접 구현하지 않는다. 확장: Bold, Italic, Underline, Strike, TextStyle+FontFamily, FontSize(커스텀), Color, Highlight, TextAlign, 목록, Link, **Subscript/Superscript**(화학식·단위용), **mathInline**(커스텀). 텍스트 선택 시 플로팅 버블 툴바.
- **이미지**: 드래그앤드롭·붙여넣기 → 클라이언트 리사이즈 → Apps Script 업로드. URL 직접 입력도 지원.
- **영상**: URL을 붙여넣으면 YouTube/Vimeo/mp4를 자동 판별. 시작·종료 시각(`1:30`~`3:05` 형식 입력), 반복, 자동재생, 캡션 설정. 편집 화면에서도 실제 플레이어로 구간을 확인할 수 있다.
- **저장**: 3초 디바운스 자동저장 + 상단 저장 상태 표시. `발행`으로 학생 접속 활성화.

### 학생 플레이어 (`/#/play/:code`) — Rubin Investigations 참고
- 입장: 수업 제목·설명·예상 소요시간 + 교사가 지정한 식별 필드 입력 + 데이터 보관 안내.
- 한 화면 = 한 슬라이드. 상단 얇은 진행 바 + `4-1 / 12`. 하단 고정 `이전 / 다음`. 우하단 참고자료 버튼.
- **진행 잠금**: 필수 미응답 문항이 있으면 `다음` 비활성 + 첫 미응답 문항으로 스크롤 + 붉은 테두리 + 안내 토스트.
- **피드백**: `feedbackMode`에 따라 즉시 ✓/✗+해설 / 마지막에 일괄 / 미공개.
- **자동저장·복구**: 입력 즉시 localStorage, 5초 디바운스로 서버 동기화. 새로고침·네트워크 끊김·기기 변경 시 같은 식별정보로 이어서 진행.
- 마지막 → 요약 화면(응답 확인, 점수(설정 시), POE 예측↔설명 비교, 제출 완료).

### 교사 결과 (`/#/results/:code`)
요약 카드(접속·제출·평균점수·평균 소요시간) / 문항별 정답률 및 보기별 분포 / 학생별 답안 표(모바일은 카드) / 사진·그림 답안 썸네일 격자 / 서답형 모아보기 / **SheetJS로 `.xlsx` 클라이언트 생성** + 원본 Google Sheet 링크 / 데이터 완전 삭제.

### 디자인 원칙
단색 강조색 1개 + 중성 회색 스케일, 배경 흰색/`#fafafa`, 1px 테두리, 그림자 최소. Pretendard(fallback `system-ui`), 본문 16px↑, 행간 1.7. 터치 타깃 44px↑, 하단 고정 바에 `env(safe-area-inset-bottom)`. 모바일 우선 3단계 반응형. 다크모드는 `prefers-color-scheme` 대응.

---

## 세션 간 연속성 · 장기 유지보수 체계

이 사이트는 수업을 하면서 계속 고쳐 나갈 물건이고, 작업이 여러 세션에 걸쳐 이어진다. **다음 세션의 나(또는 다른 사람)가 대화 기록 없이도 곧바로 이어서 작업할 수 있는 상태**를 코드와 함께 리포지토리 안에 남긴다.

### 리포지토리에 남기는 인계 문서

| 파일 | 역할 | 갱신 시점 |
|---|---|---|
| `CLAUDE.md` (루트) | **모든 세션에서 자동으로 읽히는 파일.** 프로젝트 목적 1문단, 확정 결정 요약, 스택, 디렉터리 지도, 개발·검증 명령, 코드 규칙(레지스트리 패턴·`eval` 금지·정답 서버 제거 등), 그리고 맨 위에 **"작업 시작 전 `docs/PROGRESS.md`를 먼저 읽을 것"** 지시 | 규칙·구조가 바뀔 때 |
| `docs/PLAN.md` | **이 문서.** 계획 전문 (단일 원본) | 계획이 바뀔 때 |
| `docs/PROGRESS.md` | **11단계 체크리스트 + 현재 위치 + 다음에 할 일 + 미해결 이슈 + 임시방편(TODO) 목록** | 매 작업 종료 시 |
| `docs/DECISIONS.md` | ADR 형식. 결정 / 이유 / **검토했으나 버린 대안과 그 이유** — 나중에 "왜 이렇게 했지?"로 되돌아가 같은 논의를 반복하지 않기 위함 | 결정이 생길 때마다 추가 |
| `docs/SESSION_LOG.md` | 세션별 3~5줄 요약(날짜 / 한 일 / 다음 세션이 알아야 할 것) | 매 세션 종료 시 |
| `docs/OPERATIONS.md` | Apps Script 배포 URL·배포 절차·Drive 폴더 위치·GitHub Pages 설정·장애 대응(할당량 초과, 배포 URL 변경, 응답 시트 복구) | 운영 설정이 바뀔 때 |
| `docs/TEACHER_GUIDE.md` | 교사용 사용법 | 기능 추가 시 |
| `apps-script/SETUP.md` | 운영자용 백엔드 1회 배포 절차 | 백엔드 변경 시 |

### Claude 메모리
프로젝트 메모리 파일을 `memory/`에 기록하고 `MEMORY.md`에 한 줄 인덱스를 추가한다 — 리포지토리를 열기 전 단계에서도 이 프로젝트의 맥락이 자동으로 떠오르게 하기 위함이다.
- `interactive-class-project.md` (type: project) — 프로젝트 정체·리포 경로·`docs/PROGRESS.md`를 먼저 보라는 지침
- `interactive-class-backend.md` (type: reference) — Apps Script 배포 URL, 스프레드시트/Drive 위치
- 학생 입력은 버튼 기반이어야 한다는 사용자 지시는 `feedback` 타입으로 별도 기록

### Git 규칙
- 0단계에서 `git init` → `.gitignore`(`node_modules`, `dist`, `.env.local`, `*.local`) → 첫 커밋
- **구현 단계마다 1커밋 이상**, 커밋 메시지 첫 줄에 단계 번호를 남겨(`[4] 기본 문항 6종 구현`) 나중에 이력만 봐도 진행 상황이 읽히게 한다
- 사용자가 github.com에서 빈 리포를 만들면 `git remote add origin` 후 푸시. 이후 단계 완료 시마다 푸시해 백업을 유지한다
- **비밀값은 절대 커밋하지 않는다** — Apps Script 배포 URL은 `.env.local`(gitignore)에 두고, `.env.example`에 키 이름만 남긴다. 교사 `editToken`은 어떤 파일에도 기록하지 않는다

### 제품 자체의 유지보수성 (중요)
사이트를 계속 고치면 **이미 만들어 둔 수업 데이터가 깨질 수 있다.** 처음부터 방어한다.
- **스키마 버전 + 마이그레이션** — `Lesson.version` 필드는 이미 모델에 있다. `lib/migrate.ts`에 `v1→v2→v3…` 변환 함수를 누적하고, 수업을 불러올 때 항상 통과시킨다. 옛 수업이 열리지 않는 상황을 만들지 않는다. 마이그레이션 함수마다 Vitest 픽스처를 붙인다.
- **수업 내보내기 / 가져오기 / 복제** — 교사가 수업을 `.json` 파일로 내려받고 다시 올릴 수 있게 한다. 백엔드 사고나 계정 문제에 대한 최후의 백업이자, 교사끼리 수업을 공유하고 다음 학년도에 재사용하는 수단이다. (제품 기능이자 유지보수 안전장치)
- **`blocks/registry.ts` 패턴 유지** — 기능 추가가 파일 하나 추가로 끝나는 구조를 계속 지킨다. 새 문항 유형을 추가하며 `switch` 문을 여기저기 늘리기 시작하면 유지보수가 무너진다. `CLAUDE.md`에 이 규칙을 명시한다.
- **순수 함수 + 단위 테스트** — 채점·단위·유효숫자·분기·번호 계산 로직은 UI에서 분리해 테스트로 고정한다. 나중에 수정할 때 회귀를 막아주는 유일한 안전망이다.

---

## 파일 구조

```
interactive class/
├─ CLAUDE.md                              ★ 모든 세션에서 자동 로드되는 인계 문서
├─ index.html  package.json  vite.config.ts  tsconfig.json
├─ .gitignore  .env.example               (.env.local은 커밋 금지)
├─ .github/workflows/deploy.yml            GitHub Pages 자동 배포
├─ apps-script/  Code.gs  appsscript.json  SETUP.md
├─ docs/
│   ├─ PLAN.md          이 계획서 전문 (단일 원본)
│   ├─ PROGRESS.md      ★ 단계 체크리스트·현재 위치·다음 할 일·미해결 이슈
│   ├─ DECISIONS.md     ADR (결정·이유·버린 대안)
│   ├─ SESSION_LOG.md   세션별 요약
│   ├─ OPERATIONS.md    배포 URL·절차·장애 대응
│   └─ TEACHER_GUIDE.md
└─ src/
   ├─ main.tsx  App.tsx  routes.tsx
   ├─ types/lesson.ts                      데이터 모델 (전 계층 공유)
   ├─ api/client.ts                        Apps Script 호출 래퍼
   ├─ api/mock.ts                          localStorage 목 백엔드
   ├─ store/editorStore.ts  playerStore.ts (Zustand, undo/redo)
   ├─ lib/
   │   ├─ grade.ts        문항 유형별 채점 (Code.gs와 로직 동기)
   │   ├─ units.ts        단위 레지스트리·환산·정규화
   │   ├─ sigfigs.ts      유효숫자 판정
   │   ├─ formula.ts      데이터표 계산 열 안전 파서 (eval 금지)
   │   ├─ regression.ts   선형회귀 기울기·절편·R²
   │   ├─ numbering.ts    4 / 4-1 / 4-2 번호 계산
   │   ├─ navigate.ts     조건 분기 다음 슬라이드 결정 + 순환 검사
   │   ├─ validate.ts     진행 가능 여부 판정
   │   ├─ chemNormalize.ts / mathNormalize.ts   채점용 정규화
   │   ├─ migrate.ts     수업 스키마 버전 마이그레이션 (v1→v2→…)
   │   ├─ portable.ts    수업 .json 내보내기·가져오기·복제
   │   ├─ image.ts  xlsx.ts
   ├─ data/  periodic.ts  constants.ts     주기율표·상수표 정적 데이터
   ├─ components/                          Button, Sheet, Toast, Field 등
   ├─ blocks/
   │   ├─ registry.ts                      type → 컴포넌트·기본값·아이콘 매핑
   │   ├─ TextBlock/ ImageBlock/ VideoBlock/ ChartBlock/ CalloutBlock/ EmbedBlock/ PoeGroup/
   │   └─ questions/ Cloze/ Choice/ Short/ Combo/ Order/ Match/
   │                 Numeric/ Math/ Chem/ Drawing/ Photo/ DataTable/
   ├─ math/    MathField.tsx  keyboards.ts  MathRender.tsx
   ├─ editor/  SlideList  Canvas  SlashMenu  BubbleToolbar  InspectorPanel  BranchEditor  PreviewFrame
   ├─ player/  Entry  SlideView  ProgressBar  NavBar  SummaryView  TestModeBar  ClassAggregate
   ├─ reference/ ReferenceDrawer  PeriodicTable  Constants  UnitConverter
   └─ results/ Dashboard  QuestionStats  StudentTable  MediaGallery
```

**핵심: `blocks/registry.ts`** — 모든 블록·문항이 `{ type, label, defaultData, Editor, Viewer, grade?, isAnswered?, toCell?, describeAnswer? }` 한 객체로 등록된다(12단계에서 `icon` 필드 제거 — 아래 12번 항목 참고). 새 유형을 추가할 때 파일 하나만 만들고 등록하면 슬래시 메뉴·에디터·플레이어·채점·엑셀 열 생성이 전부 따라온다. 유형별 `switch`를 여러 파일에 흩뿌리지 않는다. **문항 유형이 12종이므로 이 구조가 필수다.**

---

## Apps Script API (`apps-script/Code.gs`)

단일 `doPost(e)` 라우터, 요청·응답 모두 JSON 문자열.

| action | 인증 | 동작 |
|---|---|---|
| `createLesson` | — | code·editToken 발급, `_index` 등록 |
| `getLesson` | code | 학생용: **정답·해설 필드를 서버에서 제거**하고 반환 |
| `getLessonForEdit` | editToken | 정답 포함 전체 반환 |
| `saveLesson` / `publishLesson` | editToken | 저장 / 공개 + 응답 시트 생성 |
| `uploadMedia` | editToken | 교사 이미지·밑그림 → Drive |
| `uploadStudentMedia` | code | 학생 사진·그림 PNG → Drive |
| `saveProgress` | code | studentKey 행 upsert (부분 저장, `isTest`면 `_test` 시트) |
| `gradeAnswer` | code | 즉시 피드백용 단건 서버 채점 (정답 미반환) |
| `submitResponse` | code | 최종 제출 + 서버 전체 재채점 |
| `getAggregate` | code | 익명 집계만 반환, CacheService 10초 캐시 |
| `getResults` | editToken | 응답 전체 |
| `deleteLesson` | editToken | 수업·미디어·학생 업로드·응답 시트 완전 삭제 |
| `listLessons` / `adminGetLesson` / `adminDeleteLesson` | 운영자 비밀번호(`ADMIN_PASSWORD`) | 관리자 화면(`/#/admin`)용 — 원안(PLAN.md 최초 승인분)엔 없던 운영 편의 확장, 10단계 이후 추가. `listLessons`는 각 수업의 `responseSpreadsheetId`도 함께 내려줘 관리자 화면의 "응답 시트" 링크 버튼(발행된 수업의 학생 응답 Google Sheets를 새 탭으로 바로 열기)에 쓰인다(2026-07-29 추가) |
| `adminResetEditToken` | 운영자 비밀번호 | 서버가 editToken 평문을 저장하지 않으므로(해시만 보관), 관리자가 기존 수업을 열려면 editToken을 새로 발급해 무효화하는 수밖에 없다 — 이 호출 이후 교사가 갖고 있던 기존 편집 링크는 동작하지 않는다(2026-07-29 추가, 관리자 화면 "수정" 버튼용, `docs/DECISIONS.md` 참고) |

**정답 유출 방지**: `getLesson`이 정답을 빼고 내려주므로 즉시 채점은 `gradeAnswer` 단건 호출로 결과만 받는다. 클라이언트 `lib/grade.ts`는 목 모드·에디터 미리보기·테스트 모드에서만 쓴다. 초·중등 수준에서 충분한 방어이며 완벽하지는 않다는 점을 문서에 명시한다.

---

## 구현 단계

범위가 크므로 **6단계 끝에서 이미 쓸 수 있는 제품**이 되도록 순서를 잡았다. 과학 특화 기능은 그 위에 얹는다. **각 단계를 끝낼 때마다 `docs/PROGRESS.md`를 갱신하고 커밋·푸시한다** — 이것이 세션이 끊겨도 이어갈 수 있게 하는 실질적 장치다.

0. **환경 준비 + 세션 연속성 확보** *(가장 먼저)*
   - `winget install OpenJS.NodeJS.LTS` → 새 셸에서 `node -v` 확인
   - `git init`, `.gitignore`, `.env.example`
   - **`CLAUDE.md` + `docs/PROGRESS.md` + `DECISIONS.md` + `SESSION_LOG.md` + `OPERATIONS.md` 작성** (`docs/PLAN.md`는 이미 있음)
   - Claude 메모리 파일 3종 기록 + `MEMORY.md` 인덱스 추가
   - 첫 커밋 → 사용자가 github.com에 만든 빈 리포에 `remote add origin` 후 푸시
   - *이 단계를 마치면, 이후 어느 세션에서든 리포만 열어 이어서 작업할 수 있다*
1. **스캐폴딩** — Vite+React+TS, Tailwind v4, HashRouter, 디자인 토큰, 공통 컴포넌트, `types/lesson.ts`, `lib/migrate.ts` 뼈대
2. **목 백엔드** — `api/mock.ts`(localStorage)로 전체 API 구현. 이후 모든 UI 작업을 Apps Script 배포 없이 진행·검증
3. **블록 레지스트리 + 기본 블록** — text(TipTap)·heading·image·video·callout·divider·embed, 에디터 캔버스·슬래시 메뉴·dnd-kit·버블 툴바
4. **기본 문항 6종** — cloze·choice·short·combo·order·match (각각 Editor/Viewer/grade/isAnswered)
5. **플레이어 + 미리보기** — 입장, 슬라이드 렌더, 진행 잠금, 진행바, 자동저장·복구, 요약, feedbackMode 3종, 에디터 미리보기 토글
6. **Apps Script 백엔드** — 전 액션, LockService, `_index`, upsert, `SETUP.md`. 목 → 실제 전환. **여기서 기본 제품 완성**
7. **수식·화학·수치** — MathLive 통합, 커스텀 버튼 키보드 5종, TipTap `mathInline`, `numeric`(허용오차·유효숫자·`units.ts`), `chem`(첨자 버튼)
8. **탐구 도구** — `dataTable`(안전 파서·자동계산·추세선·오차막대), `chart`, `drawing`(캔버스·밑그림·스트로크 JSON), `photo`. **차트 코드 작성 전 `dataviz` 스킬을 먼저 로드**해 색상·축·범례 규칙을 따른다
9. **수업 운영** — 조건 분기 + 4-1/4-2 번호, POE 잠금, 학급 응답 집계 공유, 참고자료 패널(주기율표·상수·단위환산)
10. **결과 대시보드 + 엑셀** — 통계, 학생별 답안, 미디어 갤러리, SheetJS `.xlsx`, 데이터 삭제, **수업 내보내기·가져오기·복제**(`portable.ts`)
11. **테스트 모드 + 마감** — 테스트 모드 전용 도구, 모바일 QA, 교사용 링크 복구 안내, 빈 상태·오류·오프라인 처리, `TEACHER_GUIDE.md` 완성, GitHub Actions 배포, `OPERATIONS.md`에 실제 배포 URL 기록
12. **디자인 재정돈 — 이모지/아이콘 정리** *(사용자 지시로 마지막에 추가, 2026-07-28)* — 지금까지 블록·문항 슬래시 메뉴(`icon` 필드)와 버튼·배너 곳곳에 광범위하게 써온 이모지(⭕📄🧩🔢🔗🔬∑⚗️📈✏️📷🔒📊📚⚠️⤷⧉ 등)를 걷어낸다. CLAUDE.md/PLAN.md의 "단색 강조색 1개 + 중성 회색, 그림자 최소" 심플 디자인 원칙과 어긋난다는 지적(`docs/DECISIONS.md`, `memory/interactive-class-icon-policy.md` 참고). 텍스트 라벨로 대체하거나, 꼭 필요한 소수의 경우에만 단색 SVG 아이콘을 새로 만들어 쓴다. 0~11단계에서 쓴 모든 이모지를 전수 조사해 정리하는 전체 재작업 — 다른 단계보다 뒤에, 기능이 다 완성된 뒤 마지막으로 진행한다.

**주요 의존성**: `react-router-dom`, `zustand`, `@tiptap/react`+확장, `@dnd-kit/core`+`sortable`, `recharts`, `mathlive`, `katex`, `xlsx`, `nanoid`, `tailwindcss@4`. (`@cortex-js/compute-engine`은 동적 import 전용)

---

## 검증

**단계별 (목 백엔드, 로컬)**
```
npm run dev          # VITE_API_MODE=mock
npm run typecheck    # tsc --noEmit — 단계마다 통과 확인
npm run test         # vitest
```
순수 함수는 Vitest 단위 테스트를 붙인다 — `grade.ts`(12종 채점), `units.ts`(환산·정규화), `sigfigs.ts`, `formula.ts`(파서, **`eval` 미사용 및 악의적 입력 거부 확인**), `regression.ts`, `numbering.ts`(4-1 번호), `navigate.ts`(분기·순환 검사), `validate.ts`, `chemNormalize.ts`/`mathNormalize.ts`. 나머지는 브라우저 확인.

**엔드투엔드 (claude-in-chrome, 390×844 및 1440×900 각각)**
1. 홈 → 수업 만들기 → `/`로 텍스트·이미지·영상·차트 및 문항 12종을 각각 추가
2. 텍스트 굵게/기울임/글꼴/크기, 본문에 인라인 수식 삽입, 블록 드래그 재정렬, 슬라이드 5장 구성
3. 영상 블록에 YouTube URL + 구간(1:30~2:00) 지정 → 지정 구간에서 시작·정지하는지 확인
4. 슬라이드 4에 분기 설정(오답 → 4-1 보충), 4-1을 보조 슬라이드로 지정 → 목록·진행바에 `4-1`로 표시되는지 확인
5. 1번 문항 `immediate`, 2번 `never`로 설정 후 발행 → 수업 코드 확보
6. **미리보기 토글**로 모바일 프레임 확인 → **테스트 모드**로 전 슬라이드 통과, 분기 경로 표시 확인
7. 시크릿 창에서 `/#/play/<code>` → 답 없이 `다음` 클릭 시 **차단되는지 확인** → 답 입력 후 진행 → `immediate` 문항만 정오답이 보이는지 확인
8. 수식 문항을 **키보드 없이 버튼만으로** 입력해 정답 처리되는지, 화학식 첨자 버튼이 동작하는지 확인
9. 수치 문항에 `9.7`(정답 9.8 ±0.2), `9.8 km/s²`(단위 오류), `9.80000`(유효숫자 초과)을 넣어 각각 기대대로 채점되는지 확인
10. 데이터표에 값 입력 → 계산 열·추세선·R²가 즉시 갱신되는지, 기울기 자동채점이 맞는지 확인
11. 그리기 답안 제출 후 **화면을 회전**해 스트로크가 어긋나지 않는지 확인, 사진 업로드 제출 확인
12. POE: 예측 제출 후 **수정이 막히는지**, 요약 화면에 예측↔설명이 나란히 나오는지 확인
13. 중간에 새로고침 → 답안 복구 및 같은 위치에서 이어지는지 확인
14. 학생 3명분 제출 후 `/#/results/<code>` → 통계 확인, `.xlsx`를 열어 학생 1행·문항별 열·자동채점 값·미디어 URL이 정확한지, **테스트 모드 응답이 섞여 있지 않은지** 확인
15. 모바일 뷰포트에서 가로 스크롤이 없는지, 하단 고정 바가 콘텐츠를 가리지 않는지, 수식 가상 키보드가 입력칸을 가리지 않는지 확인

**실제 백엔드**
Apps Script 배포 후 `VITE_API_MODE=live`로 7~14번 반복. 특히 **여러 탭 동시 제출** 시 LockService 하에서 행 누락·중복이 없는지, **학급 응답 집계 폴링**이 화면을 벗어나면 멈추는지 네트워크 탭에서 확인.

**세션 인계 검증** (0단계 직후 및 마지막에 각각)
- `CLAUDE.md`와 `docs/PROGRESS.md`만 읽고도 "지금 어디까지 됐고 다음에 뭘 해야 하는지"가 명확한지 스스로 읽어보며 점검
- `git log --oneline`만 봐도 단계별 진행이 읽히는지 확인
- 커밋된 파일에 배포 URL·토큰 등 비밀값이 섞이지 않았는지 `git grep`으로 확인
- 수업 내보내기 `.json`을 다시 가져오기 해 동일하게 복원되는지, 구버전 스키마 픽스처가 `migrate.ts`를 통과해 열리는지 확인
