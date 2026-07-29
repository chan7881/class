# CLAUDE.md — 이 프로젝트에서 작업하기 전에 반드시 읽을 것

> **작업을 시작하기 전에 `docs/PROGRESS.md`를 먼저 읽어라.** 현재 어느 단계까지 됐고 다음에 뭘 해야 하는지가 거기 있다. 이 파일은 규칙과 구조만 설명한다.

## 프로젝트가 무엇인가

과학 교사가 Notion처럼 블록을 쌓아 슬라이드형 학습지를 만들고, 학생이 모바일/PC에서 슬라이드를 넘기며 문제를 풀고(문제를 풀지 않으면 다음으로 못 넘어감), 교사가 그 답안을 엑셀로 수합하는 웹 도구. Rubin Observatory의 Investigations 형식과 Notion의 블록 편집 UX를 참고한다. 전체 계획은 `docs/PLAN.md`에 있다.

## 확정된 아키텍처 (바꾸려면 `docs/DECISIONS.md`에 이유를 남긴 뒤 바꿀 것)

- **프론트엔드**: React + Vite + TypeScript, GitHub Pages(HashRouter)로 정적 배포
- **백엔드**: Google Apps Script 웹앱 **1개를 중앙 배포**(운영자 계정 소유), 모든 교사가 공유. 서버 없음.
- **데이터**: 운영자 Google Drive에 수업 JSON·미디어, Google Sheets에 학생 응답
- **인증 없음**: 수업은 `code`(학생용)와 `editToken`(교사용, 서버에는 해시만 저장)으로 소유권을 증명한다
- 상세 데이터 모델·API·화면 설계는 `docs/PLAN.md` 참고

## 반드시 지킬 코드 규칙

1. **`src/blocks/registry.ts` 패턴을 지킨다.** 블록·문항 유형은 전부 `{ type, label, defaultData, Editor, Viewer, grade?, isAnswered?, toCell?, describeAnswer? }` 객체로 등록한다. 새 유형 추가 = 파일 하나 추가 + 레지스트리 등록. 유형별 `switch`를 여러 파일에 흩뿌리지 않는다. 문항이 12종이라 이 구조가 무너지면 유지보수가 불가능해진다.
2. **`eval`/`new Function()` 금지.** 데이터표 계산 열(`lib/formula.ts`)은 직접 만든 안전한 파서로 평가한다.
3. **정답은 서버가 지킨다.** `getLesson`(학생용 API)은 정답·해설 필드를 반드시 제거하고 내려준다. 클라이언트 `lib/grade.ts`는 목 모드·에디터 미리보기·교사 테스트 모드에서만 쓴다.
4. **채점·검증 로직은 순수 함수로 분리한다** (`lib/grade.ts`, `units.ts`, `sigfigs.ts`, `regression.ts`, `numbering.ts`, `navigate.ts`, `validate.ts`, `chemNormalize.ts`, `mathNormalize.ts`). UI에 채점 로직을 박아넣지 않는다. 전부 Vitest로 테스트한다.
5. **스키마는 마이그레이션 가능해야 한다.** `Lesson.version`을 바꾸는 변경은 `lib/migrate.ts`에 변환 함수를 추가해야 한다. 옛 수업이 안 열리는 상황을 만들지 않는다.
6. **비밀값을 절대 커밋하지 않는다.** Apps Script 배포 URL은 `.env.local`(gitignore됨)에, 교사 `editToken`은 코드 어디에도 남기지 않는다.
7. **학생 입력은 버튼 기반이어야 한다** (사용자 지시). 수식·화학식 입력에서 학생이 LaTeX 문법이나 키보드 단축키를 알아야 하는 UI를 만들지 않는다. 화학식 첨자는 자동 변환 금지 — 명시적 토글 버튼으로만.
8. **모바일 우선.** 터치 타깃 44px 이상, 하단 고정 바에 `env(safe-area-inset-bottom)`, 가로 스크롤 발생 금지.
9. **이모지·컬러 아이콘을 기본으로 쓰지 않는다** (사용자 지시, 12단계 디자인 재정돈). 버튼·라벨·배너는 텍스트만 쓴다. 꼭 필요한 소수의 경우(예: 좁은 hover 아이콘 행에서 텍스트가 안 들어갈 때)에만 `currentColor`를 상속하는 단색 기호(⤷ ⧉ ✕ ↶ ↷ 같은 기존 UI 기호)를 쓴다 — 색이 있는 이모지(🔒📊📚🎬 등)는 새로 추가하지 않는다.

## 디렉터리 지도

전체 파일 구조는 `docs/PLAN.md`의 「파일 구조」 절 참고. 요약:
- `src/types/lesson.ts` — 전 계층 공유 데이터 모델
- `src/api/mock.ts` / `client.ts` — localStorage 목 백엔드 / 실제 Apps Script 클라이언트 (`VITE_API_MODE`로 전환)
- `src/blocks/` — 블록·문항 레지스트리와 컴포넌트
- `src/lib/` — 순수 함수 (채점·검증·마이그레이션 등)
- `apps-script/Code.gs` — 백엔드 전체 (단일 `doPost` 라우터)
- `docs/` — 계획·진행상황·결정기록·운영정보 (아래 참고)

