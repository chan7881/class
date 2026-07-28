/**
 * 수업 코드(학생용)와 editToken(교사용) 생성.
 * 코드 알파벳에서 혼동되기 쉬운 I, O, L, 0, 1을 뺀다 (docs/PLAN.md 소유권 검증 절).
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateLessonCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** 32바이트(64 hex 문자) 난수. 서버에는 이 값의 해시만 저장한다 — 원문은 교사 브라우저에만 남는다. */
export function generateEditToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
