# PROGRESS — 현재 진행 상황

> 이 파일을 가장 먼저 읽어라. 매 작업 종료 시 갱신한다.

**마지막 갱신**: 2026-07-28 · 세션 1

## 지금 어디까지 됐나

**0단계(환경 준비 + 세션 연속성 확보) 거의 완료.** 남은 건 GitHub remote 연결뿐.

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

1. **1단계 스캐폴딩 시작**: Vite+React+TS 프로젝트 생성, Tailwind v4, HashRouter, 디자인 토큰, 공통 컴포넌트, `types/lesson.ts`, `lib/migrate.ts` 뼈대

## 미해결 이슈

- **리포지토리가 Private + GitHub Pages는 개인 계정 무료 플랜에서 Public 리포에만 무료 제공된다.** 11단계(실제 배포)에서 이 문제를 반드시 다시 짚을 것: (a) 리포를 Public으로 전환하거나 (b) GitHub Pro/조직 플랜을 쓰거나 (c) Pages 대신 다른 정적 호스팅(Netlify/Vercel 등)을 검토해야 한다. 코드 자체엔 비밀값이 없으므로(Apps Script URL은 공개 가능, editToken은 애초에 커밋 안 함) Public 전환이 가장 간단한 선택지가 될 가능성이 높다.
- **winget이 이 셸에서 동작하지 않음** (App Installer 패키지는 있지만 `winget.exe` alias 미해결, 관리자 권한도 없음). 앞으로 다른 도구 설치가 필요하면 winget에 의존하지 말고 (a) 사용자 폴더에 압축 해제하는 portable 배포판을 찾거나 (b) 사용자에게 직접 설치를 요청할 것.
- Apps Script 배포는 6단계 예정. 그 전까지 `VITE_APPS_SCRIPT_URL`은 비워둔다.

## 임시방편(TODO) 목록

(아직 없음 — 구현이 시작되면 여기에 "지금은 이렇게 해뒀지만 나중에 고쳐야 함" 항목을 기록한다)

## 단계 체크리스트 (전체, `docs/PLAN.md` 「구현 단계」와 동기화)

- [ ] 0. 환경 준비 + 세션 연속성 확보 (진행 중)
- [ ] 1. 스캐폴딩
- [ ] 2. 목 백엔드
- [ ] 3. 블록 레지스트리 + 기본 블록
- [ ] 4. 기본 문항 6종
- [ ] 5. 플레이어 + 미리보기
- [ ] 6. Apps Script 백엔드 (여기서 기본 제품 완성)
- [ ] 7. 수식·화학·수치
- [ ] 8. 탐구 도구 (데이터표·차트·그리기·사진)
- [ ] 9. 수업 운영 (조건분기·POE·학급집계·참고자료)
- [ ] 10. 결과 대시보드 + 엑셀 + 내보내기/가져오기
- [ ] 11. 테스트 모드 + 마감 + 배포
