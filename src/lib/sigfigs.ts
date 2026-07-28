/**
 * 학생이 입력한 "원문 문자열"에서 유효숫자 개수를 센다 — 파싱된 숫자값이 아니라 표기 자체를 봐야 한다
 * ("9.8"과 "9.80"은 값은 같아도 유효숫자가 다르다).
 *
 * 규칙(학교 수준에서 흔히 쓰는 단순화 버전):
 *  - 0이 아닌 숫자는 전부 유효.
 *  - 소수점이 있으면: 맨 앞의 무의미한 0만 제외하고 그 뒤(끝의 0 포함)는 전부 유효.
 *  - 소수점이 없는 정수는: 앞뒤의 0을 전부 제외한다(끝의 0은 유효한지 모호하므로 보수적으로 무효 처리).
 *  - 지수 표기("3.0e8", "3.0×10^8")는 가수(계수) 부분만 본다.
 */
export function countSigFigs(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0

  const normalized = trimmed.replace(/[×xX]\s*10\s*\^?/, 'e').replace(/e\+/, 'e')
  const mantissa = normalized.split(/e/i)[0].replace(/^[-+]/, '')
  if (!/\d/.test(mantissa)) return 0

  if (mantissa.includes('.')) {
    const [intPart, fracPart = ''] = mantissa.split('.')
    const intDigits = intPart.replace(/^0+/, '')
    if (intDigits) return intDigits.length + fracPart.length
    const sigFrac = fracPart.replace(/^0+/, '')
    return sigFrac.length || 1
  }

  const stripped = mantissa.replace(/^0+/, '').replace(/0+$/, '')
  return stripped.length || 1
}

export function sigFigsMatch(raw: string, expected: number): boolean {
  return countSigFigs(raw) === expected
}
