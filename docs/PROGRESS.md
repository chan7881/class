# PROGRESS — 현재 진행 상황

> 이 파일을 가장 먼저 읽어라. 매 작업 종료 시 갱신한다.

**마지막 갱신**: 2026-07-28 · 세션 1

## 지금 어디까지 됐나

**3단계(블록 레지스트리 + 기본 블록) 완료.** 0~2단계도 완료.

### 3단계 — 블록 레지스트리 + 기본 블록 + 에디터 셸
- [x] `src/richtext/` — TipTap 기반 공용 리치텍스트 에디터. StarterKit(heading 끔)+Underline+`TextStyleKit`(색상·글꼴·크기)+Highlight+TextAlign+Link+Sub/Superscript+Placeholder. `BubbleToolbar.tsx`는 TipTap 공식 BubbleMenu 확장 대신 `coordsAtPos` 기반으로 직접 구현(사유는 DECISIONS.md)
- [x] `src/lib/sanitizeHtml.ts` — DOMPurify로 저장된 HTML을 렌더링 시점에 한 번 더 살균 (저장 API를 우회한 XSS 방어, CLAUDE.md 보안 원칙)
- [x] `src/blocks/registry.ts` + `types.ts` — 블록 타입 → `{label, icon, createDefault, Editor, Viewer}` 레지스트리
- [x] 콘텐츠 블록 8종 구현: TextBlock, HeadingBlock, ImageBlock(드래그앤드롭+URL, `lib/image.ts` 리사이즈), VideoBlock(YouTube/Vimeo 자동판별+구간재생, `lib/videoEmbed.ts`), CalloutBlock, DividerBlock, EmbedBlock(GeoGebra/PhET/Desmos 화이트리스트), ChartBlock(Recharts, `dataviz` 스킬로 팔레트 검증 — 라이트/다크 둘 다 통과)
- [x] `src/store/editorStore.ts` — Zustand. 슬라이드/블록 CRUD+재정렬, 되돌리기는 **구조적 변경만** 기록(사유 DECISIONS.md)
- [x] `src/editor/` — Canvas(dnd-kit 재정렬)·BlockWrapper(hover +/⠿/✕)·SlashMenu(+버튼으로 여는 블록 삽입 메뉴)·SlideList(슬라이드 재정렬·복제·삭제(최소 1개 보장)·보조슬라이드 토글, `lib/numbering.ts`로 "4-1" 표시)·PreviewFrame(모바일/데스크톱 토글, 지금은 Viewer 나열 — 5단계에서 실제 플레이어로 교체 예정)·EditorContext(업로드용 code/editToken 제공)
- [x] `src/lib/editorAuth.ts` — editToken을 localStorage에 저장, 복구 링크(`?key=`) 생성
- [x] `EditorPage.tsx` 실제 구현 — 복구 링크 처리, 편집 키 수동 입력 폴백, 3초 디바운스 자동저장, 실행취소/다시실행, 발행 + 복구 링크·학생 참여 링크 배너. `HomePage.tsx`의 "새 수업 만들기"가 실제로 `createLesson` 호출하도록 연결
- [x] **브라우저로 전체 흐름 실제 검증** (claude-in-chrome, `javascript_tool`로 DOM 이벤트 직접 발생 — 이 세션은 `computer` 툴의 click/screenshot이 여전히 불안정해 우회): 수업 생성 → 8종 블록 전부 삽입·편집(굵게/색/글자크기 포함) → 살균된 HTML이 미리보기에 정확히 반영 → 임베드 화이트리스트 정상 차단/허용 → 슬라이드 추가·보조슬라이드 토글("1-1" 번호 확인)·삭제(마지막 1개는 삭제 버튼 자체가 사라짐)·실행취소/다시실행 → 자동저장 → 발행 → 복구 링크로 편집 키 복원 → 수동 편집 키 붙여넣기 폴백. 전부 정상 동작
- [x] **버그 하나 발견·수정**: `mock.ts`의 `createLesson`이 슬라이드 0개로 시작해 `editorStore.removeSlide`의 "최소 1개" 불변식과 어긋났다 → 생성 시 빈 슬라이드 1개로 시작하도록 수정
- [x] 테스트 29개(migrate 4 + mock 9 + videoEmbed 12 + numbering 4) 전부 통과, typecheck/build 통과
- **TODO**: 프로덕션 빌드가 1.1MB(gzip 349KB)로 커지기 시작함(TipTap+dnd-kit+recharts). 11단계(최종 배포) 전에 라우트별 `React.lazy` 코드 스플리팅 검토할 것 — MathLive(7단계)·xlsx(10단계)가 더해지면 더 커진다.
- **PLAN.md와 달라진 부분** (DECISIONS.md에 근거 기록): "/" 실시간 슬래시 커맨드 대신 "+" 버튼만, 미리보기는 5단계 전까지 단순 Viewer 나열, 블록 속성은 별도 우측 패널 대신 각 블록 Editor에 인라인.

