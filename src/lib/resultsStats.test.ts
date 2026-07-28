import { describe, expect, it } from 'vitest'
import '../blocks/questions/index' // registerQuestion(...) 부작용으로 toCell을 registry에 등록
import { cellForAnswer, computeQuestionStats, computeSummary } from './resultsStats'
import type { ResponseRecord } from '../api/types'
import type { ChoiceQuestion, ShortQuestion } from '../types/lesson'

const choiceQuestion: ChoiceQuestion = {
  id: 'q1',
  kind: 'choice',
  prompt: '중력가속도는?',
  required: true,
  points: 10,
  multiple: false,
  options: [
    { id: 'a', label: '9.8' },
    { id: 'b', label: '3.7' },
  ],
  answer: ['a'],
}

const shortQuestion: ShortQuestion = {
  id: 'q2',
  kind: 'short',
  prompt: '설명하세요',
  required: true,
  points: 10,
  rows: 3,
}

function record(partial: Partial<ResponseRecord>): ResponseRecord {
  return {
    studentKey: 'k1',
    identity: { name: '학생' },
    startedAt: '2026-07-28T00:00:00.000Z',
    path: ['s1'],
    answers: {},
    scores: {},
    isTest: false,
    ...partial,
  }
}

describe('computeSummary', () => {
  it('제출 전(진행중)/제출/평균점수/평균소요시간을 계산한다', () => {
    const records: ResponseRecord[] = [
      record({
        studentKey: 'a',
        submittedAt: '2026-07-28T00:01:00.000Z',
        scores: { q1: { correct: true, points: 10 }, q2: { correct: false, points: 0 } },
      }),
      record({
        studentKey: 'b',
        submittedAt: '2026-07-28T00:02:00.000Z',
        scores: { q1: { correct: false, points: 0 } },
      }),
      record({ studentKey: 'c' }), // 아직 제출 안 함(진행중)
    ]

    const summary = computeSummary(records)
    expect(summary.visited).toBe(3)
    expect(summary.submitted).toBe(2)
    expect(summary.avgScore).toBe(5) // (10 + 0) / 2
    expect(summary.avgDurationSec).toBe(90) // (60 + 120) / 2
  })

  it('테스트 모드 응답은 전부 제외한다', () => {
    const records: ResponseRecord[] = [
      record({ studentKey: 'a', submittedAt: '2026-07-28T00:01:00.000Z', scores: { q1: { correct: true, points: 10 } } }),
      record({ studentKey: 'test1', isTest: true, submittedAt: '2026-07-28T00:01:00.000Z', scores: { q1: { correct: true, points: 999 } } }),
    ]
    const summary = computeSummary(records)
    expect(summary.visited).toBe(1)
    expect(summary.avgScore).toBe(10)
  })

  it('제출자가 없으면 avgScore/avgDurationSec은 null', () => {
    const summary = computeSummary([record({ studentKey: 'a' })])
    expect(summary.submitted).toBe(0)
    expect(summary.avgScore).toBeNull()
    expect(summary.avgDurationSec).toBeNull()
  })
})

describe('cellForAnswer', () => {
  it('등록된 toCell이 있으면 그것으로 변환한다 (choice: 옵션 id → 라벨)', () => {
    expect(cellForAnswer(choiceQuestion, ['a'])).toBe('9.8')
  })

  it('toCell이 없거나 기본 유형은 문자열 그대로 반환한다', () => {
    expect(cellForAnswer(shortQuestion, '내 답')).toBe('내 답')
  })

  it('값이 없으면 빈 문자열', () => {
    expect(cellForAnswer(shortQuestion, undefined)).toBe('')
  })
})

describe('computeQuestionStats', () => {
  it('정답률과 답변 분포를 계산한다', () => {
    const records: ResponseRecord[] = [
      record({ studentKey: 'a', answers: { q1: ['a'] }, scores: { q1: { correct: true, points: 10 } } }),
      record({ studentKey: 'b', answers: { q1: ['b'] }, scores: { q1: { correct: false, points: 0 } } }),
      record({ studentKey: 'c', answers: { q1: ['a'] }, scores: { q1: { correct: true, points: 10 } } }),
    ]
    const stats = computeQuestionStats(choiceQuestion, records)
    expect(stats.answeredCount).toBe(3)
    expect(stats.accuracyPct).toBeCloseTo((2 / 3) * 100)
    expect(stats.distribution).toEqual([
      { label: '9.8', count: 2 },
      { label: '3.7', count: 1 },
    ])
  })

  it('채점기가 없는 유형(서답형 등)은 accuracyPct가 null', () => {
    const records: ResponseRecord[] = [record({ studentKey: 'a', answers: { q2: '내 생각' }, scores: {} })]
    const stats = computeQuestionStats(shortQuestion, records)
    expect(stats.accuracyPct).toBeNull()
    expect(stats.answeredCount).toBe(1)
  })

  it('테스트 모드 응답은 분포·정답률 계산에서 제외한다', () => {
    const records: ResponseRecord[] = [
      record({ studentKey: 'a', answers: { q1: ['a'] }, scores: { q1: { correct: true, points: 10 } } }),
      record({ studentKey: 'test1', isTest: true, answers: { q1: ['b'] }, scores: { q1: { correct: false, points: 0 } } }),
    ]
    const stats = computeQuestionStats(choiceQuestion, records)
    expect(stats.answeredCount).toBe(1)
    expect(stats.accuracyPct).toBe(100)
  })
})
