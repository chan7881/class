# ROADMAP — 유사 서비스 벤치마킹 기반 기능 제안 + 실사용 리스크 대응 계획

> 2026-07-29 세션 4에서 작성. 경쟁 서비스(Nearpod/Pear Deck/Formative/Kahoot류/Edpuzzle/Desmos 등) 조사와 자체 코드베이스 인벤토리를 근거로 다음에 고려할 기능을 제안하고, 지금 규모(소수 교사 파일럿)에서 실제로 문제가 될 수 있는 부분의 대응 계획을 정리한 문서. 사용자가 그룹별로 실제 채택 항목을 골랐고, **채택된 9개는 이 세션에서 구현까지 끝냈다**(아래 "구현 완료" 표시). 나머지는 초안으로만 남기고 실행하지 않는다 — 다음에 이 문서를 다시 열어 채택 여부를 논의할 때 참고한다.

## 조사 근거

**자체 코드베이스 인벤토리**: 블록 8종 + 문항 12종(`blocks/registry.ts` 패턴), 조건분기·POE 잠금·학급 응답 익명 집계(10초 폴링)·참고자료 패널·테스트 모드·결과 대시보드(.xlsx). 확인된 갭: `math.compareMode:'symbolic'` 미구현, `getResults`는 페이지 로드 시 1회만 호출(실시간 갱신 없음), `ClassAggregate`는 익명 집계라 교사용 실시간 개인별 모니터링이 아님, 서답형은 "교사 수기 채점용"이라고 설계돼 있지만 실제 입력 UI가 없음, 수업 자동 만료(180일)는 스코프 제외됨, `LockService.getScriptLock()`이 전역 스크립트 락이라 모든 수업의 쓰기가 공유됨.

**경쟁 서비스 조사**: Nearpod/Pear Deck(Teacher-Paced 모드), Formative(라이브 모니터링 + 서답형 교사 피드백), Kahoot/Quizizz/Blooket/Gimkit(게임화, Smart Repetition), Edpuzzle(영상 구간 질문), Desmos/PhET(시뮬레이션 — 이미 `embed` 화이트리스트로 커버), ClassKick/Socrative(exit-ticket 템플릿, 차등 피드백). Google Apps Script 공식 쿼터(2026): 동시 실행 30개/사용자(무료), 실행당 6분 cap, 트리거 90분/일(무료). 한국 개인정보보호법·교육부 개인정보 보호지침: 보유기간 경과·목적 달성 시 파기 원칙.

---

## A. 기능 제안

### 채택 → 구현 완료 (2026-07-29)

- **실시간 교사 모니터링 대시보드** — `getResults`/`getAggregate`에 `CacheService` 캐싱(6~10초 TTL, 제출 시 캐시 무효화) 추가, `ResultsPage.tsx`에 8초 폴링(탭이 백그라운드면 정지) + "마지막 갱신" 표시. Formative 벤치마크.
- **교육과정 성취기준 태깅** — `QuestionBase.standardsTags?: string[]`, `QuestionEditorShell`에 `CommaListInput` 재사용한 자유 태그 입력. 정식 코드 목록 프리셋은 미포함(자유 텍스트만), 태그 검색/모아보기는 이번 범위 밖.
- **학생 입장 화면 개인정보 안내 문구 보완** — `EntryScreen.tsx`에 운영자 Drive/Sheets 보관 위치, 사진·그림 문항 시 추가 안내, 삭제 요청은 담당 교사 문의로 안내.

### 채택 → 구현 완료, 배포 대기 (P0/P1 실사용 리스크 대응)

- **관리자 비밀번호 brute-force 방지** — `Code.gs`에 `CacheService` 기반 실패 횟수 제한(10분 창에 10회 초과 시 일시 잠금). 스크립트 전체 공유 카운터라 완벽한 개인별 차단은 아님(트레이드오프는 `docs/DECISIONS.md` 참고).
- **editToken 로컬스토리지 보관 옵션("이 기기 기억")** — `lib/editorAuth.ts`의 `saveEditToken`에 `remember` 인자 추가(기본 `true`=기존 동작), `HomePage`/`EditorPage`에 체크박스. 끄면 세션스토리지만 사용해 탭을 닫으면 자동 삭제.
- **사진 hotlink 실사이트 재검증** — 실사이트에서 실제 사진 업로드 → `lh3.googleusercontent.com/d/<id>` 정상 표시 확인 완료(코드 변경 없음, 검증만).
- **Drive 사용량 가시성(관리자 화면)** — `Code.gs`에 `adminGetStorageUsage`(Drive API v3 `About.get`) 추가, `AdminPage.tsx`에 "Drive 사용량: n GB / 15GB" 표시. **주의**: Drive API 고급 서비스 활성화가 아직 안 됐다(아래 "미해결" 참고) — 활성화 전까지 이 줄은 조용히 안 보임(클라이언트가 실패를 삼키도록 설계됨).
- **GAS↔TS 채점 로직 이중관리 방지 체크리스트** — `CLAUDE.md` 규칙 4에 체크리스트 명문화. 순수 문서 작업, 배포 불필요.
- **`_meta` 컬럼 안전 재활용** — `Code.gs`의 `ensureQuestionColumns`가 완전히 빈 컬럼(응답이 한 번도 안 쓰인 컬럼)만 재활용하도록 수정. 이미 값이 있는 컬럼은 절대 재사용 안 함.

**배포 상태**: 위 Code.gs 변경분(brute-force 방지, Drive 사용량, `_meta` 재활용)은 저장까지 끝났지만 **"배포" 버튼 클릭이 자동화로 안 돼(아래 "미해결 이슈" 참고) 사용자가 직접 눌러야 한다.**

