# SESSION_LOG — 세션별 요약

새 세션이 끝날 때마다 맨 위에 추가한다(최신이 위로). 3~5줄, "다음 세션이 알아야 할 것" 위주로 짧게.

---

## 세션 1 — 2026-07-28

- 요구사항 논의 후 계획 확정: React+Vite+TS, GitHub Pages + 중앙 배포 Apps Script, 문항 12종(과학 특화 포함: 수식·화학식 버튼 입력, 허용오차/유효숫자/단위 채점, 데이터표 자동계산·추세선, 그리기·사진 답안, POE 잠금, 조건 분기 4-1/4-2, 참고자료 패널, 학급 응답 집계, 교사 미리보기+테스트 모드).
- 계획서를 `docs/PLAN.md`(원본)와 `docs/구현계획서.docx`(Word 사본)로 저장. 다음 세션 재개용 안내(`다음_세션_작업_방법.txt`)를 프로젝트 루트에 작성.
- **0단계 진행 중**: Node.js 설치(winget 불가 → zip 수동 설치로 우회, 상세는 `docs/DECISIONS.md`), `git init`, `CLAUDE.md`/`PROGRESS.md`/`DECISIONS.md` 작성 완료. `SESSION_LOG.md`(이 파일)·`OPERATIONS.md`·메모리 기록·첫 커밋·GitHub remote 연결은 아직.
- **다음 세션이 알아야 할 것**: GitHub 리포 URL을 아직 못 받음(사용자가 github.com에서 직접 생성 필요) — 받는 즉시 remote 연결하고 이후 단계마다 푸시할 것. 0단계 마무리 후 1단계(Vite 스캐폴딩)로 진행.
