/** 서답형·빈칸채우기 채점에서 공백·대소문자 차이로 억울하게 틀리지 않도록 정규화한다. */
export function normalizeAnswerText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}
