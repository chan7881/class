# PROGRESS — 현재 진행 상황

> 이 파일을 가장 먼저 읽어라. 매 작업 종료 시 갱신한다.

**마지막 갱신**: 2026-07-28 · 세션 1

## 지금 어디까지 됐나

**2단계(목 백엔드) 완료.** 0·1단계도 완료.

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

1. **3단계(블록 레지스트리 + 기본 블록) 시작**: `src/blocks/registry.ts` 설계 + text(TipTap)·heading·image·video·callout·divider·embed 블록의 Editor/Viewer 쌍, 에디터 캔버스·슬래시 메뉴(`@dnd-kit`)·버블 툴바. `npm install @tiptap/react @tiptap/starter-kit @dnd-kit/core @dnd-kit/sortable` 등 이 단계에서 처음 필요해지는 의존성을 추가할 것.

## 미해결 이슈

- **리포지토리가 Private + GitHub Pages는 개인 계정 무료 플랜에서 Public 리포에만 무료 제공된다.** 11단계(실제 배포)에서 이 문제를 반드시 다시 짚을 것: (a) 리포를 Public으로 전환하거나 (b) GitHub Pro/조직 플랜을 쓰거나 (c) Pages 대신 다른 정적 호스팅(Netlify/Vercel 등)을 검토해야 한다. 코드 자체엔 비밀값이 없으므로(Apps Script URL은 공개 가능, editToken은 애초에 커밋 안 함) Public 전환이 가장 간단한 선택지가 될 가능성이 높다.
- **winget이 이 셸에서 동작하지 않음** (App Installer 패키지는 있지만 `winget.exe` alias 미해결, 관리자 권한도 없음). 앞으로 다른 도구 설치가 필요하면 winget에 의존하지 말고 (a) 사용자 폴더에 압축 해제하는 portable 배포판을 찾거나 (b) 사용자에게 직접 설치를 요청할 것.
- Apps Script 배포는 6단계 예정. 그 전까지 `VITE_APPS_SCRIPT_URL`은 비워둔다.
- **claude-in-chrome 브라우저 자동화의 click/screenshot/키보드 포커스가 이 세션에서 전반적으로 실패**했다(새 탭에서도 동일 — 내 앱 코드 문제가 아니라 도구 환경 문제로 보임). `get_page_text` + 직접 URL(`#/...`) 이동으로 우회해 라우팅은 검증했지만, 실제 클릭 흐름(입력→네비게이션)은 코드 리뷰로만 확인했다. 다음 세션에서 브라우저 자동화로 클릭 인터랙션을 테스트해야 할 때 이 문제가 재발하면, 도구 자체 문제인지부터 먼저 의심할 것.

## 임시방편(TODO) 목록

- **`saveProgress`/`submitResponse`/`gradeAnswer`가 테스트 모드(`isTest: true`) 여부를 클라이언트가 보낸 값 그대로 믿는다.** editToken 검증이 없다 — 즉 지금 구조로는 아무나 `isTest: true`를 보내 `_test` 응답을 쓸 수 있다(반대로 `isTest: false`를 보내면 정식 결과에 섞일 위험도 있음, 단 지금은 목 백엔드라 브라우저 콘솔을 직접 조작하는 사람 외엔 문제 없음). 5단계(플레이어 테스트 모드 UI)나 늦어도 6단계(실제 Apps Script)에서는 테스트 모드 진입 자체에 editToken을 요구하도록 반드시 다시 볼 것. (`src/api/mock.ts` 상단 주석에도 적어둠)
- `uploadMedia`/`uploadStudentMedia`가 `URL.createObjectURL`만 반환한다 — 새로고침하면 무효화된다. 진짜 영속 저장은 6단계.

## 단계 체크리스트 (전체, `docs/PLAN.md` 「구현 단계」와 동기화)

- [x] 0. 환경 준비 + 세션 연속성 확보
- [x] 1. 스캐폴딩
- [x] 2. 목 백엔드
- [ ] 3. 블록 레지스트리 + 기본 블록 (다음 작업)
- [ ] 4. 기본 문항 6종
- [ ] 5. 플레이어 + 미리보기
- [ ] 6. Apps Script 백엔드 (여기서 기본 제품 완성)
- [ ] 7. 수식·화학·수치
- [ ] 8. 탐구 도구 (데이터표·차트·그리기·사진)
- [ ] 9. 수업 운영 (조건분기·POE·학급집계·참고자료)
- [ ] 10. 결과 대시보드 + 엑셀 + 내보내기/가져오기
- [ ] 11. 테스트 모드 + 마감 + 배포
