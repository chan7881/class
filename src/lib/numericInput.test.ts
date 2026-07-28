import { describe, expect, it } from 'vitest'
import { parseNumericInput } from './numericInput'

describe('parseNumericInput', () => {
  it('일반 숫자', () => {
    expect(parseNumericInput('9.8')).toBe(9.8)
    expect(parseNumericInput('-3')).toBe(-3)
  })
  it('지수 표기', () => {
    expect(parseNumericInput('3.0e8')).toBe(3.0e8)
    expect(parseNumericInput('3.0×10^8')).toBe(3.0e8)
    expect(parseNumericInput('6.0x10^23')).toBe(6.0e23)
  })
  it('쉼표 구분 숫자', () => {
    expect(parseNumericInput('1,234.5')).toBe(1234.5)
  })
  it('읽을 수 없으면 null', () => {
    expect(parseNumericInput('')).toBeNull()
    expect(parseNumericInput('abc')).toBeNull()
  })
})
