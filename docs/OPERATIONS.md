# OPERATIONS — 배포·운영 정보

이 파일에는 실제 배포 URL, Drive 폴더 위치, 장애 대응 절차가 들어간다. **URL·ID 값을 채우더라도 비밀 토큰(editToken 자체, 서비스 계정 키 등)은 절대 적지 않는다.**

## GitHub Pages

- 리포지토리: https://github.com/chan7881/class (**Public**, 2026-07-28 전환 완료 — 코드에 비밀값이 없어 안전, 근거는 `docs/DECISIONS.md` 참고)
- **배포 URL: https://chan7881.github.io/class/** (2026-07-28 첫 배포 완료·확인함)
- 배포 방식: `.github/workflows/deploy.yml`이 `main` 푸시 시 자동으로 `npm ci`→`npm run test`→`npm run build`→GitHub Pages 배포. 리포 Settings → Pages → Source는 "GitHub Actions"로 설정돼 있다. `workflow_dispatch`도 켜져 있어 코드 변경 없이 수동으로 재배포 트리거 가능(Actions → Deploy to GitHub Pages → Run workflow).
- **2026-07-29 live 모드 전환 완료.** 리포 Settings → Secrets and variables → Actions → **Variables**에 `VITE_API_MODE=live`, `VITE_APPS_SCRIPT_URL`(아래 값)을 등록 완료(claude-in-chrome으로 직접 등록, 사용자가 "니가해"로 위임). 등록 직후 `workflow_dispatch`로 배포를 수동 트리거해(Run #5, 47초, 테스트 154개 통과) 반영했고, **실제 사이트(`https://chan7881.github.io/class/`)에서 수업 생성 시 `script.google.com`으로 실제 POST 요청이 나가 200 응답을 받는 것까지 네트워크 탭으로 확인함.** GitHub Pages 배포도 이제 진짜 Apps Script 백엔드로 동작한다.
- 검증 과정에서 만든 테스트 수업(코드 `BECGXB`, 빈 수업)은 사용자가 삭제 확인 대화상자를 직접 눌러 정리 완료(`getLesson` API로 삭제 확인함).

## Apps Script 백엔드

- **프로젝트 편집기 주소**: `https://script.google.com/home/projects/1x0XdwHv0oPJPdMhCrkKjHUyq8cB-Qyjx0KK_0s_49HC9qYa5yrEQbYGc/edit` — `script.google.com/home/my` 목록에서 프로젝트를 **자동화로 여는 데 매번 실패**한다(더블클릭·합성 이벤트·행 메뉴 전부, 목록에 앵커도 없음). 이 주소로 바로 들어가면 그 단계를 건너뛴다.
- **상태: 2026-07-28 실제 배포 완료, 이후 여러 차례 재배포(가장 최근 2026-08-08, **버전 16** — 진행 상황 화면 전용 `setViewPassword`(현황 암호) 추가. 그 직전이 **버전 15** — 실시간 진행 모니터링용 `getLive` 액션 추가. 임시 수업으로 실서버 확인 후 정리, `docs/PROGRESS.md` 세션 14 참고. 그 이전은 2026-08-06 **버전 14** — 제출 마감·짧은 수업 주소(slug)·개별 응답 삭제·응답 보관기간 4건 추가. 임시 수업을 만들어 네 기능 모두 실서버에서 확인하고 정리함, `docs/PROGRESS.md` 세션 8 참고. 그 이전은 2026-07-30 버전 11 — 서답형 정답 미설정 시 오채점되던 버그 수정. 버전 8~10은 URL 임베드 기능 시행착오로 배포했다가 원상복구한 것).** 사용자가 직접 script.google.com에서 프로젝트 생성 → 코드 붙여넣기 → 웹앱 배포 → OAuth 동의까지 마쳤고, 이후 재배포는 사용자 승인 하에 어시스턴트가 CLAUDE.md 절차대로 수행한다.
- 배포 URL(`VITE_APPS_SCRIPT_URL`): `https://script.google.com/macros/s/AKfycbyW_7otTN7_DX7BqR8SbcI6ZNy8w4U28bD7itMILNnmacU0H5LaDNj7JJYkUS6RcFg/exec` — `doGet` 상태 확인 응답(`{"ok":true,"data":{"status":"InteractiveClass 백엔드가 정상 동작 중입니다."}}`)까지 확인함. **로컬 `.env.local`에는 이미 등록돼 있어 `npm run dev`가 실제 백엔드를 쓴다.** GitHub 리포 Variables에는 아직 등록 안 함(위 GitHub Pages 항목 참고, 비밀값 아님 — editToken 없이는 아무 것도 할 수 없는 공개 엔드포인트).
- 소유 계정: *(운영자 Google 계정 — 실제 이메일은 여기 적지 말고, 필요 시 개인 메모에 보관)*
- 배포 절차: `apps-script/SETUP.md` 참고
- Drive 루트 폴더: `/InteractiveClass/` — 실제 수업 생성→발행→학생 제출까지 전부 검증 완료(테스트용으로 만든 수업들은 확인 후 `deleteLesson`으로 정리함)
- 코드를 고친 뒤 재배포할 때는 **"새 배포"가 아니라 기존 배포를 "새 버전"으로 편집**해야 URL이 안 바뀐다 (`SETUP.md`의 "코드를 고친 뒤 다시 배포하기" 절 참고) — 2026-07-28에 saveProgress 경쟁 조건 버그를 고치면서 이 절차로 실제 재배포까지 한 번 해봤고, URL이 그대로 유지됨을 확인했다.
- **⚠️ 2026-07-29(세션 3)에 `Code.gs`를 다시 크게 고쳤는데 아직 재배포 안 됨** — 이미지 URL 패턴 교체, 관리자 API 3종(`listLessons`/`adminGetLesson`/`adminDeleteLesson`) 추가, 데이터표 채점 코드 삭제, 서답형 키워드 채점 추가. 위 "새 버전으로 편집" 절차로 재배포해야 실제 사이트에 반영된다. 관리자 화면(`/#/admin`)을 쓰려면 **스크립트 속성에 `ADMIN_PASSWORD`도 추가로 등록**해야 한다(`SETUP.md` "3-1" 절).

## 장애 대응 (11단계에서 실제 사례가 생기면 채워나감)

- **Apps Script 할당량 초과 시**: 개인 계정 기준 일일 실행시간·Drive 쓰기 횟수에 한도가 있다(`apps-script/SETUP.md` 참고). 사용량이 늘면 학교/조직 Google Workspace 계정으로 옮기는 걸 검토할 것.
- **배포 URL이 바뀌었을 때** (재배포로 새 `/exec` URL이 발급된 경우): `.env.local`과 GitHub Pages 환경변수를 갱신하고 재빌드·재배포. 정상적으로 "기존 배포를 새 버전으로 편집"했다면 URL은 안 바뀐다.
- **응답 스프레드시트 복구**: Google Drive 휴지통에서 복원 시도 → `_index` 스프레드시트의 파일 ID 매핑이 유효한지 확인
- **교사·학생이 올린 이미지가 갑자기 안 보일 때**: `uploadMedia`/`uploadStudentMedia`가 반환하는 URL(`lh3.googleusercontent.com/d/<id>`, 2026-07-29부터 — 이전엔 `drive.google.com/uc?export=view&id=...`였는데 이게 실제로 문제를 일으켜 교체함, `docs/PROGRESS.md` 세션 3 6번 참고)은 여전히 Google 비공식 패턴이다. Google이 또 동작을 바꿨을 가능성이 있으니, Drive에서 파일 자체가 살아있는지 먼저 확인하고 URL 생성 방식을 재검토할 것.

## 수업 데이터 만료·삭제 정책

- 기본 자동 만료(180일): **이번 범위에서 구현하지 않기로 결정**(2026-07-28, 근거는 `docs/DECISIONS.md` 참고) — Apps Script 시간 트리거·배치 삭제 로직이 필요해 범위가 커서 TODO로 남김. 나중에 필요해지면 재검토.
- 교사가 직접 삭제: 결과 대시보드의 "수업 데이터 완전 삭제" 버튼 → Drive 파일 + 응답 시트 일괄 삭제 (10단계에서 구현 완료)
