/**
 * 화학식 채점용 정규화. 학생이 버튼으로 입력한 유니코드 첨자를 일반 문자로 통일해 비교한다.
 * (docs/PLAN.md 3번 항목: 공백 제거·화살표 통일·첨자 통일·계수 1 생략 허용)
 */
const SUBSCRIPT_MAP: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-',
}

export function normalizeChemFormula(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '')
  // 양방향(⇌) 화살표를 먼저 치환해야 한다 — '->'를 먼저 치환하면 '<->' 안의 '->'가 미리
  // 소비되어 '<→'라는 어중간한 문자열이 남는다.
  s = s.replace(/<-->|<->/g, '⇌').replace(/-->|->/g, '→')
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => SUBSCRIPT_MAP[c] ?? c)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, (c) => SUPERSCRIPT_MAP[c] ?? c)
  // 계수 1 생략 허용: 맨 앞 또는 '+' 바로 뒤에 오는 "1원소"를 "원소"로 통일
  s = s.replace(/(^|\+)1(?=[A-Za-z(])/g, '$1')
  return s
}

export function chemFormulasMatch(raw: string, accepted: string[]): boolean {
  const normalized = normalizeChemFormula(raw)
  return accepted.some((acc) => normalizeChemFormula(acc) === normalized)
}
