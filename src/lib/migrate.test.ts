import { describe, expect, it } from 'vitest'
import { migrateLesson, UnknownLessonVersionError } from './migrate'

// v1 스키마 픽스처는 의도적으로 현재 Lesson 타입(version: 2)을 안 쓴다 — 옛 저장 형식을
// 그대로 흉내 내야 마이그레이션이 실제로 하는 일을 테스트할 수 있다.
function minimalV1Lesson() {
  return {
    version: 1,
    code: 'ABC123',
    title: '테스트 수업',
    accent: '#2563eb',
    published: false,
    settings: {
      requireAnswerToAdvance: true,
      allowBackNavigation: true,
      feedbackMode: 'onFinish',
      identityFields: ['name'],
      shuffleChoices: false,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [] as unknown[],
    updatedAt: '2026-07-28T00:00:00.000Z',
  }
}

describe('migrateLesson', () => {
  it('블록이 없는 v1 수업은 버전만 2로 올라간다', () => {
    const lesson = minimalV1Lesson()
    expect(migrateLesson(lesson)).toEqual({ ...lesson, version: 2 })
  })

  it('v1 제목(heading) 블록의 평문 text를 v2의 리치텍스트 html로 옮긴다', () => {
    const lesson = {
      ...minimalV1Lesson(),
      slides: [{ id: 's1', isSub: false, blocks: [{ id: 'b1', type: 'heading', level: 2, text: '안녕' }] }],
    }
    const migrated = migrateLesson(lesson)
    expect(migrated.version).toBe(2)
    expect((migrated.slides[0].blocks[0] as { html: string }).html).toBe('<p>안녕</p>')
  })

  it('제목 평문에 HTML 특수문자가 있으면 이스케이프한다', () => {
    const lesson = {
      ...minimalV1Lesson(),
      slides: [{ id: 's1', isSub: false, blocks: [{ id: 'b1', type: 'heading', level: 1, text: '<script>alert(1)</script> & "따옴표"' }] }],
    }
    const migrated = migrateLesson(lesson)
    expect((migrated.slides[0].blocks[0] as { html: string }).html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;따옴표&quot;</p>')
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
