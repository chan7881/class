# PROGRESS — 현재 진행 상황

> 이 파일을 가장 먼저 읽어라. 매 작업 종료 시 갱신한다.

**마지막 갱신**: 2026-07-28 · 세션 1 (9단계 완료)

## 지금 어디까지 됐나

**9단계(수업 운영)까지 완전히 끝남.** 0~5, 7, 8, 9단계는 완전히 끝남. 6단계는 코드 완료·실제 배포는 아직(아래 항목 참고).

### 9단계 — 수업 운영 (완료)
- [x] `src/lib/navigate.ts` — 조건 분기 다음 슬라이드 결정(`resolveNextSlideId`: 정답/오답/`choice:옵션ID` 규칙 + `default` + 목적지 삭제 시 안전한 대체) + 순환·도달불가 검사(`validateBranchGraph`, BFS+DFS). **메인 슬라이드의 "보통 진행"은 바로 뒤 보조 슬라이드(4-1, 4-2…)를 건너뛰고 다음 메인 슬라이드로 간다** — 보조 슬라이드는 분기 규칙으로만 도달해야 한다는 설계를 위해 처음 구현한 것과 다르게 다시 정정함(테스트 작성 중 발견). 테스트 12개
- [x] `src/editor/BranchEditor.tsx` — 슬라이드에 문항이 있으면 분기 규칙(기준 문항·규칙 목록·그 외 처리)을 편집하는 UI. `EditorPage.tsx`에 `validateBranchGraph` 결과로 "도달 불가/순환 분기" 경고 배너 추가. `editorStore`에 `updateSlideBranch` 액션 추가
- [x] `src/player/ProgressBar.tsx` — 메인 슬라이드 기준으로 퍼센트 계산하도록 수정(보조 슬라이드로 빠져도 퍼센트가 안 요동침)
- [x] `src/player/Player.tsx` **대대적으로 재작성** — `slideIndex`(숫자) 대신 `path`(실제로 방문한 슬라이드 id 배열, 뒤로가기도 이 배열을 pop) 기반으로 바꿔 분기를 지원. "다음" 클릭 시 현재 슬라이드에 `branch`가 있으면 `adapter.gradeAnswer`로 채점 결과를 얻어 `resolveNextSlideId`에 넘긴다
- [x] POE(예측-관찰-설명) 잠금 — `QuestionBase.lockAfterSubmit`(이미 있던 필드)을 실제로 씀. `SlideView.tsx`에 "🔒 예측 제출하기" 버튼(답변 있고 안 잠겼을 때만) + 잠긴 문항은 입력 비활성화·자물쇠 안내 표시. `Player.tsx`가 `lockedQuestionIds: Set<string>` 상태로 관리하고 `ResponseRecord.lockedQuestionIds`로 서버에 저장
- [x] **서버도 잠금을 강제한다** — `src/api/mock.ts`와 `apps-script/Code.gs` 양쪽에 `enforceLocks` 함수 추가: 이전에 저장된 응답에 잠긴 문항이 있으면, 클라이언트가 무슨 값을 보내든(잠금 목록에서 빼서 보내도) 서버가 잠금 당시 값을 그대로 유지한다. Code.gs는 응답 시트에 `잠금문항` 열을 추가(`FIXED_COLUMNS`). `mock.test.ts`에 잠금 우회 시도 테스트 추가
- [x] `src/blocks/PoeGroup.tsx` — `poeGroup` 콘텐츠 블록(화면에는 아무것도 안 그림, `predictId`/`explainId`를 메타데이터로만 기록). 수업 전체에서 문항을 골라 담는 드롭다운(`useEditorStore`로 전체 lesson 조회)
- [x] `src/player/SummaryView.tsx` — `poePairs` prop 추가, `Player.tsx`가 제출 시 lesson의 모든 `poeGroup` 블록을 찾아 예측/설명 답을 짝지어 "내 예측 vs 내 설명"으로 보여줌
- [x] 학급 응답 집계 UI — `src/player/ClassAggregate.tsx`: `IntersectionObserver`로 화면에 보일 때만 10초 폴링(벗어나면 즉시 중단), `question.shareClassResponses`가 켜져 있고 학생이 답했을 때만 `SlideView`에 표시. `QuestionEditorShell.tsx`에 `lockAfterSubmit`/`shareClassResponses` 체크박스 UI 추가(이전 단계까지는 타입에만 있고 UI가 없었음)
- [x] 참고자료 패널 — `src/data/periodic.ts`(118원소, 한국어 이름), `src/data/constants.ts`(과학 상수 12종), `src/reference/{PeriodicTable,Constants,UnitConverter,ReferenceDrawer}.tsx`. `UnitConverter`는 7단계 `lib/units.ts`를 그대로 재사용. `ReferenceDrawer`는 화면 우하단 플로팅 버튼 → 바텀시트, `lesson.settings.referencePanel`이 켜져 있을 때만 렌더링. `SettingsPanel.tsx`에 패널 on/off + 탭 선택 + 커스텀 HTML 편집 UI 추가
- [x] typecheck/test(126개)/build 전부 통과
- [x] **브라우저 실검증 완료** — 지난 세션에서 중단됐던 지점(테스트 수업 코드 `T5GRZJ`, POE 묶음 블록 추가 직전)부터 이어서 진행. POE 묶음에서 예측/설명 문항 연결(`javascript_tool`로 select 값 설정 후 저장 확인) → 설정 패널에서 참고자료 패널 켜기 + 주기율표/상수표/단위환산 3개 탭 선택 → 발행 → **학생A(오답 선택)**: 진행바 "1/2"에서 학급 응답 분포 위젯이 뜨는 것 확인 → "다음" 클릭 시 실제로 "1-1/2"(보조 슬라이드)로 분기되는 것 확인, 진행률이 요동치지 않음 → 예측 문항에 답 작성 후 "🔒 예측 제출하기" 버튼으로 잠금 → 잠긴 직후 textarea `disabled` 확인 + **`location.reload()`로 진짜 새로고침해도 잠금과 진행 위치가 그대로 유지**되는 것 확인(서버/localStorage 영속 확인) → 설명 문항 작성 후 제출 → 요약 화면에 "내 예측 vs 내 설명"이 실제 입력한 텍스트로 정확히 짝지어 표시됨을 확인 → **학생B(정답 선택)**: "1/2"에서 정답 선택 후 "다음" 클릭 시 1-1을 건너뛰고 바로 "2/2"로 이동하는 분기 확인 → 참고자료 패널(📚 버튼)을 열어 주기율표에서 "Fe" 클릭 → "Fe · 철 · 원자번호 26 · 전이금속" 상세 표시 확인, 상수표 12개 항목 표시 확인, 단위환산기에 5000을 입력해 "5 km"로 정확히 환산되는 것 확인 → 제출까지 완료(10/30, Q1만 정답 처리)
- [x] **학급 응답 집계 검증**: `api.getAggregate('T5GRZJ', <선택형 문항ID>)`를 브라우저 콘솔에서 직접 호출해 실제 두 학생(9.8/3.7 각 1명)이 정확히 집계됨을 확인. 다만 **IntersectionObserver 기반 자동 폴링 자체는 이 자동화 환경에서 직접 관찰하지 못함** — claude-in-chrome이 여는 탭이 `document.hidden:true`(OS 차원에서 포그라운드로 전환되지 않음, 기존에 문서화된 `document.hasFocus()` 항상 false 이슈와 같은 근본 원인으로 추정)라 Chrome이 `IntersectionObserver` 콜백 자체를 지연시킨다. React 파이버에서 `visible` state의 `dispatch(true)`를 직접 호출해 강제로 켜보니 즉시 폴링이 일어나고 "학급 전체 응답 분포 (2명 응답)" + 막대 차트가 정확한 비율(0.5/1)로 렌더링되는 것을 확인 — **컴포넌트 로직 자체는 검증됨, 자동화 환경의 탭 포그라운드 한계만 남음**(자세한 내용은 `docs/DECISIONS.md` 2026-07-28 항목).
- [x] **9단계 전체 완료.** typecheck/test/build 재확인 불필요(코드 변경 없음, 브라우저 검증만 수행).

