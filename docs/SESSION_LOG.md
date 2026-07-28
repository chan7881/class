# SESSION_LOG — 세션별 요약

새 세션이 끝날 때마다 맨 위에 추가한다(최신이 위로). 3~5줄, "다음 세션이 알아야 할 것" 위주로 짧게.

---

## 세션 1 — 2026-07-28

- 요구사항 논의 후 계획 확정: React+Vite+TS, GitHub Pages + 중앙 배포 Apps Script, 문항 12종(과학 특화 포함: 수식·화학식 버튼 입력, 허용오차/유효숫자/단위 채점, 데이터표 자동계산·추세선, 그리기·사진 답안, POE 잠금, 조건 분기 4-1/4-2, 참고자료 패널, 학급 응답 집계, 교사 미리보기+테스트 모드).
- 계획서를 `docs/PLAN.md`(원본)와 `docs/구현계획서.docx`(Word 사본)로 저장. 다음 세션 재개용 안내(`다음_세션_작업_방법.txt`)를 프로젝트 루트에 작성.
- **0단계 진행 중**: Node.js 설치(winget 불가 → zip 수동 설치로 우회, 상세는 `docs/DECISIONS.md`), `git init`, `CLAUDE.md`/`PROGRESS.md`/`DECISIONS.md` 작성 완료. `SESSION_LOG.md`(이 파일)·`OPERATIONS.md`·메모리 기록·첫 커밋·GitHub remote 연결은 아직.
- GitHub 리포 `https://github.com/chan7881/class`(Private)를 claude-in-chrome으로 직접 생성 후 push 완료. **0단계 전체 완료.**
- **1단계(스캐폴딩)도 이어서 완료**: Vite+React+TS, Tailwind v4(디자인 토큰), HashRouter 4라우트+스텁 페이지, 공통 컴포넌트(Button/PageShell), `types/lesson.ts`(전체 데이터 모델), `lib/migrate.ts`+테스트. typecheck/test/build 전부 통과, 브라우저로 라우팅 확인.
- **2단계(목 백엔드)도 이어서 완료**: `src/api/{storage,types,mock,client}.ts` + `src/lib/{hash,code,stripAnswers,grade}.ts`. `docs/PLAN.md`의 Apps Script API 표를 전부 localStorage 기반으로 구현(정답 제거·editToken 검증·테스트 응답 분리·익명 집계 포함). 1단계에서 빠뜨렸던 `Lesson.published` 필드를 추가해 미발행 수업을 학생이 못 보게 막음. 테스트 9개 추가(총 13개 통과).
- **3단계(블록 레지스트리 + 기본 블록)까지 이어서 완료** — 사용자가 "이어서 계속하고 중간보고 생략"을 지시해 세션 하나로 계속 진행. TipTap 리치텍스트(굵게/색/글꼴/크기/첨자 등) + DOMPurify 살균, 콘텐츠 블록 8종(text/heading/image/video/callout/divider/embed/chart — 차트는 dataviz 스킬로 팔레트 검증), Zustand `editorStore`(구조적 변경만 undo/redo), dnd-kit 재정렬, SlideList(보조슬라이드+numbering.ts), 실제 EditorPage(자동저장·발행·복구링크). **브라우저로 전체 플로우 실제 검증 완료** — `computer` 툴의 click/screenshot이 이 세션 내내 불안정해서(스크린샷 타임아웃, `document.hasFocus()`가 계속 false) `javascript_tool`로 DOM 이벤트를 직접 쏘는 방식으로 우회했고 안정적으로 잘 됐다. 그 과정에서 실제 버그 하나 발견·수정(`createLesson`이 슬라이드 0개로 시작하던 것). 테스트 총 29개 통과.
- **다음 세션이 알아야 할 것**: 리포가 Private라 GitHub Pages 무료 배포가 안 될 수 있음 — 11단계에서 Public 전환 여부를 재확인할 것. Node/npm은 `PATH`에 세션마다 수동으로 잡아줘야 함(`docs/PROGRESS.md` 참고, 경로는 `%LOCALAPPDATA%\Programs\nodejs`). **claude-in-chrome 테스트할 때 `computer` 툴이 또 불안정하면 바로 `javascript_tool` 우회로 전환할 것**, **SPA에서 같은 라우트로의 네비게이션은 리마운트가 안 되니 새 마운트 확인 테스트는 꼭 `location.reload()`로 할 것**(둘 다 `docs/PROGRESS.md`에 상세 기록). **테스트 모드 응답에 editToken 검증이 아직 없음**(`docs/PROGRESS.md` 임시방편 목록 참고, 5~6단계에서 반드시 다시 볼 것). 다음 작업은 4단계(기본 문항 6종 + 문항 레지스트리) — PLAN.md와 실제 구현이 갈린 지점은 `docs/DECISIONS.md`에 기록해뒀으니 참고.
