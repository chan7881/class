import { describe, expect, it } from 'vitest'
import { resolveNextSlideId, validateBranchGraph } from './navigate'
import type { Slide } from '../types/lesson'

function slide(id: string, opts: { isSub?: boolean; branch?: Slide['branch'] } = {}): Slide {
  return { id, isSub: opts.isSub ?? false, blocks: [], branch: opts.branch }
}

describe('resolveNextSlideId', () => {
  const slides = [slide('s1'), slide('s2'), slide('s3'), slide('s4')]

  it('분기 설정이 없으면 배열 순서상 다음 슬라이드로 간다', () => {
    expect(resolveNextSlideId(slides, 's1')).toBe('s2')
  })

  it('마지막 슬라이드면 null(수업 종료)', () => {
    expect(resolveNextSlideId(slides, 's4')).toBeNull()
  })

  it('메인 슬라이드의 보통 진행은 바로 뒤 보조 슬라이드들을 건너뛰고 다음 메인 슬라이드로 간다', () => {
    const withSub = [slide('main1'), slide('sub1-1', { isSub: true }), slide('sub1-2', { isSub: true }), slide('main2')]
    expect(resolveNextSlideId(withSub, 'main1')).toBe('main2')
  })

  it('보조 슬라이드 자신의 보통 진행은 배열상 바로 다음 슬라이드로 이어간다', () => {
    const withSub = [slide('main1'), slide('sub1-1', { isSub: true }), slide('sub1-2', { isSub: true }), slide('main2')]
    expect(resolveNextSlideId(withSub, 'sub1-1')).toBe('sub1-2')
    expect(resolveNextSlideId(withSub, 'sub1-2')).toBe('main2')
  })

  it('정답/오답 규칙에 따라 분기해 보조 슬라이드로 보낼 수 있다', () => {
    const branching = [
      slide('main1', { branch: { questionId: 'q1', rules: [{ when: 'incorrect', goTo: 'sub1-1' }] } }),
      slide('sub1-1', { isSub: true }),
      slide('main2'),
    ]
    expect(resolveNextSlideId(branching, 'main1', { grade: { correct: false, points: 0 }, value: 'x' })).toBe('sub1-1')
    expect(resolveNextSlideId(branching, 'main1', { grade: { correct: true, points: 10 }, value: 'x' })).toBe('main2') // 맞으면 보조 슬라이드를 건너뜀
  })

  it('choice:옵션ID 규칙은 선택한 보기로 분기한다', () => {
    const branching = [slide('s1', { branch: { questionId: 'q1', rules: [{ when: 'choice:opt-a', goTo: 's4' }] } }), slide('s2'), slide('s3'), slide('s4')]
    expect(resolveNextSlideId(branching, 's1', { grade: null, value: ['opt-a'] })).toBe('s4')
    expect(resolveNextSlideId(branching, 's1', { grade: null, value: ['opt-b'] })).toBe('s2')
  })

  it('default가 있으면 어떤 규칙도 안 맞을 때 그리로 간다', () => {
    const branching = [
      slide('s1', { branch: { questionId: 'q1', rules: [{ when: 'correct', goTo: 's4' }], default: 's3' } }),
      slide('s2'),
      slide('s3'),
      slide('s4'),
    ]
    expect(resolveNextSlideId(branching, 's1', { grade: { correct: false, points: 0 }, value: 'x' })).toBe('s3')
  })

  it('목적지 슬라이드가 삭제돼 존재하지 않으면 보통 진행으로 대체한다', () => {
    const branching = [slide('s1', { branch: { questionId: 'q1', rules: [{ when: 'correct', goTo: 'deleted' }] } }), slide('s2')]
    expect(resolveNextSlideId(branching, 's1', { grade: { correct: true, points: 10 }, value: 'x' })).toBe('s2')
  })
})

describe('validateBranchGraph', () => {
  it('분기가 없으면 전부 도달 가능하고 순환도 없다', () => {
    const slides = [slide('s1'), slide('s2'), slide('s3')]
    const result = validateBranchGraph(slides)
    expect(result.unreachableSlideIds).toEqual([])
    expect(result.cyclicSlideIds).toEqual([])
  })

  it('분기 규칙 없이 놓인 보조 슬라이드는 도달 불가로 표시한다', () => {
    // main1의 보통 진행은 sub1-1을 건너뛰고 main2로 간다 — 아무도 sub1-1을 가리키지 않는다.
    const slides = [slide('main1'), slide('sub1-1', { isSub: true }), slide('main2')]
    const result = validateBranchGraph(slides)
    expect(result.unreachableSlideIds).toEqual(['sub1-1'])
  })

  it('분기 규칙이 보조 슬라이드를 가리키면 도달 가능해진다', () => {
    const slides = [
      slide('main1', { branch: { questionId: 'q1', rules: [{ when: 'incorrect', goTo: 'sub1-1' }] } }),
      slide('sub1-1', { isSub: true }),
      slide('main2'),
    ]
    const result = validateBranchGraph(slides)
    expect(result.unreachableSlideIds).toEqual([])
  })

  it('서로를 가리키는 순환 분기를 찾아낸다', () => {
    const slides = [
      slide('s1', { branch: { questionId: 'q1', rules: [{ when: 'incorrect', goTo: 's2' }] } }),
      slide('s2', { branch: { questionId: 'q2', rules: [{ when: 'incorrect', goTo: 's1' }] } }),
    ]
    const result = validateBranchGraph(slides)
    expect(result.cyclicSlideIds.sort()).toEqual(['s1', 's2'])
  })
})
