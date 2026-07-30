/**
 * 수식(LaTeX) 채점용 정규화 — "normalized" 비교 모드 (docs/PLAN.md 1번 항목).
 * 공백·\left\right·중복 중괄호·의미 없는 빈 그룹·간격 명령을 제거한 뒤 문자열을 비교한다.
 * 목표는 "겉보기 표기 차이"를 없애는 것뿐이다 — 진짜 수식적 동치 판정(예: `2x`와 `x\cdot2`를
 * 같다고 보는 것, symbolic 모드/Compute Engine)은 범위 밖이고 필요해지면 별도로 추가한다.
 */
/**
 * "÷" 버튼(기본 키보드)으로 만든 `a\div b`를 "분수" 버튼(분수·근호 키보드)으로 만든
 * `\frac{a}{b}`와 같은 것으로 본다 — 교사가 정답을 분수로 등록했는데 학생 버튼판에
 * 분수 레이어를 안 켜뒀으면 학생은 ÷로만 답을 만들 수 있어, 개념은 맞아도 표기가
 * 달라 오답 처리되는 문제가 있었다(단항 토큰·괄호·중괄호 묶음 정도의 단순한 경우만
 * 다룬다 — 범용 수식 파서가 아니라 이 두 표기 간 동치만 좁게 처리).
 */
function divToFrac(s: string): string {
  const token = '(?:[A-Za-z0-9]+|\\{[^{}]*\\}|\\([^()]*\\))'
  const pattern = new RegExp(`(${token})\\\\div(${token})`, 'g')
  let prev: string
  let out = s
  do {
    prev = out
    out = out.replace(pattern, '\\frac{$1}{$2}')
  } while (out !== prev)
  return out
}

export function normalizeLatex(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '')
  s = s.replace(/\\left|\\right/g, '')
  // \, \; \: \! \quad \qquad는 시각적 간격만 조정하는 명령이라 공백과 마찬가지로 뜻에
  // 영향이 없다 — 버튼판(단위 레이어의 "\,\text{m}" 등)이나 학생이 직접 넣은 간격 차이로
  // 정오답이 갈리면 안 된다.
  s = s.replace(/\\(?:[,;:!]|quad|qquad)/g, '')
  s = divToFrac(s)
  let prev: string
  do {
    prev = s
    s = s.replace(/\{\{([^{}]*)\}\}/g, '{$1}')
    // x^{2}와 x^2, x_{1}과 x_1처럼 위·아래첨자가 한 글자면 중괄호가 있어도 없어도 같은 뜻이다.
    // MathLive 버튼이 어떤 걸 만드는지에 따라 둘 다 나올 수 있어 정오답 판정에서 갈리면 안 된다.
    s = s.replace(/([\^_])\{(\w)\}/g, '$1$2')
    // 빈 중괄호 그룹({}) 자체는 의미가 없다 — 버튼으로 구조를 넣고 안 채운 자리 등에서
    // 생기는 부산물이라 비교에서 제외한다(둘 다 정말 안 채웠으면 애초에 정답과 안 맞다).
    s = s.replace(/\{\}/g, '')
  } while (s !== prev)
  return s
}

export function latexMatches(raw: string, accepted: string[]): boolean {
  const normalized = normalizeLatex(raw)
  return accepted.some((acc) => normalizeLatex(acc) === normalized)
}
