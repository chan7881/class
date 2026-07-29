import { normalizeAnswerText } from './textNormalize'

/**
 * 서답형 키워드 채점 문법 파서. 예: "지진,(흔들림, 떨림), 땅"
 *  - 맨 위 단계의 쉼표는 AND (전부 있어야 함)
 *  - 괄호 안의 쉼표는 OR (그 안에서 하나만 있으면 됨, 유사어 인정용)
 * 결과: 그룹의 배열. 각 그룹은 서로 OR인 대안 키워드 배열이고, 그룹끼리는 AND다.
 * eval/Function 없이 직접 만든 파서로만 처리한다 (CLAUDE.md 규칙 2).
 */
export function parseKeywordGroups(expr: string): string[][] {
  const groups: string[][] = []
  const n = expr.length
  let i = 0

  while (i < n) {
    while (i < n && (expr[i] === ',' || /\s/.test(expr[i]))) i++
    if (i >= n) break

    if (expr[i] === '(') {
      let depth = 1
      let j = i + 1
      while (j < n && depth > 0) {
        if (expr[j] === '(') depth++
        else if (expr[j] === ')') depth--
        j++
      }
      const inner = expr.slice(i + 1, depth === 0 ? j - 1 : j)
      const alts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (alts.length > 0) groups.push(alts)
      i = j
    } else {
      let j = i
      while (j < n && expr[j] !== ',' && expr[j] !== '(') j++
      const word = expr.slice(i, j).trim()
      if (word) groups.push([word])
      i = j
    }
  }

  return groups
}

export interface KeywordMatchResult {
  totalGroups: number
  matchedGroups: number
}

/** 학생 답 given 안에 각 그룹(AND)의 대안(OR) 중 하나라도 포함돼 있는지 센다. */
export function matchKeywordGroups(given: string, expr: string): KeywordMatchResult {
  const groups = parseKeywordGroups(expr)
  const normalizedGiven = normalizeAnswerText(given)
  const matchedGroups = groups.filter((alts) => alts.some((alt) => normalizedGiven.includes(normalizeAnswerText(alt)))).length
  return { totalGroups: groups.length, matchedGroups }
}