### 2단계 — 목 백엔드
- [x] `src/api/storage.ts` — localStorage/메모리 자동 전환 키-값 저장소 (jsdom 없이 Vitest에서 테스트 가능하게 하는 장치)
- [x] `src/lib/hash.ts`(Web Crypto SHA-256), `src/lib/code.ts`(수업 코드·editToken 생성)
- [x] `src/lib/stripAnswers.ts` — 학생용 `getLesson`이 정답·해설을 제거하는 로직을 별도 함수로 분리
- [x] `src/lib/grade.ts` — 문항 유형별 채점 **레지스트리** 골격(아직 빈 상태 — 정상. 문항 유형은 4·7단계에서 등록)
- [x] `src/api/types.ts` — mock과 6단계 실제 Apps Script 클라이언트가 함께 만족할 `ApiClient` 계약
- [x] `src/api/mock.ts` — `docs/PLAN.md` API 표 전체 구현(createLesson/getLesson/getLessonForEdit/saveLesson/publishLesson/deleteLesson/uploadMedia/uploadStudentMedia/saveProgress/gradeAnswer/submitResponse/getResults/getAggregate)
- [x] `src/api/client.ts` — `VITE_API_MODE`로 mock ↔ live 전환하는 유일한 진입점(live는 6단계까지 명확한 에러를 던지는 스텁)
- [x] `Lesson` 타입에 `published: boolean` 추가 (1단계에서 빠뜨렸던 것 — 미발행 수업을 학생이 못 보게 막으려면 필요했음)
- [x] 테스트 13개(migrate 4 + mock 9) 전부 통과, typecheck/build도 통과

### 1단계 — 스캐폴딩
- [x] Vite + React 19 + TypeScript (create-vite react-ts 템플릿 기반)
- [x] Tailwind v4(`@tailwindcss/vite`) + 디자인 토큰(`src/index.css`) — 단색 강조색 1개(`--color-accent-*`) + 중성 회색, 다크모드는 `prefers-color-scheme`, `.tap-target`(44px)·`.safe-bottom`(`env(safe-area-inset-bottom)`) 유틸
- [x] `vite.config.ts`에 `base: '/class/'` 고정 (GitHub Pages 프로젝트 페이지용) + Vitest 설정(`environment: 'node'`)
- [x] HashRouter 4라우트: `/`, `/editor/:code`, `/play/:code`, `/results/:code` + 잘못된 경로 → 홈 리다이렉트. 각 페이지는 다음 단계 전까지 안내 스텁(`src/pages/`)
- [x] 공통 컴포넌트: `Button`(variant 4종), `PageShell`
- [x] `src/types/lesson.ts` — `docs/PLAN.md` 데이터 모델 전체를 실제 TS로(Block 9종, Question 12종)
- [x] `src/lib/migrate.ts` + `migrate.test.ts` — 마이그레이션 골격, 테스트 4개
- [x] 검증: `npm run typecheck`/`test`/`build` 전부 통과, dev 서버에서 4라우트 + 리다이렉트를 브라우저로 직접 확인
- **알아둘 것**: `npm install`(또는 `node`/`npm`이 `PATH`에 없다는 오류) 시 Bash/PowerShell 둘 다 **툴 호출마다 셸 상태가 초기화**되어, Node를 쓰는 명령 앞에는 매번 `export PATH="/c/Users/이웅찬/AppData/Local/Programs/nodejs:$PATH"`(Bash) 또는 `$env:Path += ...`(PowerShell)를 붙여야 한다. 새로 여는 일반 터미널(사용자가 직접 여는 cmd/PowerShell)에는 이미 사용자 PATH에 등록돼 있어 필요 없다.

