import { describe, expect, it } from 'vitest'
import { latexMatches, normalizeLatex } from './mathNormalize'

describe('normalizeLatex', () => {
  it('공백을 지운다', () => {
    expect(normalizeLatex('x ^ 2 + 1')).toBe('x^2+1')
  })
  it('\\left \\right를 지운다', () => {
    expect(normalizeLatex('\\left(x+1\\right)')).toBe('(x+1)')
  })
  it('중복 중괄호를 하나로 줄인다 (한 글자 첨자라 중괄호 자체도 마저 벗겨진다)', () => {
    expect(normalizeLatex('x^{{2}}')).toBe('x^2')
  })
  it('두 글자 이상 첨자는 중괄호를 남긴다', () => {
    expect(normalizeLatex('x^{{12}}')).toBe('x^{12}')
  })
  it('간격 명령(\\, \\; \\: \\! \\quad \\qquad)은 공백처럼 무시한다', () => {
    expect(normalizeLatex('9.8\\,\\text{m/s}^2')).toBe('9.8\\text{m/s}^2')
    expect(normalizeLatex('a\\quad+\\qquad b')).toBe('a+b')
  })
  it('빈 중괄호 그룹({})은 의미가 없어 제거한다(버튼으로 만든 구조를 안 채운 자리 등)', () => {
    expect(normalizeLatex('\\frac{1}{2}{}')).toBe('\\frac{1}{2}')
  })
  it('물리 키보드 "*"가 만드는 \\cdot을 버튼(×)의 \\times와 같은 것으로 본다', () => {
    expect(normalizeLatex('3\\cdot4')).toBe(normalizeLatex('3\\times4'))
    expect(normalizeLatex('3\\cdot4')).toBe('3\\times4')
  })
  it('\\cdots(줄임표)·\\cdotp는 \\cdot과 다른 명령이라 건드리지 않는다', () => {
    expect(normalizeLatex('1,2,\\cdots,n')).toBe('1,2,\\cdots,n')
    expect(normalizeLatex('3\\cdotp4')).toBe('3\\cdotp4')
  })
})

describe('latexMatches', () => {
  it('서식만 다르고 같은 수식이면 정답', () => {
    expect(latexMatches('\\frac{1}{2}', ['\\frac{1}{2}'])).toBe(true)
    expect(latexMatches('x^{2}', ['x^2'])).toBe(true)
  })
  it('여러 정답 중 하나만 맞아도 정답', () => {
    expect(latexMatches('2x', ['x+x', '2x'])).toBe(true)
  })
  it('다르면 오답 (문자열 비교라 수식적으로 동치인 다른 표현은 못 잡는다 — symbolic 모드 몫)', () => {
    expect(latexMatches('x+x', ['2x'])).toBe(false)
  })
})
