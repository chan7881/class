import { describe, expect, it } from 'vitest'
import { gradeTone } from './gradeStyle'

describe('gradeTone', () => {
  it('정답은 초록 계열 + 정답 라벨', () => {
    const s = gradeTone({ correct: true, points: 5 })
    expect(s.tone).toBe('correct')
    expect(s.label).toBe('정답')
    expect(s.className).toContain('border-success')
    expect(s.note).toBeUndefined()
  })

  it('부분정답은 노란 계열 + 절반 점수 설명 (오답과 구분돼야 한다)', () => {
    // grading.test.ts가 보장하는 실제 서답형 키워드 채점 결과값을 그대로 쓴다
    const s = gradeTone({ correct: false, partial: true, points: 2.5 })
    expect(s.tone).toBe('partial')
    expect(s.label).toBe('부분 정답')
    expect(s.className).toContain('border-warn')
    expect(s.note).toContain('절반 점수')
  })

  it('오답은 빨간 계열', () => {
    const s = gradeTone({ correct: false, points: 0 })
    expect(s.tone).toBe('wrong')
    expect(s.label).toBe('오답')
    expect(s.className).toContain('border-danger')
  })

  it('부분정답과 오답은 서로 다른 색·아이콘·라벨을 쓴다 (색만으로 구분하지 않는다)', () => {
    const partial = gradeTone({ correct: false, partial: true, points: 2.5 })
    const wrong = gradeTone({ correct: false, points: 0 })
    expect(partial.className).not.toBe(wrong.className)
    expect(partial.icon).not.toBe(wrong.icon)
    expect(partial.label).not.toBe(wrong.label)
  })
})
