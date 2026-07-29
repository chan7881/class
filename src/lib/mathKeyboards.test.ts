import { describe, expect, it } from 'vitest'
import { MATH_KEYBOARDS } from './mathKeyboards'
import type { MathKeyboardLayer } from '../types/lesson'

describe('MATH_KEYBOARDS', () => {
  it('모든 버튼이 label과 latex를 갖고 있다', () => {
    for (const layer of Object.values(MATH_KEYBOARDS)) {
      for (const btn of layer.buttons) {
        expect(btn.label.length).toBeGreaterThan(0)
        expect(btn.latex.length).toBeGreaterThan(0)
      }
    }
  })

  it('symbols 레이어에 부등호·근사·플마 등 기본 기호가 들어있다', () => {
    const labels = MATH_KEYBOARDS.symbols.buttons.map((b) => b.label)
    expect(labels).toEqual(expect.arrayContaining(['≤', '≥', '≠', '≈', '≃', '≑', '±', '∓']))
  })

  it('구조형(분수·근호 등) 버튼은 빈 중괄호 대신 채움칸 토큰(#?)을 쓴다', () => {
    const structural = MATH_KEYBOARDS.fraction.buttons.filter((b) => b.latex.includes('{'))
    for (const btn of structural) {
      expect(btn.latex).not.toMatch(/\{\}/)
    }
  })

  it('레지스트리 키가 MathKeyboardLayer 유니온과 어긋나지 않는다', () => {
    const layers: MathKeyboardLayer[] = ['basic', 'letters', 'fraction', 'symbols', 'greek', 'unit', 'chem']
    expect(Object.keys(MATH_KEYBOARDS).sort()).toEqual([...layers].sort())
  })
})
