import { describe, expect, it } from 'vitest'
import { buildCsv, escapeCsvCell } from './csv'

describe('escapeCsvCell', () => {
  it('평범한 값은 그대로 둔다', () => {
    expect(escapeCsvCell('전류')).toBe('전류')
    expect(escapeCsvCell(10)).toBe('10')
  })

  it('쉼표가 들어간 답안은 감싼다 — 안 그러면 열이 밀린다', () => {
    expect(escapeCsvCell('전류, 전압, 저항')).toBe('"전류, 전압, 저항"')
  })

  it('큰따옴표는 두 번 겹쳐 쓴다', () => {
    expect(escapeCsvCell('그는 "왜"라고 물었다')).toBe('"그는 ""왜""라고 물었다"')
  })

  it('줄바꿈이 있는 서답형 답안도 한 셀로 유지된다', () => {
    expect(escapeCsvCell('첫째 줄\n둘째 줄')).toBe('"첫째 줄\n둘째 줄"')
  })
})

describe('buildCsv', () => {
  it('행은 CRLF로, 열은 쉼표로 잇는다', () => {
    expect(buildCsv([['이름', '점수'], ['홍길동', 10]])).toBe('이름,점수\r\n홍길동,10')
  })

  it('빈 표는 빈 문자열이 된다', () => {
    expect(buildCsv([])).toBe('')
  })
})