### 8단계 — 탐구 도구
- [x] `src/lib/formula.ts` — 데이터표 계산 열 수식을 `eval`/`Function` 없이 직접 만든 토크나이저+재귀하강 파서+트리 평가기로 계산. `+ - * / ^ ( )`, 열 참조, 스칼라 함수(abs/sqrt/log/ln), 집계 함수(avg/sum/min/max/count/stdev — 열 이름 하나만 인자로 받음)를 지원. `__proto__`/`constructor` 같은 프로토타입 체인 키를 열 이름으로 넣었을 때 `Object.hasOwn`으로 실제 소유 속성만 보게 해서 값이 조용히 새는 걸 막음(테스트로 발견·수정)
- [x] `src/lib/regression.ts` — 최소제곱 선형회귀(기울기·절편·R²), 점 2개 미만이나 x가 전부 같은 경우 `null`
- [x] `src/lib/dataTableCompute.ts` — `cells[row][col]` 원본 입력에서 계산 열까지 채운 열별 숫자 배열을 만드는 공용 함수(그리드 렌더링·차트·채점이 전부 이 함수 하나를 공유)
- [x] `kind:'dataTable'` (`src/blocks/questions/DataTable.tsx`) — 열 구성(숫자/텍스트/계산 + 수식 + 단위) 편집, 행 수 설정, 그래프(산점도/꺾은선/막대 + X·Y축 선택 + 추세선) 설정, 추세선 기울기·절편 자동채점(허용오차) 설정. 학생 화면은 표 입력 + 실시간 계산 열 + 실시간 차트+회귀 요약(기울기·절편·R²) 렌더링
- [x] `src/components/ChartRenderer.tsx` 확장 — `ScatterChart`를 `ComposedChart`로 바꿔 산점도 위에 추세선(`Line`, 별도 2점 데이터, 점선, 무채색)과 오차막대(`ErrorBar`)를 함께 그릴 수 있게 함. 3단계 `ChartBlock`은 그대로 호환(옵션 prop 추가라 기존 호출부는 안 바뀜)
- [x] `kind:'drawing'` (`src/blocks/questions/Drawing.tsx`) — Pointer Events 기반 캔버스(펜/직선/지우개, 색 6종, 굵기 3단계, 되돌리기, 전체 지우기), 밑그림 이미지(교사가 업로드), 스트로크를 정규화 좌표(0~1)로 저장해 리사이즈에도 안 어긋남. 완성된 스트로크마다 디바운스(600ms) 후 캔버스를 PNG로 렌더해 `uploadStudentMedia`로 Drive에 올리고 URL을 답 값에 같이 저장(교사가 결과 화면에서 바로 볼 수 있게)
- [x] `kind:'photo'` (`src/blocks/questions/Photo.tsx`) — `capture="environment"`로 모바일 카메라 바로 열기, 기존 `lib/image.ts`(리사이즈)를 그대로 재사용, `uploadStudentMedia`로 업로드, 여러 장(설정 가능한 최대 장수) 첨부·개별 삭제
- [x] **`grade`를 선택적 필드로 변경**(`blocks/questions/types.ts`, `registry.ts`) — 그리기·사진은 애초에 정답 개념이 없어서, 억지로 `{correct:false, points:0}`을 반환하면 학생에게 "✗ 오답" 배너가 뜨고 점수 합계에도 반영되는 오해를 만든다. `grade`를 생략하면 `registerQuestion`이 `lib/grade.ts`에 채점기를 아예 등록하지 않아 `gradeQuestion`이 `null`을 반환하고, `submitResponse`가 그 문항을 `scores`에서 완전히 제외한다(기존에 문서화된 "그레이더 없음 = 서답형처럼 교사 수기 채점" 규칙을 실제로 사용하게 된 첫 사례)
- [x] `apps-script/Code.gs`에 `formula.ts`/`regression.ts`/`dataTableCompute.ts` 로직을 이식해 `gradeDataTable`을 `GRADERS`에 추가(drawing/photo는 grade가 없으므로 GRADERS에도 안 넣음 — TS/GAS 둘 다 일관되게 "채점 없음")
- [x] 신규 테스트 3개 파일(`formula.test.ts` 10개 — 악의적 입력 거부 케이스 포함, `regression.test.ts` 4개, `dataTableCompute.test.ts` 3개). 테스트 총 113개 통과, typecheck/build 통과
- [x] **브라우저 풀 플로우 검증**: 슬래시 메뉴에 데이터표/그리기/사진 3종 확인 → 데이터표에 계산 열(속력=A/B) 추가 + 산점도·추세선·자동채점(기울기 2, 절편 0, 허용오차 0.5) 설정 → 그리기(밑그림 없이 기본 도구) + 사진(최대 1장) 문항 추가 → 발행 → 학생 입장 → 표에 (1,2)(2,4)(3,6)(4,8)(5,10) 입력하며 계산 열이 실시간으로 0.5로 채워지는지, 차트가 실시간으로 갱신되는지 확인 → **"기울기 2.000 · 절편 0.000 · R² 1.000" 정확히 표시 확인** → Pointer Event로 캔버스에 대각선 스트로크 그려 되돌리기 버튼이 활성화되는지 확인 → 가짜 PNG 파일을 `DataTransfer`로 파일 입력에 주입해 사진 업로드 확인(썸네일 렌더링) → 제출 → **10/10 만점, 데이터표만 "✓ 정답"으로 채점되고 그리기·사진은 애초에 점수 합계에서 제외됨을 확인**(의도한 대로 동작)
- **테스트 스크립트 타임아웃(앱 버그 아님)**: 표에 5행×2열을 순서대로 채우는 반복문 도중 `javascript_tool`이 45초 타임아웃을 던졌지만(4단계·7단계에서도 겪은 동일 패턴), 실제로는 스크립트가 백그라운드에서 계속 실행돼 앞 3행이 이미 채워져 있었다 — 남은 2칸만 확인 후 채워 넣어 이어감. 재시도 전에 상태부터 확인하는 원칙을 다시 지킴.

