import { describe, expect, it } from 'vitest'
import { migrateLesson, UnknownLessonVersionError } from './migrate'
import type { Lesson } from '../types/lesson'

function minimalV1Lesson(): Lesson {
  return {
    version: 1,
    code: 'ABC123',
    title: '테스트 수업',
    accent: '#2563eb',
    settings: {
      requireAnswerToAdvance: true,
      allowBackNavigation: true,
      feedbackMode: 'onFinish',
      identityFields: ['name'],
      shuffleChoices: false,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [],
    updatedAt: '2026-07-28T00:00:00.000Z',
  }
}

describe('migrateLesson', () => {
  it('v1 수업은 그대로 통과한다', () => {
    const lesson = minimalV1Lesson()
    expect(migrateLesson(lesson)).toEqual(lesson)
  })

  it('version 필드가 없으면 거부한다', () => {
    expect(() => migrateLesson({ title: '버전 없음' })).toThrow(UnknownLessonVersionError)
  })

  it('현재 코드가 모르는 미래 버전이면 거부한다', () => {
    expect(() => migrateLesson({ ...minimalV1Lesson(), version: 999 })).toThrow(UnknownLessonVersionError)
  })

  it('객체가 아닌 값이 들어오면 거부한다', () => {
    expect(() => migrateLesson(null)).toThrow(UnknownLessonVersionError)
    expect(() => migrateLesson('not a lesson')).toThrow(UnknownLessonVersionError)
  })
})
