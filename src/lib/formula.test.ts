import { describe, expect, it } from 'vitest'
import { evaluateFormulaString, FormulaError, parseFormula } from './formula'

describe('formula 파서/평가', () => {
  it('사칙연산과 괄호를 계산한다', () => {
    expect(evaluateFormulaString('1 + 2 * 3', { row: {}, columns: {} })).toBe(7)
    expect(evaluateFormulaString('(1 + 2) * 3', { row: {}, columns: {} })).toBe(9)
  })

  it('거듭제곱은 오른쪽 결합이다', () => {
    expect(evaluateFormulaString('2 ^ 3 ^ 2', { row: {}, columns: {} })).toBe(512) // 2^(3^2)
  })

  it('단항 마이너스를 지원한다', () => {
    expect(evaluateFormulaString('-3 + 5', { row: {}, columns: {} })).toBe(2)
  })

  it('열 참조는 현재 행 값을 쓴다', () => {
    expect(evaluateFormulaString('A * B', { row: { A: 2, B: 3 }, columns: {} })).toBe(6)
  })

  it('정의되지 않은 열을 참조하면 오류', () => {
    expect(() => evaluateFormulaString('A + 1', { row: {}, columns: {} })).toThrow(FormulaError)
  })

  it('스칼라 함수(abs/sqrt/log/ln)를 계산한다', () => {
    expect(evaluateFormulaString('sqrt(16)', { row: {}, columns: {} })).toBe(4)
    expect(evaluateFormulaString('abs(-5)', { row: {}, columns: {} })).toBe(5)
    expect(evaluateFormulaString('log(100)', { row: {}, columns: {} })).toBeCloseTo(2)
  })

  it('집계 함수(avg/sum/min/max/count/stdev)는 열 전체를 본다', () => {
    const ctx = { row: {}, columns: { A: [1, 2, 3, 4] } }
    expect(evaluateFormulaString('avg(A)', ctx)).toBe(2.5)
    expect(evaluateFormulaString('sum(A)', ctx)).toBe(10)
    expect(evaluateFormulaString('min(A)', ctx)).toBe(1)
    expect(evaluateFormulaString('max(A)', ctx)).toBe(4)
    expect(evaluateFormulaString('count(A)', ctx)).toBe(4)
  })

  it('집계 함수에 열 이름이 아닌 인자를 주면 거부한다', () => {
    expect(() => evaluateFormulaString('avg(1+2)', { row: {}, columns: { A: [1] } })).toThrow(FormulaError)
  })

  it('악의적 입력(임의 코드 실행 시도)을 거부한다 — eval을 안 쓰므로 코드 실행 자체가 불가능하고 파싱/조회 오류만 난다', () => {
    expect(() => parseFormula('process.exit()')).toThrow(FormulaError) // '.'은 지원하지 않는 문자
    expect(() => parseFormula('a; b')).toThrow(FormulaError) // ';'는 지원하지 않는 문자
    expect(() => evaluateFormulaString('__proto__', { row: {}, columns: {} })).toThrow(FormulaError) // 정의 안 된 열
    expect(() => parseFormula('constructor(1)(2)')).toThrow(FormulaError) // 함수 호출 뒤 괄호는 지원 안 함
  })

  it('알 수 없는 문자는 토큰화 단계에서 거부한다', () => {
    expect(() => parseFormula('A $ B')).toThrow(FormulaError)
  })
})
