import { describe, expect, it } from 'vitest'
import { lookupUnit, toBaseValue, unitsAreCompatible } from './units'

describe('lookupUnit', () => {
  it('등록된 단위를 찾는다', () => {
    expect(lookupUnit('km')?.base).toBe('m')
    expect(lookupUnit('km')?.factor).toBe(1000)
  })
  it('등록 안 된 단위는 null', () => {
    expect(lookupUnit('Mm')).toBeNull() // 메가미터 같은 희귀 조합은 지원 안 함(의도된 한계)
    expect(lookupUnit('')).toBeNull()
    expect(lookupUnit(undefined)).toBeNull()
  })
})

describe('unitsAreCompatible', () => {
  it('같은 물리량이면 true', () => {
    expect(unitsAreCompatible('km', 'm')).toBe(true)
    expect(unitsAreCompatible('km/h', 'm/s')).toBe(true)
    expect(unitsAreCompatible('atm', 'Pa')).toBe(true)
  })
  it('다른 물리량이면 false', () => {
    expect(unitsAreCompatible('m', 's')).toBe(false)
    expect(unitsAreCompatible('J', 'N')).toBe(false)
  })
  it('온도는 K와 °C가 서로 호환되지 않는다(오프셋 변환이라 단순 배율로 못 다룸)', () => {
    expect(unitsAreCompatible('K', '°C')).toBe(false)
  })
  it('등록 안 된 단위가 하나라도 있으면 false', () => {
    expect(unitsAreCompatible('m', 'banana')).toBe(false)
  })
})

describe('toBaseValue', () => {
  it('1km는 1000m', () => {
    expect(toBaseValue(1, 'km')).toBe(1000)
  })
  it('72km/h는 20m/s', () => {
    expect(toBaseValue(72, 'km/h')).toBeCloseTo(20, 10)
  })
  it('1atm은 101325Pa', () => {
    expect(toBaseValue(1, 'atm')).toBe(101325)
  })
  it('등록 안 된 단위는 null', () => {
    expect(toBaseValue(5, 'banana')).toBeNull()
  })
})
