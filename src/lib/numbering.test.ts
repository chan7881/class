import { describe, expect, it } from 'vitest'
import { computeSlideNumbers } from './numbering'

function slide(id: string, isSub: boolean) {
  return { id, isSub, blocks: [] }
}

describe('computeSlideNumbers', () => {
  it('보조 슬라이드가 없으면 그냥 1,2,3...', () => {
    const slides = [slide('a', false), slide('b', false), slide('c', false)]
    expect(computeSlideNumbers(slides)).toEqual(['1', '2', '3'])
  })

  it('보조 슬라이드는 직전 메인 슬라이드 번호에 -1, -2로 붙는다', () => {
    const slides = [slide('a', false), slide('b', false), slide('b1', true), slide('b2', true), slide('c', false)]
    expect(computeSlideNumbers(slides)).toEqual(['1', '2', '2-1', '2-2', '3'])
  })

  it('연속된 메인 슬라이드 사이의 보조 카운트는 리셋된다', () => {
    const slides = [slide('a', false), slide('a1', true), slide('b', false), slide('b1', true)]
    expect(computeSlideNumbers(slides)).toEqual(['1', '1-1', '2', '2-1'])
  })

  it('빈 배열은 빈 배열', () => {
    expect(computeSlideNumbers([])).toEqual([])
  })
})
