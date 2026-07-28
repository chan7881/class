/** "3.0e8", "3.0×10^8", "1,234.5" 같은 표기를 실제 숫자로 바꾼다. 못 읽으면 null. */
export function parseNumericInput(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/,/g, '')
    .replace(/[×xX]\s*10\s*\^?/, 'e')
    .replace(/e\+/, 'e')
  if (!cleaned) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}
