import { describe, expect, it } from 'vitest'
import { InvalidLessonFileError, cloneLessonForDuplicate, exportLessonJson, importLessonJson } from './portable'
import type { Lesson } from '../types/lesson'

function makeLesson(): Lesson {
  return {
    version: 1,
    code: 'ABCDEF',
    title: '테스트 수업',
    accent: '#2563eb',
    published: true,
    settings: {
      requireAnswerToAdvance: true,
      allowBackNavigation: true,
      feedbackMode: 'onFinish',
      identityFields: ['name'],
      shuffleChoices: false,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [{ id: 's1', isSub: false, blocks: [] }],
    updatedAt: '2026-07-28T00:00:00.000Z',
  }
}

describe('exportLessonJson / importLessonJson', () => {
  it('내보낸 JSON을 다시 가져오면 동일한 lesson으로 복원된다', () => {
    const lesson = makeLesson()
    const json = exportLessonJson(lesson)
    const restored = importLessonJson(json)
    expect(restored).toEqual(lesson)
  })

  it('내보내기 포맷이 아니라 순수 Lesson JSON만 있어도 가져올 수 있다', () => {
    const lesson = makeLesson()
    const restored = importLessonJson(JSON.stringify(lesson))
    expect(restored).toEqual(lesson)
  })

  it('올바르지 않은 JSON은 InvalidLessonFileError를 던진다', () => {
    expect(() => importLessonJson('{ 이건 JSON이 아님')).toThrow(InvalidLessonFileError)
  })

  it('version 필드가 없는 객체는 InvalidLessonFileError를 던진다', () => {
    expect(() => importLessonJson(JSON.stringify({ title: '깨진 수업' }))).toThrow(InvalidLessonFileError)
  })
})

describe('cloneLessonForDuplicate', () => {
  it('code를 제거하고 제목에 (사본)을 붙이며 published를 false로 되돌린다', () => {
    const lesson = makeLesson()
    const clone = cloneLessonForDuplicate(lesson)
    expect(clone).not.toHaveProperty('code')
    expect(clone.title).toBe('테스트 수업 (사본)')
    expect(clone.published).toBe(false)
    expect(clone.slides).toEqual(lesson.slides)
  })
})