## 0단계 기록 (완료)

- [x] Node.js 설치 — winget 사용 불가(관리자 권한 없음, MSI 설치도 1603으로 실패) → **Node.js v22.14.0 zip 압축판을 `%LOCALAPPDATA%\Programs\nodejs`에 수동 설치, 사용자 PATH에 영구 등록**. 새 터미널부터 `node`/`npm` 바로 사용 가능. (자세한 경위는 `docs/DECISIONS.md` 참고)
- [x] `git init` (기본 브랜치명 `main`으로 정리)
- [x] `.gitignore`, `.env.example`
- [x] `CLAUDE.md`
- [x] `docs/PLAN.md`, `docs/구현계획서.docx` (계획 승인 시 작성)
- [x] `docs/PROGRESS.md` (이 파일)
- [x] `docs/DECISIONS.md`
- [x] `docs/SESSION_LOG.md`
- [x] `docs/OPERATIONS.md`
- [x] Claude 메모리 파일 3종 + `MEMORY.md` 인덱스
- [x] 첫 커밋 (`[0] 프로젝트 초기화: 계획 문서·인계 체계 구축`)
- [x] GitHub remote 연결 + 푸시 — 리포 https://github.com/chan7881/class (Private) 를 claude-in-chrome으로 직접 생성, `git push -u origin main` 완료 (Git Credential Manager 캐시 인증으로 프롬프트 없이 통과)

**0단계 완료.**

## 다음에 할 일

1. **4단계(기본 문항 6종) 시작**: `src/blocks/questions/registry.ts`(문항 kind → `{label, icon, createDefault, Editor, Viewer, grade, isAnswered}` 레지스트리, `src/blocks/registry.ts`와 같은 패턴이지만 별도) + cloze·choice·short·combo·order·match 6종의 Editor/Viewer/채점(`lib/grade.ts`의 `registerGrader` 호출)/`isAnswered`. 슬래시 메뉴(`SlashMenu.tsx`)에 이 6종을 `listBlockDefinitions()`와 나란히 보여주도록 확장 필요 — 지금 SlashMenu는 blocks/registry.ts만 본다. 새 문항을 삽입하면 `{ type:'question', q: <kind>.createDefault(id) }` 블록이 만들어져야 함(현재 Canvas.tsx는 `block.type==='question'`을 아직 "다음 단계에서 추가됩니다" 플레이스홀더로만 처리 — 이걸 실제 QuestionBlock 컴포넌트로 교체).

## 미해결 이슈

