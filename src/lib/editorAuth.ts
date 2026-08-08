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

// ── 진행 상황 화면(/live)의 열쇠 ────────────────────────────────────────
// 여기로 들어가는 길은 둘이다 — 편집 키(64자 16진수)와 교사가 정한 현황 암호.
// 둘은 **저장하는 자리가 다르고**, 자리를 틀리면 서버가 엉뚱한 항목으로 대조해 조용히 거부한다.
// 그래서 판단 규칙을 이 파일 한 곳에만 두고 홈 화면과 진행 상황 화면이 같이 쓴다
// (규칙이 두 곳에 흩어져 있던 탓에 실제로 홈에서 넣은 현황 암호가 안 먹는 버그가 있었다).

export const VIEW_PASSWORD_KEY_PREFIX = 'class:live:viewPassword:'

/** 편집 키는 32바이트를 16진수로 적은 값이라 언제나 64자다 — 사람이 정하는 암호와 헷갈릴 일이 없다. */
export function looksLikeEditToken(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim())
}

export function loadViewPassword(code: string): string | null {
  return localStorage.getItem(VIEW_PASSWORD_KEY_PREFIX + code) ?? sessionStorage.getItem(VIEW_PASSWORD_KEY_PREFIX + code)
}

export function clearViewPassword(code: string): void {
  localStorage.removeItem(VIEW_PASSWORD_KEY_PREFIX + code)
  sessionStorage.removeItem(VIEW_PASSWORD_KEY_PREFIX + code)
}

/**
 * 교사가 입력한 값을 **생김새에 맞는 자리**에 저장한다.
 * 어느 쪽으로 저장했는지 알려주므로, 부르는 쪽이 화면 상태를 맞출 수 있다.
 */
export function saveLiveSecret(code: string, value: string, remember = true): 'editToken' | 'viewPassword' {
  const trimmed = value.trim()
  if (looksLikeEditToken(trimmed)) {
    saveEditToken(code, trimmed, remember)
    return 'editToken'
  }
  // 현황 암호도 `remember`를 따른다 — 공용 PC에서 "저장 안 함"을 골랐는데 암호만 남으면
  // 다음 사용자가 그 반의 답안을 그대로 볼 수 있다.
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(VIEW_PASSWORD_KEY_PREFIX + code, trimmed)
  ;(remember ? sessionStorage : localStorage).removeItem(VIEW_PASSWORD_KEY_PREFIX + code)
  return 'viewPassword'
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
