# ROADMAP — 아직 안 만든 것들

> 2026-07-29(세션 4)에 경쟁 서비스(Nearpod·Pear Deck·Formative·Kahoot류·Edpuzzle·Desmos 등)를
> 조사해 만든 제안 목록이다. **채택한 9건은 그때 구현까지 끝났고**, 나머지가 아래 남은 것이다.
>
> **이 문서는 「다음에 뭘 만들까」를 고민할 때만 연다.** 2026-09-03에 압축하면서
> 이미 구현된 항목의 서술과 그 시점의 배포 상태를 걷어냈다 — 전부 `git show 84fe489:docs/ROADMAP.md`.

## ⚠️ 그때 채택했다가 나중에 철회한 것

- **실시간 교사 모니터링(8초 폴링)** — 2026-07-29에 채택·구현했으나 **2026-08-18에 철회**했다.
  `getLive` 한 번이 실측 13~17초라 8초 주기면 요청이 계속 겹쳐 쌓였다. 지금은 교사가
  「새로고침」을 누를 때만 갱신한다. → `DECISIONS.md` 2026-08-18
- **데이터표 기울기·절편 자동 채점(`answerTargets`)** — 2026-07-29에 제거. 그리기·사진과 같은
  "교사 수기 확인" 패턴으로 통일했다.

**교훈**: 폴링 주기를 정하기 전에 **한 왕복이 실제로 몇 초인지부터 잰다.**

## 미채택 제안 — 다시 논의할 때 보는 목록

### A그룹 (기존 구조로 만들 수 있는 것)

| 항목 | 메모 |
|---|---|
| 교사 진행 모드(Teacher-Paced) | Nearpod/Pear Deck의 핵심 차별점 |
| 서답형 교사 수기 채점 UI | PLAN이 원래 의도했던 기능인데 입력 UI가 없다 |
| 수업 공개 갤러리(선택적 공유) | `cloneLessonForDuplicate` 재사용 가능 — **비용이 가장 낮다** |
| 빠른 Exit Ticket 템플릿 | 구현 비용이 낮다 |
| 교육과정 성취기준 태깅 심화 | 자유 태그 입력은 구현됨. **정식 코드 목록 프리셋·태그 검색은 미구현** |

### B그룹 (새 설계 개념이 필요)

- **절제된 게임화**(리더보드·연속정답) — 이모지·화려한 이펙트 없이 텍스트·단색 기반으로만.
  "할지 여부" 자체를 먼저 결정해야 한다.
- **영상 구간 내 질문(시청 강제)** — PLAN이 **명시적으로 범위 밖**으로 제외한 항목이다.
  재검토하려면 기존 결정을 뒤집는 것.
- **공동 편집(보조 편집자 초대)** — `editToken` 1개 = 소유자 1인 개념이라 "인증 없음"
  아키텍처와 충돌할 수 있다.

### C그룹 (장기/블루스카이)

- **AI 문항 초안 생성** — 외부 LLM API 연동이 필요해 "서버 없음" 원칙과 충돌할 수 있는 큰 결정.
- **적응형 반복학습**(Gimkit Smart Repetition류) — 슬라이드/수업 단위 데이터 모델과 안 맞아
  모델을 크게 건드려야 한다.

## 실사용 리스크 — 아직 안 건드린 것

- **수업 자동 만료(180일)** — PLAN에 개인정보 보호 장치로 명시돼 있으나 미구현.
  Apps Script 시간 트리거 + 배치 삭제가 필요하다. 지금은 교사가 결과 페이지에서 **수동으로**
  "수업 데이터 완전 삭제"를 누를 수 있어 최소 안전장치는 있다.
- **무료 계정 동시 실행 30개 한도** — 여러 학급이 동시에 제출할 때의 병목.
- **`listLessons`/`getResults`의 선형 스캔** — 수업·응답이 누적될수록 느려진다.
- ~~전역 `LockService`가 모든 수업의 쓰기를 직렬화~~ → **2026-08-18에 해결**
  (구조 변경 시에만 락을 잡도록 바꿨다).

## 확인이 안 끝난 것

- **Drive API 고급 서비스** — 2026-07-29에 "서비스 추가"에서 실수로 **AdSense Management API**가
  추가됐고, 매니페스트 직접 수정은 세이프티 분류기에 차단됐다. **사용자가 프로젝트 편집기
  사이드바 「서비스」에서 AdSense를 제거하고 Drive API(v3)를 추가해야** 관리자 화면의
  `adminGetStorageUsage`(Drive 사용량 표시)가 동작한다. 그 전까지 이 줄은 조용히 안 보인다
  (클라이언트가 실패를 흡수하도록 설계됨 — 다른 기능에는 영향 없음).
  **2026-07-29 이후로 처리 여부를 확인하지 않았다.**

## 참고한 서비스·자료

[Nearpod vs Pear Deck](https://www.teachfloor.com/blog/nearpod-vs-peardeck) ·
[Blooket vs Gimkit vs Kahoot vs Quizizz](https://www.teachfloor.com/blog/blooket-vs-gimkit-vs-kahoot--vs-quizizz) ·
[Formative](https://www.formative.com/) ·
[Edpuzzle](https://www.avid.org/digital-tools/Edpuzzle) ·
[Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas) ·
[교육부 개인정보 보호지침](https://www.law.go.kr/LSW//admRulInfoP.do?admRulSeq=2100000186137&chrClsCd=010201) ·
[Socrative Exit Tickets](https://www.socrative.com/blog/exit-tickets/) · [ClassKick](https://classkick.com/)