### 7단계 — 수식·화학·수치
- [x] `src/math/MathField.tsx` — MathLive `<math-field>`를 JSX가 아니라 imperative하게 마운트(공식 React 바인딩이 없어서). **물리 키보드 입력을 캡처 단계 `keydown`/`paste`/`cut` 리스너로 완전히 차단**하고 커스텀 버튼판만으로 입력받는다 — 사용자의 명시적 지시("학생들이 latex 문법을 모른다는 가정하에 버튼 형태로만") 그대로 구현. 실제 `KeyboardEvent`를 디스패치해 `defaultPrevented===true`이고 필드 값이 바뀌지 않는 것까지 브라우저로 확인(`[[interactive-class-button-input-constraint]]` 메모리와 일치)
- [x] `src/lib/mathKeyboards.ts` — 버튼 키보드 5개 레이어(`basic`/`fraction`/`greek`/`unit`/`chem`) 정의. 문항마다 교사가 켤 레이어를 고름
- [x] `src/math/MathRender.tsx` — KaTeX로 LaTeX 표시 전용 렌더(신뢰할 수 있는 라이브러리라 DOMPurify를 또 거치지 않음 — 학생이 입력한 LaTeX 자체가 위험한 게 아니라 KaTeX가 안전하게 렌더한다는 전제)
- [x] `kind:'math'` (`src/blocks/questions/Math.tsx`) — 키보드 레이어 선택 + 복수 정답 등록(교사도 버튼 입력), 채점은 `lib/mathNormalize.ts`(공백·`\left\right`·중복중괄호·`x^{2}`↔`x^2` 정규화 후 문자열 비교) `compareMode:'normalized'`만 구현. `symbolic`(Compute Engine 동적 import)은 미구현 상태로 문서화만 해둠
- [x] `kind:'numeric'` (`src/blocks/questions/Numeric.tsx`) — `lib/units.ts`(SI 접두어 조합 대신 명시적 단위 표), `lib/sigfigs.ts`(원문 표기 기준 유효숫자), `lib/numericInput.ts`(`3.0e8`/`3.0×10^8`/쉼표 파싱). 허용오차(절대/%) · 단위 판정(안 봄/정확히/환산 허용) · 유효숫자 셋 다 조합해 채점
- [x] `kind:'chem'` (`src/blocks/questions/Chem.tsx`) — 자동변환 없이 버튼(₀-₆·⁺·⁻·→·⇌·Δ··(s)(l)(g)(aq))으로 커서 위치에 삽입. `lib/chemNormalize.ts`로 유니코드 첨자 통일·화살표 통일(양방향 화살표를 먼저 치환해야 하는 순서 버그를 테스트로 잡아 수정)·계수 1 생략 허용 후 비교
- [x] **`apps-script/Code.gs`의 `GRADERS`에 `numeric`/`chem`/`math` 채점기 추가** — `units.ts`/`sigfigs.ts`/`numericInput.ts`/`chemNormalize.ts`/`mathNormalize.ts`의 로직을 GAS(V8)로 그대로 이식(`UNIT_TABLE`, `countSigFigs`, `parseNumericInput`, `normalizeChemFormula`, `normalizeLatex` 등). 6단계에서 만든 "두 언어 동기화" 문제가 여기서 처음 실제로 발생했고, 미루지 않고 바로 처리함
- [x] 신규 순수 함수 테스트 5개 파일(`units.test.ts`/`sigfigs.test.ts`/`numericInput.test.ts`/`chemNormalize.test.ts`/`mathNormalize.test.ts`) + `grading.test.ts`에 3종 채점 케이스 추가. 테스트 총 96개 통과, typecheck/build 통과
- [x] **브라우저 풀 플로우 검증**: 에디터 슬래시 메뉴에 수식/수치/화학식 3종이 보이는지 → 수식 문항에 버튼으로 "7+8" 입력해 정답 등록 → 물리 키보드 이벤트를 직접 디스패치해 **차단되는지 확인** → 수치 문항(정답 9.8±0.2, 단위 m/s², 환산 허용)·화학식 문항(정답 H₂O, 아래첨자 버튼으로 입력) 설정 → 발행 → 학생으로 입장해 세 문항 모두 버튼/입력으로 답 작성("7+8", "9.7 m/s²", "H₂O") → 제출 → **30/30 만점, 세 문항 모두 "✓ 정답"으로 채점됨을 확인**
- **테스트 스크립트 실수(앱 버그 아님)**: 수치 문항 설정 중 `document.querySelectorAll('input[type=number]')` 배열 인덱싱을 잘못 잡아 유효숫자 칸에 정답 값을 쓴 적이 있음 — 라벨 텍스트로 각 입력을 다시 식별해 정정. 다음에 비슷한 다중-input 폼을 자동화할 때는 처음부터 라벨 기준으로 찾을 것.

