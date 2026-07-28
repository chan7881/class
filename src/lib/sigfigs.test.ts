import { describe, expect, it } from 'vitest'
import { countSigFigs } from './sigfigs'

describe('countSigFigs', () => {
  it('기본적인 소수', () => {
    expect(countSigFigs('9.8')).toBe(2)
    expect(countSigFigs('9.80')).toBe(3)
    expect(countSigFigs('9.800')).toBe(4)
  })
  it('앞자리 0은 무효', () => {
    expect(countSigFigs('0.0012')).toBe(2)
    expect(countSigFigs('0.5')).toBe(1)
  })
  it('소수점 없는 정수 — 끝자리 0은 보수적으로 무효 처리', () => {
    expect(countSigFigs('120')).toBe(2)
    expect(countSigFigs('100')).toBe(1)
    expect(countSigFigs('123')).toBe(3)
  })
  it('지수 표기는 가수 부분만 본다', () => {
    expect(countSigFigs('3.0e8')).toBe(2)
    expect(countSigFigs('3.0×10^8')).toBe(2)
    expect(countSigFigs('3.00x10^8')).toBe(3)
  })
  it('음수 부호는 무시한다', () => {
    expect(countSigFigs('-9.80')).toBe(3)
  })
  it('빈 문자열이나 숫자가 없으면 0', () => {
    expect(countSigFigs('')).toBe(0)
    expect(countSigFigs('   ')).toBe(0)
  })
})
