import { describe, expect, it } from 'vitest'
import { seededShuffle, shuffleLessonChoices } from './shuffleChoices'
import type { Lesson, Question } from '../types/lesson'

function lessonWith(q: Question, shuffleChoices: boolean): Lesson {
  return {
    version: 3,
    code: 'ABC123',
    title: '테스트',
    accent: '#2563eb',
    published: true,
    settings: {
      requireAnswerToAdvance: true,
      allowBackNavigation: false,
      feedbackMode: 'never',
      identityFields: ['name'],
      shuffleChoices,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [{ id: 's1', isSub: false, blocks: [{ id: 'b1', type: 'question', q }] }],
    updatedAt: '2026-08-06T00:00:00.000Z',
  }
}

const choice: Question = {
  id: 'q1',
  kind: 'choice',
  prompt: '<p>고르세요</p>',
  required: true,
  points: 10,
  multiple: false,
  options: [
    { id: 'a', label: '가' },
    { id: 'b', label: '나' },
    { id: 'c', label: '다' },
    { id: 'd', label: '라' },
    { id: 'e', label: '마' },
  ],
  answer: ['c'],
}

function optionIds(lesson: Lesson): string[] {
  const block = lesson.slides[0].blocks[0]
  if (block.type !== 'question' || block.q.kind !== 'choice') throw new Error('선택형이 아님')
  return block.q.options.map((o) => o.id)
}

describe('seededShuffle', () => {
  it('같은 씨앗이면 항상 같은 순서 — 새로고침해도 보기가 튀지 않아야 한다', () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'student-1:q1')
    const b = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'student-1:q1')
    expect(a).toEqual(b)
  })

  it('씨앗이 다르면 순서가 갈린다', () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'student-1:q1')
    const b = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 'student-2:q1')
    expect(a).not.toEqual(b)
  })

  it('원소를 잃거나 만들지 않는다', () => {
    const out = seededShuffle(['a', 'b', 'c', 'd'], 'seed')
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('원본 배열은 그대로 둔다', () => {
    const input = [1, 2, 3, 4]
    seededShuffle(input, 'seed')
    expect(input).toEqual([1, 2, 3, 4])
  })
})

describe('shuffleLessonChoices', () => {
  it('설정이 꺼져 있으면 수업을 그대로 돌려준다', () => {
    const lesson = lessonWith(choice, false)
    expect(shuffleLessonChoices(lesson, 'student-1')).toBe(lesson)
  })

  it('학생마다 보기 순서가 달라진다', () => {
    const lesson = lessonWith(choice, true)
    const a = optionIds(shuffleLessonChoices(lesson, 'student-1'))
    const b = optionIds(shuffleLessonChoices(lesson, 'student-2'))
    expect(a).not.toEqual(b)
    // 순서만 바뀔 뿐 보기가 사라지면 안 된다
    expect([...a].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('같은 학생은 몇 번을 불러도 같은 순서다', () => {
    const lesson = lessonWith(choice, true)
    expect(optionIds(shuffleLessonChoices(lesson, 'student-1'))).toEqual(optionIds(shuffleLessonChoices(lesson, 'student-1')))
  })

  it('정답은 보기 id로 남으므로 섞어도 채점 기준이 흔들리지 않는다', () => {
    const shuffled = shuffleLessonChoices(lessonWith(choice, true), 'student-1')
    const block = shuffled.slides[0].blocks[0]
    expect(block.type === 'question' && block.q.kind === 'choice' && block.q.answer).toEqual(['c'])
  })

  it('합답형은 보기 순서가 의미를 가지므로 섞지 않는다', () => {
    const combo: Question = {
      id: 'q1',
      kind: 'combo',
      prompt: '',
      required: true,
      points: 10,
      statements: [
        { id: 'ㄱ', label: '가' },
        { id: 'ㄴ', label: '나' },
      ],
      options: [
        { id: 'o1', label: 'ㄱ', set: ['ㄱ'] },
        { id: 'o2', label: 'ㄱㄴ', set: ['ㄱ', 'ㄴ'] },
      ],
      answer: 'o2',
    }
    const lesson = lessonWith(combo, true)
    const block = shuffleLessonChoices(lesson, 'student-1').slides[0].blocks[0]
    expect(block.type === 'question' && block.q.kind === 'combo' && block.q.options.map((o) => o.id)).toEqual(['o1', 'o2'])
  })

  it('원본 수업은 건드리지 않는다', () => {
    const lesson = lessonWith(choice, true)
    shuffleLessonChoices(lesson, 'student-1')
    expect(optionIds(lesson)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