### 6단계 — Apps Script 백엔드
- [x] `apps-script/Code.gs` — `docs/PLAN.md` API 표의 액션 14개(getProgress 포함 5단계에서 추가된 것까지) 전부 구현. `src/api/mock.ts`와 같은 동작을 목표로 이식: 정답 제거(`stripAnswers`), 6종 채점기(`gradeChoice`~`gradeMatch` — mock.ts/블록 컴포넌트와 **로직을 반드시 동기화해야 하는 두 번째 사본**, 파일 상단에 경고 주석 있음), editToken 해시 검증, LockService로 쓰기 경로 동시성 보호
- [x] Drive 폴더 구조(`InteractiveClass/lessons|media|uploads|responses`) + `_index` 스프레드시트(code↔editTokenHash↔응답시트ID) + 수업마다 생기는 응답 스프레드시트(`responses`/`_test`/`_meta` 3시트, `_meta`가 문항ID↔열 위치를 기억해 문항이 늘어도 기존 열이 안 밀림 — PLAN.md 설계 그대로)
- [x] `apps-script/appsscript.json`(웹앱 매니페스트, 실행 계정 "나", 액세스 "모든 사용자")
- [x] `src/api/liveClient.ts` — `fetch` 기반 실제 클라이언트. **`Content-Type: text/plain`**으로 보내 CORS preflight를 피함(PLAN.md에 명시된 필수 사항). 업로드는 Blob→base64 변환 후 JSON으로 전송(Apps Script doPost가 텍스트만 받으므로)
- [x] `src/api/client.ts` — `VITE_API_MODE=live`일 때 `liveClient`를, 아니면 `mockApi`를 쓰도록 교체. `VITE_APPS_SCRIPT_URL` 없이 live 모드면 즉시 에러(스텁 대신 실제 안내 메시지)
- [x] `apps-script/SETUP.md` — 운영자가 직접 따라 할 배포 절차(스크립트 붙여넣기 → 웹앱 배포 → 권한 승인 → URL 복사 → `.env.local` 설정 → 확인). `doGet`으로 간단한 상태 확인용 응답도 추가
- [x] 테스트 3개 추가(`liveClient.test.ts` — text/plain 헤더가 실제로 나가는지, ok:false 시 에러가 제대로 전파되는지). 테스트 총 52개 통과, typecheck/build 통과
- **⚠️ 실제로 배포·테스트하지 못했다.** 배포에는 Google 계정 OAuth 동의(권한 승인 클릭)가 필요한데, 이건 사용자 본인만 할 수 있는 행동이라 자동화 도구로 대신 하지 않았다(계정 생성·OAuth 승인은 항상 사용자 확인이 필요한 범주). **따라서 `apps-script/Code.gs`는 코드 리뷰 수준으로만 검증됐고, 실제 Google Drive/Sheets에 대고 동작을 확인한 적이 없다.** `.env.local`을 안 만들었으므로 앱은 계속 mock 모드로 동작하고, 7~11단계 개발도 지장 없이 이어갈 수 있다. **사용자가 `apps-script/SETUP.md`를 따라 직접 배포하고 "확인해보기" 절차를 마쳐야 실제로 검증된 것이다.** 배포 후 문제가 생기면 다음 세션에 알려주면 Code.gs를 고칠 수 있다.

