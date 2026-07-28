import { describe, expect, it } from 'vitest'
import { chemFormulasMatch, normalizeChemFormula } from './chemNormalize'

describe('normalizeChemFormula', () => {
  it('공백을 지운다', () => {
    expect(normalizeChemFormula('H2 + O2')).toBe('H2+O2')
  })
  it('화살표를 통일한다', () => {
    expect(normalizeChemFormula('H2+O2->H2O')).toBe('H2+O2→H2O')
    expect(normalizeChemFormula('H2+O2<->H2O')).toBe('H2+O2⇌H2O')
  })
  it('유니코드 첨자를 일반 문자로 통일한다', () => {
    expect(normalizeChemFormula('H₂O')).toBe('H2O')
    expect(normalizeChemFormula('Fe³⁺')).toBe('Fe3+')
  })
  it('계수 1은 생략된 것과 같이 취급한다', () => {
    expect(normalizeChemFormula('1H2O')).toBe('H2O')
    expect(normalizeChemFormula('H2+1O2')).toBe('H2+O2')
  })
})

describe('chemFormulasMatch', () => {
  it('버튼으로 입력한 첨자와 일반 텍스트 표기가 같은 걸로 인정된다', () => {
    expect(chemFormulasMatch('H₂O', ['H2O'])).toBe(true)
  })
  it('여러 정답 중 하나만 맞아도 정답', () => {
    expect(chemFormulasMatch('CO2', ['CO₂', 'carbon dioxide'])).toBe(true)
  })
  it('다르면 오답', () => {
    expect(chemFormulasMatch('H2O2', ['H2O'])).toBe(false)
  })
})
