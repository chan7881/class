/**
 * SHA-256 해시 유틸. Web Crypto(`crypto.subtle`)는 브라우저와 Node 둘 다에서 쓸 수 있어
 * 별도 의존성 없이 mock 백엔드(src/api/mock.ts)와 실제 Apps Script 클라이언트가 함께 쓴다.
 *
 * 용도: editToken은 원문을 절대 저장하지 않고 이 해시만 저장한다(docs/PLAN.md 소유권 검증 절 참고).
 * studentKey = sha256(code + 식별필드값)도 이걸로 만든다.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