### 5단계 — 플레이어 + 미리보기

### 5단계 — 플레이어 + 미리보기 + 수업 설정 패널
- [x] `src/player/types.ts` + `adapters.ts` — `PlayerAdapter`(gradeAnswer/saveProgress/getProgress/submitResponse)로 실전(live, 실제 API)과 미리보기(preview, 로컬 즉시채점)가 **같은 Player 컴포넌트**를 공유
- [x] `src/lib/studentKey.ts`(sha256 기반), `src/lib/playerProgress.ts`(localStorage 진행상황), `src/lib/findQuestion.ts`(mock.ts와 공유하도록 추출)
- [x] `ApiClient`에 `getProgress(code, studentKey)` 추가 — "기기를 바꿔도 이어서 진행" 요구사항을 위해 계획에 없던 조회 전용 엔드포인트를 신설(사유는 없음, 자연스러운 확장이라 별도 ADR 안 씀)
- [x] `src/player/`: EntryScreen(식별 필드 입력) · ProgressBar(`lib/numbering.ts` 재사용) · NavBar(잠긴 것처럼 보이되 실제로는 클릭 가능 — 그래야 토스트/스크롤 피드백을 줄 수 있음) · SlideView(문항 지문 렌더링 + 즉시 피드백 배너 + 필수 미응답 링 표시) · SummaryView(점수 + onFinish 문항 첫 공개) · Player.tsx(입장→슬라이드→요약 전체 오케스트레이션)
- [x] 진행 잠금(`requireAnswerToAdvance` + 문항별 `required`), 즉시/종료후/비공개 피드백 3종 모두 구현, 자동저장(로컬+서버, 디바운스), 새로고침 재개(같은 기기), 기기 변경 재개(`getProgress`로 서버에서 복구)
- [x] `EditorPage`의 "미리보기"가 이제 **실제 Player를 preview 모드로 재사용** — 3단계의 단순 Viewer 나열 버전을 대체(PLAN.md 원래 의도대로 복귀)
- [x] **버그 하나 발견·수정**: 문항 6종의 Viewer가 `question.prompt`(문항 지문)를 전혀 렌더링하지 않고 있었다 — 학생 화면에 답변 위젯만 보이고 질문 자체가 안 보이는 심각한 버그. `SlideView.tsx`가 모든 문항 공통으로 지문을 렌더링하도록 고쳐서 해결(6종 Viewer 각각을 고치지 않고 한 곳에서 해결)
- [x] **범위 추가**: `src/editor/SettingsPanel.tsx` — 브라우저로 실제 플레이어를 테스트하다가 "피드백 모드·식별 필드를 바꿀 UI가 아예 없다"는 걸 발견해서 그 자리에서 만들어 넣음(수업 설명, 식별 필드 체크박스, 진행 잠금/뒤로가기 허용 토글, 기본 피드백 모드 선택). `editorStore`에 `updateDescription` 액션 추가
- [x] 테스트 49개 전부 통과(getProgress 테스트 1개 추가), typecheck/build 통과
- [x] **브라우저 풀 플로우 검증**: 수업 생성→필수 선택형 문항(20점) 작성→발행→학생 입장(이름 입력)→미응답 제출 시도(잠김+토스트 확인)→오답 제출(0/20 + onFinish 요약 공개)→새 학생 진입→정답 입력 후 **새로고침**(식별정보 그대로 이어서 진행 확인)→제출(20/20)→에디터 "미리보기"에서 동일 문항을 진짜 Player로 풀어봄(제출해도 실제 응답 목록엔 안 쌓이는 것 확인)→즉시 피드백 모드로 바꿔서 제출 전 인라인 정오답 배너 확인→설정 패널에서 식별필드·피드백모드 변경 저장 확인
- **참고(반복된 착시)**: 이번 세션에서도 자동저장 디바운스(3초) 시간을 재는 `await setTimeout(...)`이 여러 번 부족해서 "저장이 안 됐다"고 착각할 뻔한 경우가 세 번 있었다 — 실제로는 DOM/React 상태는 항상 맞았고, 조금 더 기다리면 localStorage에도 반영돼 있었다. **자동저장 확인 테스트는 넉넉히(4초 이상) 기다린 뒤에만 "저장 안 됨"으로 판단할 것.**