- **리포지토리가 Private + GitHub Pages는 개인 계정 무료 플랜에서 Public 리포에만 무료 제공된다.** 11단계(실제 배포)에서 이 문제를 반드시 다시 짚을 것: (a) 리포를 Public으로 전환하거나 (b) GitHub Pro/조직 플랜을 쓰거나 (c) Pages 대신 다른 정적 호스팅(Netlify/Vercel 등)을 검토해야 한다. 코드 자체엔 비밀값이 없으므로(Apps Script URL은 공개 가능, editToken은 애초에 커밋 안 함) Public 전환이 가장 간단한 선택지가 될 가능성이 높다.
- **winget이 이 셸에서 동작하지 않음** (App Installer 패키지는 있지만 `winget.exe` alias 미해결, 관리자 권한도 없음). 앞으로 다른 도구 설치가 필요하면 winget에 의존하지 말고 (a) 사용자 폴더에 압축 해제하는 portable 배포판을 찾거나 (b) 사용자에게 직접 설치를 요청할 것.
- Apps Script 배포는 6단계 예정. 그 전까지 `VITE_APPS_SCRIPT_URL`은 비워둔다.
- **claude-in-chrome의 `computer` 툴(click/screenshot)이 이 세션 내내 불안정**했다 — `Page.captureScreenshot`이 매번 타임아웃되고, 프로그래매틱 `.focus()`/`.click()` 후에도 `document.hasFocus()`가 계속 `false`(이 자동화 탭이 OS 차원에서 "포그라운드"로 취급되지 않는 것으로 보임 — TipTap의 `editor.isFocused`가 이 값에 의존해서 버블 툴바 표시 여부를 자동화로는 확인 못 함, 명령 자체는 `editor.chain()...run()`으로 직접 검증함). **우회책**: `javascript_tool`로 실제 DOM에 `input`/`click` 이벤트를 직접 디스패치하고 `document.body.innerText`·`localStorage` 상태로 결과를 확인하는 방식이 이 세션 내내 안정적으로 동작했다. 다음 세션에서도 `computer` 툴이 같은 증상(스크린샷 타임아웃, 포커스 안 잡힘)을 보이면 재시도하지 말고 바로 `javascript_tool` 우회로 전환할 것.
- **SPA 같은 라우트로의 네비게이션은 컴포넌트를 리마운트하지 않는다** — 이번 세션에서 이걸 모르고 "복구 링크(`?key=`)가 안 먹힌다"고 착각할 뻔했다. `navigate` 툴이나 `location.href=`로 **같은 경로, 다른 쿼리** URL을 열어도 React Router가 같은 라우트 엘리먼트를 재사용해 `useState` 초기값이 다시 안 읽힌다. 새 마운트를 확인해야 하는 테스트(예: localStorage 초기 읽기, `?key=` 처리)는 반드시 `location.reload()`로 강제 새로고침해서 검증할 것 — `navigate`만으로는 오탐이 난다.

## 임시방편(TODO) 목록

- **`saveProgress`/`submitResponse`/`gradeAnswer`가 테스트 모드(`isTest: true`) 여부를 클라이언트가 보낸 값 그대로 믿는다.** editToken 검증이 없다 — 즉 지금 구조로는 아무나 `isTest: true`를 보내 `_test` 응답을 쓸 수 있다(반대로 `isTest: false`를 보내면 정식 결과에 섞일 위험도 있음, 단 지금은 목 백엔드라 브라우저 콘솔을 직접 조작하는 사람 외엔 문제 없음). 5단계(플레이어 테스트 모드 UI)나 늦어도 6단계(실제 Apps Script)에서는 테스트 모드 진입 자체에 editToken을 요구하도록 반드시 다시 볼 것. (`src/api/mock.ts` 상단 주석에도 적어둠)
- `uploadMedia`/`uploadStudentMedia`가 `URL.createObjectURL`만 반환한다 — 새로고침하면 무효화된다. 진짜 영속 저장은 6단계.
- 프로덕션 번들이 1.1MB(gzip 349KB)로 경고 임계값을 넘음. 11단계에서 라우트별 코드 스플리팅 검토.
- 미리보기가 아직 실제 플레이어를 안 쓴다(Viewer만 나열, 진행 잠금 없음) — 5단계에서 교체.
- 블록 속성 편집 UI가 별도 우측 패널이 아니라 각 블록 Editor 안에 인라인 — 문항이 늘어나는 7~8단계에서 너무 길어지면 재검토.

## 단계 체크리스트 (전체, `docs/PLAN.md` 「구현 단계」와 동기화)

- [x] 0. 환경 준비 + 세션 연속성 확보
- [x] 1. 스캐폴딩
- [x] 2. 목 백엔드
- [x] 3. 블록 레지스트리 + 기본 블록
- [ ] 4. 기본 문항 6종 (다음 작업)
- [ ] 5. 플레이어 + 미리보기
- [ ] 6. Apps Script 백엔드 (여기서 기본 제품 완성)
- [ ] 7. 수식·화학·수치
- [ ] 8. 탐구 도구 (데이터표·차트·그리기·사진)
- [ ] 9. 수업 운영 (조건분기·POE·학급집계·참고자료)
- [ ] 10. 결과 대시보드 + 엑셀 + 내보내기/가져오기
- [ ] 11. 테스트 모드 + 마감 + 배포
