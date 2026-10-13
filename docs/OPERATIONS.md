# OPERATIONS — 배포·운영 정보

**URL·ID는 적되 비밀 토큰(editToken 자체, 서비스 계정 키 등)은 절대 적지 않는다.**

## 주소

| 무엇 | 어디 |
|---|---|
| 사이트 | **https://chan7881.github.io/class/** |
| 리포지토리 | https://github.com/chan7881/class (**Public** — 코드에 비밀값이 없어 안전) |
| Apps Script **프로젝트 편집기** | `https://script.google.com/home/projects/1x0XdwHv0oPJPdMhCrkKjHUyq8cB-Qyjx0KK_0s_49HC9qYa5yrEQbYGc/edit` |
| Apps Script **웹앱**(`VITE_APPS_SCRIPT_URL`) | `https://script.google.com/macros/s/AKfycbyW_7otTN7_DX7BqR8SbcI6ZNy8w4U28bD7itMILNnmacU0H5LaDNj7JJYkUS6RcFg/exec` |
| Drive 루트 | `/InteractiveClass/` |
| 소유 계정 | *(운영자 Google 계정 — 실제 이메일은 여기 적지 않는다)* |

> **프로젝트 편집기는 위 직통 주소로 들어가라.** `script.google.com/home/my` 목록에서 자동화로
> 여는 것은 **매번 실패했다**(더블클릭·합성 이벤트·행 메뉴 전부, 목록에 앵커도 없음).

## GitHub Pages

`.github/workflows/deploy.yml`이 `main` 푸시 시 `npm ci` → `npm run test` → `npm run build` →
배포한다. Settings → Pages → Source는 **"GitHub Actions"**. `workflow_dispatch`도 켜져 있어
코드 변경 없이 수동 재배포가 가능하다(Actions → Deploy to GitHub Pages → Run workflow).

**live 모드 전환 완료**(2026-07-29) — Settings → Secrets and variables → Actions → **Variables**에
`VITE_API_MODE=live`와 `VITE_APPS_SCRIPT_URL`이 등록돼 있다. Secrets가 아니라 Variables인 이유는
`DECISIONS.md` 2026-07-28 참고(editToken 없이는 아무것도 못 하는 공개 엔드포인트라 비밀이 아니다).

## Apps Script 백엔드

**재배포 절차는 `CLAUDE.md`의 「Apps Script(`Code.gs`) 재배포 절차」**에 있다.
⚠️ **"새 배포"를 새로 만들면 안 된다** — 기존 배포를 **"새 버전"으로 편집**해야 URL이 유지된다.

### 배포 이력

| 버전 | 날짜 | 무엇 |
|---|---|---|
| **29** | 10-13 | 학생용 `getLesson`이 정답·해설 포함(기기 채점) · 수업 캐시 6시간·조각 저장 (**현재**) |
| 28 | 08-20 | 리팩터링 — 낭비 요청 제거·`writeStudentRow`로 쓰기 경로 통합 |
| 27 | 08-20 | 렉 줄이기 A~F(인덱스 캐시·`enterLesson`·`gradeAnswers`) + 컬럼 탈취 버그 수정 |
| 24 | 08-20 | `readLesson` 캐시 · `findRowIndexForRecord` 범위 축소 |
| 22 | 08-19 | `withLock`에 `flush()` · 식별정보 대조 · `mergeDuplicateResponses` |
| 21 | 08-18 | `_metaCache` · 행 전체 한 번 쓰기 · **전역 락 축소** |
| 19 | 08-18 | `forceSubmitAll` · `normalizeStoredIdentities` |
| 18 | 08-18 | `forceSubmit`(현황 암호 가능) · `regradeResponses`(편집 키 전용) |
| 16 | 08-08 | `setViewPassword`(현황 암호) |
| 15 | 08-08 | `getLive` |
| 14 | 08-06 | 제출 마감 · 짧은 주소(slug) · 개별 응답 삭제 · 보관기간 |
| 11 | 07-30 | 서답형 정답 미설정 시 오채점되던 버그 수정 |
| 8~10 | — | URL 임베드 시행착오, 원상복구됨 |
| 초판 | 07-28 | 사용자가 프로젝트 생성 → OAuth 동의까지 직접 수행 |

**스크립트 속성**: 관리자 화면(`/#/admin`)을 쓰려면 `ADMIN_PASSWORD`가 등록돼 있어야 한다
(등록 완료 상태). 이건 코드 배포가 아니라 **계정 설정 화면이라 사용자만 할 수 있다.**

## 장애 대응

- **Apps Script 할당량 초과** — 개인 계정은 일일 실행시간·Drive 쓰기 횟수에 한도가 있다.
  사용량이 늘면 학교/조직 Workspace 계정으로 옮기는 것을 검토.
- **배포 URL이 바뀌었을 때** — `.env.local`과 리포 Variables를 갱신하고 재배포.
  정상적으로 "기존 배포를 새 버전으로 편집"했다면 URL은 안 바뀐다.
- **응답 스프레드시트 복구** — Drive 휴지통에서 복원 → `_index`의 파일 ID 매핑이 유효한지 확인.
- **이미지가 갑자기 안 보일 때** — 반환 URL `lh3.googleusercontent.com/d/<id>`는 **Google 비공식
  패턴**이다(옛 `drive.google.com/uc?export=view`가 실제로 죽어서 2026-07-29에 교체했다).
  Google이 또 바꿨을 수 있으니 **Drive에서 파일 자체가 살아 있는지 먼저 확인**하고 URL 생성
  방식을 재검토할 것.

## 수업 데이터 만료·삭제

- **자동 만료(180일)는 미구현**이다(2026-07-28 범위 제외 결정 → `DECISIONS.md`·`ROADMAP.md`).
- **교사가 직접 삭제**: 결과 대시보드의 「수업 데이터 완전 삭제」 → Drive 파일 + 응답 시트 일괄 삭제.
  ⚠️ 이 버튼은 `window.confirm`을 거치므로 **자동화로 클릭하면 CDP가 멈춘다.**
