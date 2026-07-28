/**
 * 교사 브라우저에 editToken을 보관한다 (docs/PLAN.md 소유권 검증 절).
 * 이 값을 잃어버리면 복구할 수 없다 — 발행 화면에서 복구 링크를 크게 보여주는 이유다.
 */
const KEY_PREFIX = 'class:editToken:'

export function saveEditToken(code: string, token: string): void {
  localStorage.setItem(KEY_PREFIX + code, token)
}

export function loadEditToken(code: string): string | null {
  return localStorage.getItem(KEY_PREFIX + code)
}

export function buildRecoveryLink(code: string, editToken: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/editor/${code}?key=${editToken}`
}

/** 이 링크는 editToken을 담고 있다 — 학생에게 절대 공유해선 안 된다 (docs/PLAN.md 테스트 모드 절). */
export function buildTestModeLink(code: string, editToken: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/play/${code}?test=${editToken}`
}