### 4단계 — 기본 문항 6종 + 문항 레지스트리

### 4단계 — 기본 문항 6종 + 문항 레지스트리
- [x] `src/blocks/questions/registry.ts` — 문항 kind → `{label, icon, createDefault, Editor, Viewer, grade, isAnswered}`. 등록하는 순간 `lib/grade.ts`에도 채점기가 자동 연결됨(`registerGrader` 내부 호출)
- [x] `src/blocks/questions/QuestionEditorShell.tsx` — 6종이 공유하는 틀(문항 지문 RichTextEditor + 필수/배점 + 해설)
- [x] 6종 구현(Editor+Viewer+grade+isAnswered 전부): **cloze**(빈칸, 입력/드롭다운 혼합, 세그먼트 편집기) · **choice**(단일/복수, 라디오·체크박스) · **short**(서답형, exact/contains 채점, `lib/textNormalize.ts` 공유) · **combo**(합답형, 진술 체크로 보기 라벨 자동생성) · **order**(순서배열, 교사는 화살표로 정답 순서 편집, 학생 화면은 dnd-kit로 섞어서 드래그 재배열) · **match**(연결형, 드래그 대신 탭-투-페어 방식 — 왼쪽 클릭→오른쪽 클릭으로 짝짓기, 모바일 친화적)
- [x] `src/editor/menuItems.ts` — 콘텐츠 블록(8) + 문항(6) = 14개를 하나의 슬래시 메뉴로 통합. `Canvas.tsx`/`PreviewFrame.tsx`가 `block.type==='question'`일 때 `blocks/QuestionBlockView.tsx`(kind로 questions 레지스트리에 위임)를 쓰도록 교체
- [x] 순수 채점 로직 테스트(`grading.test.ts`) 19개 추가 — 6종 전부 정답/오답/부분오답/`isAnswered` 케이스. 테스트 총 48개
- [x] **브라우저 검증**: 14개 항목이 슬래시 메뉴에 다 나오는지, 6종 문항을 전부 삽입해 편집 UI가 정상 렌더링되는지, choice는 실제 지문·보기·정답까지 입력해 저장 확인, match는 탭-투-페어(왼쪽 클릭→하이라이트→오른쪽 클릭→둘 다 초록 "짝지어짐" 표시)까지 실제 클릭으로 확인, 미리보기에서 6종 다 렌더링 확인
- **주의(다음에 참고)**: 브라우저 자동화 도중 `javascript_tool` 호출 하나가 45초 타임아웃으로 실패 처리됐는데, **실제로는 페이지 안에서 스크립트가 백그라운드로 계속 실행되고 있었다** — 그 결과를 "실패"로 오판하고 같은 동작을 수동으로 다시 했더니 short/combo/order 문항이 두 번씩 삽입되는 중복이 생겼다(테스트용 수업이라 그냥 정리하고 넘어감). **타임아웃이 나면 재시도하기 전에 반드시 실제 상태(localStorage 등)부터 확인할 것.**
- **PLAN.md와 다르게 구현한 부분**: match(연결형)는 계획서에 구체적 인터랙션이 정해져 있지 않았는데, 드래그 연결선 대신 **탭-투-페어**(항목을 순서대로 두 번 클릭)로 구현 — 모바일에서 두 열 사이 드래그보다 훨씬 안정적이고 터치하기 쉽다.