## 개발 명령

```
npm install
npm run dev          # VITE_API_MODE=mock 로 로컬 개발
npm run typecheck    # tsc --noEmit
npm run test         # vitest (순수 함수 단위 테스트)
npm run build         # GitHub Pages용 빌드
```

## 문서 지도 — 인계 체계

**사용자는 아래 표의 문서들(이 `CLAUDE.md` 포함)을 통틀어 "인수인계 파일"이라고 부른다.** "인수인계 파일 확인해/갱신해" 같은 지시는 이 표 전체를 뜻한다 — 어느 한 파일만 열어보고 끝내지 말 것.

| 파일 | 언제 열어보나 |
|---|---|
| `CLAUDE.md` | 이 파일. 규칙·구조·용어("인수인계 파일" 지칭 포함) |
| `docs/PROGRESS.md` | **항상 가장 먼저.** 현재 단계·다음 할 일·미해결 이슈 |
| `docs/PLAN.md` | 설계를 왜 이렇게 했는지 전체 맥락이 필요할 때 |
| `docs/구현계획서.docx` | PLAN.md의 Word 사본(사람이 읽는 용도). **직접 고치지 말 것** — PLAN.md를 고치고 재변환한다 |
| `docs/DECISIONS.md` | "이거 왜 이렇게 했지?"가 궁금할 때, 새 결정을 내렸을 때 |
| `docs/SESSION_LOG.md` | 지난 세션에 뭘 했는지 |
| `docs/OPERATIONS.md` | Apps Script 배포 URL, Drive 폴더, 배포·장애 대응 절차 |
| `apps-script/SETUP.md` | 백엔드를 처음 배포하거나 재배포할 때 — **아래 절차 요약 참고** |
| `docs/TEACHER_GUIDE.md` | 교사용 사용법 (기능이 실제 사용자에게 어떻게 보이는지 확인할 때) |

**작업을 끝낼 때마다**: `docs/PROGRESS.md` 갱신 → 새 결정이 있으면 `docs/DECISIONS.md`에 이유 기록 → 커밋(메시지 첫 줄에 단계 번호, 예: `[4] 기본 문항 6종 구현`) → 푸시.

### Apps Script(`Code.gs`) 재배포 절차 — 자주 헷갈리는 점

**"재배포"는 파일 업로드가 아니라 브라우저 에디터에 복사-붙여넣기다.** 이 프로젝트는 `clasp` 같은 CLI 배포 도구를 쓰지 않는다(의도적 — `apps-script/SETUP.md`가 요구하는 건 전부 브라우저 조작). `Code.gs`를 고칠 때마다:

1. [script.google.com](https://script.google.com)에서 기존 "InteractiveClass Backend" 프로젝트를 연다(운영자 본인 계정으로 로그인돼 있어야 함 — 계정 로그인은 사용자만 할 수 있는 행동).
2. 왼쪽 파일 목록의 `Code.gs`를 열고 안의 내용을 전부 지운 뒤, 리포지토리의 `apps-script/Code.gs` **파일 내용을 통째로 복사해 붙여넣는다.**
3. 저장(Ctrl+S).
4. 우상단 **배포 → 배포 관리(Manage deployments)** → 기존 배포 옆 연필(✏️) 아이콘 → 버전을 **새 버전(New version)** 으로 바꾸고 **배포**.
   - ⚠️ **"새 배포"를 새로 만들면 안 된다** — 웹앱 URL이 바뀌어서 `.env.local`과 GitHub 리포 Variables(`VITE_APPS_SCRIPT_URL`)까지 같이 고쳐야 하는 불필요한 후속 작업이 생긴다. 반드시 **기존 배포를 편집**해 새 버전으로 올려야 URL이 그대로 유지된다.
5. (필요시) 관리자 화면(`/#/admin`)을 쓰려면 이것과 별개로 **프로젝트 설정 → 스크립트 속성**에 `ADMIN_PASSWORD`를 등록해야 한다 — 이건 코드 배포가 아니라 설정값이라 "새 버전 배포" 없이 즉시 반영된다.

이 5단계는 script.google.com 로그인·배포 클릭 자체가 "사용자 본인 확인이 필요한 행동" 범주라 어시스턴트가 대신 못 한다(계정 인증·되돌리기 어려운 배포 조작). 어시스턴트가 할 수 있는 건 로컬 `apps-script/Code.gs`를 고치고, 배포 후 실사이트에서 결과를 검증하는 것까지다. 배포 여부를 확인하려면 `/#/admin`에 아무 값이나 넣어보거나(신규 액션을 인식 못 하면 `"알 수 없는 action: ..."` 에러가 뜬다 — 이게 "아직 재배포 안 됨"의 명확한 신호다) 사진 업로드처럼 `Code.gs`가 관여하는 기능을 직접 테스트하면 된다.
