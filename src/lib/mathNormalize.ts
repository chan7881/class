/**
 * 수식(LaTeX) 채점용 정규화 — "normalized" 비교 모드 (docs/PLAN.md 1번 항목).
 * 공백·\left\right·중복 중괄호를 제거한 뒤 문자열을 비교한다. 진짜 수식적 동치 판정
 * (symbolic 모드, Compute Engine)은 필요해지면 별도로 추가한다.
 */
export function normalizeLatex(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '')
  s = s.replace(/\\left|\\right/g, '')
  let prev: string
  do {
    prev = s
    s = s.replace(/\{\{([^{}]*)\}\}/g, '{$1}')
    // x^{2}와 x^2, x_{1}과 x_1처럼 위·아래첨자가 한 글자면 중괄호가 있어도 없어도 같은 뜻이다.
    // MathLive 버튼이 어떤 걸 만드는지에 따라 둘 다 나올 수 있어 정오답 판정에서 갈리면 안 된다.
    s = s.replace(/([\^_])\{(\w)\}/g, '$1$2')
  } while (s !== prev)
  return s
}

export function latexMatches(raw: string, accepted: string[]): boolean {
  const normalized = normalizeLatex(raw)
  return accepted.some((acc) => normalizeLatex(acc) === normalized)
}