### 3단계 — 블록 레지스트리 + 기본 블록 + 에디터 셸

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

1. **10단계(결과 대시보드 + 엑셀 + 내보내기/가져오기)로 진행할 것** — `ResultsPage.tsx`는 아직 1단계 스텁 그대로다. `docs/PLAN.md`의 「교사 결과」 화면 설계(요약 카드, 문항별 정답률·분포, 학생별 답안표, 미디어 갤러리, SheetJS `.xlsx`, 데이터 완전 삭제) + `portable.ts`(수업 내보내기·가져오기·복제)를 구현할 것.
2. **사용자가 `apps-script/SETUP.md`를 따라 실제 배포**(이건 내가 대신 할 수 없다 — Google OAuth 동의는 사용자 확인이 꼭 필요한 행동). 배포 후 `.env.local`(`VITE_API_MODE=live`, `VITE_APPS_SCRIPT_URL=...`)을 채우고 `docs/OPERATIONS.md`에도 URL을 기록한 뒤, 실제로 수업 생성→발행→학생 제출까지 해보고 Drive에 파일이 잘 쌓이는지 확인할 것. (참고: 7~9단계에서 추가된 numeric/chem/math/dataTable/POE잠금도 `Code.gs`에 이식 완료됐으므로 실제 배포 후 이것들도 함께 검증할 것.)

## 미해결 이슈

- **리포지토리가 Private + GitHub Pages는 개인 계정 무료 플랜에서 Public 리포에만 무료 제공된다.** 11단계(실제 배포)에서 이 문제를 반드시 다시 짚을 것: (a) 리포를 Public으로 전환하거나 (b) GitHub Pro/조직 플랜을 쓰거나 (c) Pages 대신 다른 정적 호스팅(Netlify/Vercel 등)을 검토해야 한다. 코드 자체엔 비밀값이 없으므로(Apps Script URL은 공개 가능, editToken은 애초에 커밋 안 함) Public 전환이 가장 간단한 선택지가 될 가능성이 높다.
- **winget이 이 셸에서 동작하지 않음** (App Installer 패키지는 있지만 `winget.exe` alias 미해결, 관리자 권한도 없음). 앞으로 다른 도구 설치가 필요하면 winget에 의존하지 말고 (a) 사용자 폴더에 압축 해제하는 portable 배포판을 찾거나 (b) 사용자에게 직접 설치를 요청할 것.
- **Apps Script 백엔드가 실제로 배포·검증되지 않았다** (코드는 완료, 이유는 위 6단계 항목 참고). 사용자가 `apps-script/SETUP.md`대로 배포하기 전까지는 이론상으로만 맞는 상태다.
- **claude-in-chrome의 `computer` 툴(click/screenshot)이 이 세션 내내 불안정**했다 — `Page.captureScreenshot`이 매번 타임아웃되고, 프로그래매틱 `.focus()`/`.click()` 후에도 `document.hasFocus()`가 계속 `false`(이 자동화 탭이 OS 차원에서 "포그라운드"로 취급되지 않는 것으로 보임 — TipTap의 `editor.isFocused`가 이 값에 의존해서 버블 툴바 표시 여부를 자동화로는 확인 못 함, 명령 자체는 `editor.chain()...run()`으로 직접 검증함). **우회책**: `javascript_tool`로 실제 DOM에 `input`/`click` 이벤트를 직접 디스패치하고 `document.body.innerText`·`localStorage` 상태로 결과를 확인하는 방식이 이 세션 내내 안정적으로 동작했다. 다음 세션에서도 `computer` 툴이 같은 증상(스크린샷 타임아웃, 포커스 안 잡힘)을 보이면 재시도하지 말고 바로 `javascript_tool` 우회로 전환할 것.
- **SPA 같은 라우트로의 네비게이션은 컴포넌트를 리마운트하지 않는다** — 이번 세션에서 이걸 모르고 "복구 링크(`?key=`)가 안 먹힌다"고 착각할 뻔했다. `navigate` 툴이나 `location.href=`로 **같은 경로, 다른 쿼리** URL을 열어도 React Router가 같은 라우트 엘리먼트를 재사용해 `useState` 초기값이 다시 안 읽힌다. 새 마운트를 확인해야 하는 테스트(예: localStorage 초기 읽기, `?key=` 처리)는 반드시 `location.reload()`로 강제 새로고침해서 검증할 것 — `navigate`만으로는 오탐이 난다.
- **`javascript_tool`이 "CDP Runtime.evaluate timed out after 45000ms"를 던져도 페이지 안의 스크립트는 계속 실행 중일 수 있다.** 4단계에서 이걸 몰라서 타임아웃 = 실패로 오판하고 같은 삽입 동작을 수동으로 반복했다가 문항이 중복 삽입된 적이 있다(정리함). **타임아웃을 받으면 곧바로 같은 동작을 재시도하지 말고, 먼저 `localStorage`나 화면 상태를 읽어 실제로 실패했는지부터 확인할 것.**
- **claude-in-chrome이 여는 탭은 `document.hidden:true`(OS 포그라운드가 아님)로 유지된다** — 9단계에서 `ClassAggregate`의 `IntersectionObserver` 기반 폴링이 이 때문에 자동화로는 안 켜짐을 확인했다(기존 `document.hasFocus()` 항상 false 이슈와 같은 근본 원인으로 추정). 앞으로 `IntersectionObserver`·`requestIdleCallback`·Page Visibility API에 의존하는 기능을 자동화로 검증할 때는, 먼저 `document.hidden`을 확인하고 `false`가 안 되면 실제 폴링/옵저버 발동 대신 (1) 백엔드 API를 직접 호출해 데이터 정합성만 확인하거나 (2) React 파이버의 훅 `dispatch`를 직접 호출해 상태만 강제로 켜서 나머지 로직(폴링·렌더링)이 맞는지 확인하는 우회로 검증할 것(자세한 방법은 `docs/DECISIONS.md` 2026-07-28 항목 참고).