### 초안 — 보류 (실행 안 함, 다음에 재논의)

**중기(B그룹, 새 설계 개념 필요)**
- 절제된 게임화(리더보드/연속정답) — 이모지·화려한 이펙트 없이 텍스트·단색 기반으로만. "할지 여부" 자체를 먼저 결정해야 함.
- 영상 구간 내 질문(시청 강제) — PLAN.md Context에 "시청 강제·중간질문은 범위 밖"으로 이미 명시적으로 제외된 항목. 재검토하려면 기존 결정을 뒤집는 것.
- 공동 편집(보조 편집자 초대) — editToken 1개=소유자 1인 개념이라 "인증 없음" 아키텍처와 충돌 가능성, 신중한 설계 필요.

**장기/블루스카이(C그룹)**
- AI 문항 초안 생성 — 외부 LLM API 연동 필요, "서버 없음" 원칙과 충돌 가능성 있는 큰 결정.
- 적응형 반복학습(Gimkit Smart Repetition류) — 슬라이드/수업 단위 데이터 모델과 잘 안 맞음, 데이터 모델을 크게 건드려야 함.

**A그룹 중 미채택**
- 교사 진행 모드(Teacher-Paced) — Nearpod/Pear Deck 핵심 차별점이지만 이번엔 보류.
- 서답형 교사 수기 채점 UI — PLAN.md가 원래 의도했던 기능이지만 이번엔 보류.
- 수업 공개 갤러리(선택적 공유) — `cloneLessonForDuplicate` 재사용 가능한 낮은 비용 기능이지만 이번엔 보류.
- 빠른 Exit Ticket 템플릿 — 구현 비용이 가장 낮은 항목이지만 이번엔 보류.

---

## B. 실사용 리스크 + 업데이트 계획

### P0 — 채택된 항목은 위 "구현 완료" 참고. 미채택
- **수업 자동 만료(180일) 재추진** — 한국 개인정보보호법 취지와 어긋날 위험이 있으나 이번엔 보류. Apps Script 시간 기반 트리거 하나로 구현 가능.

### P1 — 전부 채택, 구현 완료(위 참고)

### P2 — 확산 시나리오 참고용, 착수 안 함 (파일럿 규모 우선순위 결정에 따라 보류)
- 전역 `LockService.getScriptLock()` — 모든 수업의 쓰기가 하나의 락을 공유. 동시 학급 수가 늘면 저장 지연이 전역으로 번짐.
- 무료 계정 동시 실행 30개 한도 — 여러 학급이 동시에 제출할 때 병목.
- `listLessons`/`getResults`의 선형 스캔 — 수업·응답이 누적될수록 느려짐.

---

## 미해결 이슈 (2026-07-29 세션 4)

1. **Code.gs 배포(버전 6→7) 버튼 클릭을 자동화로 완료 못 함.** "배포 관리" 다이얼로그의 버전 선택 드롭다운이 ref 클릭·좌표 클릭·합성 포인터 이벤트·키보드 탐색 전부에 응답하지 않았다(디버깅 결과 드롭다운 위에 다른 레이어가 겹쳐 클릭을 가로채고 있었고, `tabIndex=-1`이라 키보드 탭 순서에도 없었다). Code.gs 파일 저장 자체는 `remote === local` 비교로 검증 완료. **사용자가 직접 배포 관리 → 새 버전 → 배포를 눌러야 한다.**
2. **Drive API 고급 서비스 미활성화.** "서비스 추가" 대화상자에서 "Drive API"를 선택하려다 실수로 "AdSense Management API"가 추가됐다(선택 상태 확인 전에 확정 버튼을 눌러 발생). 이후 매니페스트(`appsscript.json`)를 직접 고쳐 바로잡으려 한 시도는 세이프티 분류기가 차단했다(민감한 설정 파일 수정으로 판단, 올바른 판단이었음). UI를 통한 제거도 여러 방법으로 시도했으나 실패. **사용자가 프로젝트 편집기 사이드바 "서비스"에서 AdSense를 제거하고 Drive API(v3)를 추가해야** `adminGetStorageUsage`(Drive 사용량 표시)가 동작한다. 그 전까지는 이 기능만 조용히 비활성 상태로 남는다(다른 기능에는 영향 없음, 클라이언트가 실패를 흡수하도록 이미 설계됨).

## 참고한 서비스·자료

- [Nearpod vs Pear Deck 2026](https://www.teachfloor.com/blog/nearpod-vs-peardeck)
- [Blooket vs Gimkit vs Kahoot vs Quizizz](https://www.teachfloor.com/blog/blooket-vs-gimkit-vs-kahoot--vs-quizizz)
- [Formative | Real-Time Instruction](https://www.formative.com/)
- [Edpuzzle — AVID](https://www.avid.org/digital-tools/Edpuzzle)
- [Amplify Desmos Classroom 2026 확장](https://newsroom.unl.edu/announce/nebraska-science/18831/101774)
- [PhET Interactive Simulations — Clever](https://clever.com/library/app/phetsims)
- [Google Apps Script Quotas 공식 문서](https://developers.google.com/apps-script/guides/services/quotas)
- [FERPA/COPPA EdTech 가이드 — McDermott](https://www.mcdermottlaw.com/insights/edtech-and-privacy-navigating-a-shifting-regulatory-landscape/)
- [교육부 개인정보 보호지침 — 국가법령정보센터](https://www.law.go.kr/LSW//admRulInfoP.do?admRulSeq=2100000186137&chrClsCd=010201)
- [Socrative Exit Tickets](https://www.socrative.com/blog/exit-tickets/) / [ClassKick](https://classkick.com/)
