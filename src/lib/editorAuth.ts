/**
 * 교사 브라우저에 editToken을 보관한다 (docs/PLAN.md 소유권 검증 절).
 * 이 값을 잃어버리면 복구할 수 없다 — 발행 화면에서 복구 링크를 크게 보여주는 이유다.
 */
const KEY_PREFIX = 'class:editToken:'

/**
 * `remember:false`면 세션스토리지에만 저장해 탭·브라우저를 닫으면 자동으로 지워진다 — 공용 PC에서
 * 다음 사용자가 편집 권한을 이어받는 위험을 줄이기 위한 선택지(기본값은 기존 동작 그대로 유지,
 * 2026-07-29 추가, docs/DECISIONS.md 참고).
 */
export function saveEditToken(code: string, token: string, remember = true): void {
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(KEY_PREFIX + code, token)
  if (remember) sessionStorage.removeItem(KEY_PREFIX + code)
  else localStorage.removeItem(KEY_PREFIX + code)
}

export function loadEditToken(code: string): string | null {
  return localStorage.getItem(KEY_PREFIX + code) ?? sessionStorage.getItem(KEY_PREFIX + code)
}

export function buildRecoveryLink(code: string, editToken: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/editor/${code}?key=${editToken}`
}

/** 학생이 수업 코드를 직접 입력하지 않고 바로 입장하는 링크 — QR코드로도 쓴다. */
export function buildPlayLink(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/play/${code}`
}

/** 이 링크는 editToken을 담고 있다 — 학생에게 절대 공유해선 안 된다 (docs/PLAN.md 테스트 모드 절). */
export function buildTestModeLink(code: string, editToken: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/play/${code}?test=${editToken}`
}