## 임시방편(TODO) 목록

- **`saveProgress`/`submitResponse`/`gradeAnswer`/`getProgress`가 테스트 모드(`isTest: true`) 여부와 `studentKey`를 클라이언트가 보낸 값 그대로 믿는다.** editToken 검증이 없다 — `mock.ts`와 `Code.gs` 둘 다 마찬가지다. 아무나 `isTest: true`를 보내 `_test` 응답을 쓰거나 남의 studentKey로 `getProgress`를 조회할 수 있다. 9~11단계(테스트 모드 UI가 실제로 필요해지는 시점)에서 반드시 다시 볼 것.
- **`Code.gs`의 `GRADERS`와 프런트엔드 `src/blocks/questions/*.tsx`의 채점 로직이 서로 다른 언어(GAS/TS)라 자동으로 동기화되지 않는다.** 7단계(numeric/chem/math)와 8단계(dataTable)에서 두 번 실제로 겪었고 두 곳 다 고쳤다. 9단계 이후 새 문항 유형이 생기면(이번엔 없지만) 같은 절차를 반복할 것.
- **`Code.gs`가 반환하는 이미지 URL 패턴(`drive.google.com/uc?export=view&id=...`)은 Google 공식 문서에 없는 방식이다.** 흔히 쓰이지만 Google이 언제든 바꿀 수 있다 — 운영 중 이미지가 갑자기 안 보이면 이 부분을 의심할 것.
- **mock.ts의 `uploadMedia`/`uploadStudentMedia`는 여전히 `URL.createObjectURL`만 반환한다**(새로고침하면 무효화됨) — `VITE_API_MODE=mock`(기본값)으로 개발할 때는 그대로다. `live` 모드에서는 `Code.gs`가 실제 Drive에 영속 저장한다.
- 프로덕션 번들이 1.1MB(gzip 349KB)로 경고 임계값을 넘음. 11단계에서 라우트별 코드 스플리팅 검토.
- 블록 속성 편집 UI가 별도 우측 패널이 아니라 각 블록 Editor 안에 인라인 — 문항이 늘어나는 7~8단계에서 너무 길어지면 재검토.
- 순서배열(order) 문항의 학생 화면 셔플이 시드 고정 없이 컴포넌트 마운트마다 다시 섞인다 — 5단계에서 `saveProgress` 연동을 마쳤으니, 실제로 "값이 있으면 그걸 우선 쓴다" 로직 덕에 한 번이라도 답을 건드리면 안정적이다. 완전히 안 건드리고 새로고침하는 극히 드문 경우만 남은 한계(사유는 DECISIONS.md) — 지금은 재검토 안 함.

## 단계 체크리스트 (전체, `docs/PLAN.md` 「구현 단계」와 동기화)

- [x] 0. 환경 준비 + 세션 연속성 확보
- [x] 1. 스캐폴딩
- [x] 2. 목 백엔드
- [x] 3. 블록 레지스트리 + 기본 블록
- [x] 4. 기본 문항 6종
- [x] 5. 플레이어 + 미리보기
- [x] 6. Apps Script 백엔드 (코드 완료 — **실제 배포는 사용자가 해야 함**, 위 참고)
- [x] 7. 수식·화학·수치
- [x] 8. 탐구 도구 (데이터표·차트·그리기·사진)
- [x] 9. 수업 운영 (조건분기·POE·학급집계·참고자료)
- [ ] 10. 결과 대시보드 + 엑셀 + 내보내기/가져오기
- [ ] 11. 테스트 모드 + 마감 + 배포
