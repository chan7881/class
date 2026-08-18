import { describe, expect, it } from 'vitest'
import { digitsOnly, isNumericField } from './EntryScreen'

// 2026-08-18: "8반", "2학년 8반", "12번번" 처럼 단위까지 적어 넣는 학생이 많아
// 엑셀 수합에서 같은 반이 여러 값으로 갈라졌다. 이름을 뺀 칸은 숫자만 받는다.
describe('학생 식별 입력', () => {
  it('이름만 자유 입력이다', () => {
    expect(isNumericField('name')).toBe(false)
    for (const f of ['grade', 'klass', 'number']) expect(isNumericField(f)).toBe(true)
  })

  it('단위를 적어도 숫자만 남는다', () => {
    expect(digitsOnly('8반')).toBe('8')
    expect(digitsOnly('2학년 8반')).toBe('28')
    expect(digitsOnly('12번번')).toBe('12')
    expect(digitsOnly('  9 ')).toBe('9')
  })

  it('전각 숫자도 반각으로 받아 준다', () => {
    expect(digitsOnly('８')).toBe('8')
    expect(digitsOnly('１２번')).toBe('12')
  })

  it('숫자가 하나도 없으면 빈 값이 된다 — 시작하기 버튼이 안 눌린다', () => {
    expect(digitsOnly('반')).toBe('')
    expect(digitsOnly('')).toBe('')
  })
})
