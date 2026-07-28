# OPERATIONS — 배포·운영 정보

이 파일에는 실제 배포 URL, Drive 폴더 위치, 장애 대응 절차가 들어간다. **URL·ID 값을 채우더라도 비밀 토큰(editToken 자체, 서비스 계정 키 등)은 절대 적지 않는다.**

## GitHub Pages

- 리포지토리: https://github.com/chan7881/class (**Public**, 2026-07-28 전환 완료 — 코드에 비밀값이 없어 안전, 근거는 `docs/DECISIONS.md` 참고)
- **배포 URL: https://chan7881.github.io/class/** (2026-07-28 첫 배포 완료·확인함)
- 배포 방식: `.github/workflows/deploy.yml`이 `main` 푸시 시 자동으로 `npm ci`→`npm run test`→`npm run build`→GitHub Pages 배포. 리포 Settings → Pages → Source는 "GitHub Actions"로 설정돼 있다.
- **아직 mock 모드로 배포된다.** 리포 Settings → Secrets and variables → Actions → **Variables**에 `VITE_API_MODE=live`, `VITE_APPS_SCRIPT_URL`(아래 값)을 등록하는 건 아직 안 했다 — 사용자가 GitHub 설정에서 직접 등록하면 다음 배포부터 실제 Apps Script 백엔드로 전환된다(워크플로 파일 수정 불필요, 비밀값 아니라서 Secrets 아닌 Variables면 충분).

## Apps Script 백엔드

- **상태: 2026-07-28 실제 배포 완료 + 재배포 1회(버그 수정) 완료.** 사용자가 직접 script.google.com에서 프로젝트 생성 → 코드 붙여넣기 → 웹앱 배포 → OAuth 동의까지 마쳤다.
- 배포 URL(`VITE_APPS_SCRIPT_URL`): `https://script.google.com/macros/s/AKfycbyW_7otTN7_DX7BqR8SbcI6ZNy8w4U28bD7itMILNnmacU0H5LaDNj7JJYkUS6RcFg/exec` — `doGet` 상태 확인 응답(`{"ok":true,"data":{"status":"InteractiveClass 백엔드가 정상 동작 중입니다."}}`)까지 확인함. **로컬 `.env.local`에는 이미 등록돼 있어 `npm run dev`가 실제 백엔드를 쓴다.** GitHub 리포 Variables에는 아직 등록 안 함(위 GitHub Pages 항목 참고, 비밀값 아님 — editToken 없이는 아무 것도 할 수 없는 공개 엔드포인트).
- 소유 계정: *(운영자 Google 계정 — 실제 이메일은 여기 적지 말고, 필요 시 개인 메모에 보관)*
- 배포 절차: `apps-script/SETUP.md` 참고
- Drive 루트 폴더: `/InteractiveClass/` — 실제 수업 생성→발행→학생 제출까지 전부 검증 완료(테스트용으로 만든 수업들은 확인 후 `deleteLesson`으로 정리함)
- 코드를 고친 뒤 재배포할 때는 **"새 배포"가 아니라 기존 배포를 "새 버전"으로 편집**해야 URL이 안 바뀐다 (`SETUP.md`의 "코드를 고친 뒤 다시 배포하기" 절 참고) — 2026-07-28에 saveProgress 경쟁 조건 버그를 고치면서 이 절차로 실제 재배포까지 한 번 해봤고, URL이 그대로 유지됨을 확인했다.

## 장애 대응 (11단계에서 실제 사례가 생기면 채워나감)

- **Apps Script 할당량 초과 시**: 개인 계정 기준 일일 실행시간·Drive 쓰기 횟수에 한도가 있다(`apps-script/SETUP.md` 참고). 사용량이 늘면 학교/조직 Google Workspace 계정으로 옮기는 걸 검토할 것.
- **배포 URL이 바뀌었을 때** (재배포로 새 `/exec` URL이 발급된 경우): `.env.local`과 GitHub Pages 환경변수를 갱신하고 재빌드·재배포. 정상적으로 "기존 배포를 새 버전으로 편집"했다면 URL은 안 바뀐다.
- **응답 스프레드시트 복구**: Google Drive 휴지통에서 복원 시도 → `_index` 스프레드시트의 파일 ID 매핑이 유효한지 확인
- **교사·학생이 올린 이미지가 갑자기 안 보일 때**: `uploadMedia`/`uploadStudentMedia`가 반환하는 URL(`drive.google.com/uc?export=view&id=...`)은 Google 비공식 패턴이다. Google이 동작을 바꿨을 가능성이 있으니, Drive에서 파일 자체가 살아있는지 먼저 확인하고 URL 생성 방식을 재검토할 것.

## 수업 데이터 만료·삭제 정책

- 기본 자동 만료(180일): **이번 범위에서 구현하지 않기로 결정**(2026-07-28, 근거는 `docs/DECISIONS.md` 참고) — Apps Script 시간 트리거·배치 삭제 로직이 필요해 범위가 커서 TODO로 남김. 나중에 필요해지면 재검토.
- 교사가 직접 삭제: 결과 대시보드의 "수업 데이터 완전 삭제" 버튼 → Drive 파일 + 응답 시트 일괄 삭제 (10단계에서 구현 완료)
