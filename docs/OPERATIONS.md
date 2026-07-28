# OPERATIONS — 배포·운영 정보

이 파일에는 실제 배포 URL, Drive 폴더 위치, 장애 대응 절차가 들어간다. **URL·ID 값을 채우더라도 비밀 토큰(editToken 자체, 서비스 계정 키 등)은 절대 적지 않는다.**

## GitHub Pages

- 리포지토리: https://github.com/chan7881/class (**Public**, 2026-07-28 전환 완료 — 코드에 비밀값이 없어 안전, 근거는 `docs/DECISIONS.md` 참고)
- **배포 URL: https://chan7881.github.io/class/** (2026-07-28 첫 배포 완료·확인함)
- 배포 방식: `.github/workflows/deploy.yml`이 `main` 푸시 시 자동으로 `npm ci`→`npm run test`→`npm run build`→GitHub Pages 배포. 리포 Settings → Pages → Source는 "GitHub Actions"로 설정돼 있다.
- **지금은 mock 모드로 배포돼 있다**(`VITE_API_MODE`/`VITE_APPS_SCRIPT_URL`을 리포 Variables에 아직 안 넣었음 — 아래 Apps Script 배포 항목 참고). 즉 지금 이 URL에서 만든 수업은 방문자의 브라우저 localStorage에만 남고 다른 사람과 공유되지 않는다. Apps Script를 배포하고 나면 리포 Settings → Secrets and variables → Actions → Variables에 `VITE_API_MODE=live`, `VITE_APPS_SCRIPT_URL=<배포 URL>`을 등록하면 다음 배포부터 실제 중앙 백엔드를 쓴다(워크플로 파일 수정 불필요).

## Apps Script 백엔드

- **상태: 코드는 완료(6단계), 실제 배포는 아직 안 됨.** `apps-script/Code.gs`를 script.google.com에 붙여넣고 웹앱으로 배포하는 절차는 Google 계정 OAuth 동의가 필요해 사용자 본인만 할 수 있다 — `apps-script/SETUP.md`를 따라 직접 배포할 것.
- 배포 URL(`VITE_APPS_SCRIPT_URL`): *(배포 후 채움. `.env.local`에도 동일하게 넣을 것 — 이 파일에 적어도 되는 이유는 배포 URL 자체는 `editToken` 없이는 아무 것도 할 수 없는 공개 엔드포인트이기 때문)*
- 소유 계정: *(운영자 Google 계정 — 실제 이메일은 여기 적지 말고, 필요 시 개인 메모에 보관)*
- 배포 절차: `apps-script/SETUP.md` 참고
- Drive 루트 폴더: `/InteractiveClass/` (하위 구조는 `docs/PLAN.md`의 아키텍처 절 참고)
- 코드를 고친 뒤 재배포할 때는 **"새 배포"가 아니라 기존 배포를 "새 버전"으로 편집**해야 URL이 안 바뀐다 (`SETUP.md`의 "코드를 고친 뒤 다시 배포하기" 절 참고)

## 장애 대응 (11단계에서 실제 사례가 생기면 채워나감)

- **Apps Script 할당량 초과 시**: 개인 계정 기준 일일 실행시간·Drive 쓰기 횟수에 한도가 있다(`apps-script/SETUP.md` 참고). 사용량이 늘면 학교/조직 Google Workspace 계정으로 옮기는 걸 검토할 것.
- **배포 URL이 바뀌었을 때** (재배포로 새 `/exec` URL이 발급된 경우): `.env.local`과 GitHub Pages 환경변수를 갱신하고 재빌드·재배포. 정상적으로 "기존 배포를 새 버전으로 편집"했다면 URL은 안 바뀐다.
- **응답 스프레드시트 복구**: Google Drive 휴지통에서 복원 시도 → `_index` 스프레드시트의 파일 ID 매핑이 유효한지 확인
- **교사·학생이 올린 이미지가 갑자기 안 보일 때**: `uploadMedia`/`uploadStudentMedia`가 반환하는 URL(`drive.google.com/uc?export=view&id=...`)은 Google 비공식 패턴이다. Google이 동작을 바꿨을 가능성이 있으니, Drive에서 파일 자체가 살아있는지 먼저 확인하고 URL 생성 방식을 재검토할 것.

## 수업 데이터 만료·삭제 정책

- 기본 자동 만료(180일): **이번 범위에서 구현하지 않기로 결정**(2026-07-28, 근거는 `docs/DECISIONS.md` 참고) — Apps Script 시간 트리거·배치 삭제 로직이 필요해 범위가 커서 TODO로 남김. 나중에 필요해지면 재검토.
- 교사가 직접 삭제: 결과 대시보드의 "수업 데이터 완전 삭제" 버튼 → Drive 파일 + 응답 시트 일괄 삭제 (10단계에서 구현 완료)
