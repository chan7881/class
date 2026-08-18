import { describe, expect, it } from 'vitest'
import { answerKeyOf, changedAnswerQuestionIds, gradingFieldsOf, isGradedKind } from './answerKey'
import { listQuestionDefinitions } from '../blocks/questions/registry'
import '../blocks/questions/index'
import type { Lesson, Question } from '../types/lesson'

function lessonWith(...questions: Question[]): Lesson {
  return {
    version: 3,
    code: 'AAAAAA',
    title: 't',
    published: true,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
    settings: {
      requireAnswerToAdvance: true,
      allowBackNavigation: true,
      feedbackMode: 'onFinish',
      identityFields: ['name'],
      shuffleChoices: false,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [{ id: 's1', title: 's', blocks: questions.map((q) => ({ id: 'b' + q.id, type: 'question', q })) }],
  } as unknown as Lesson
}

const choice = (answer: string[], prompt = '묻는 말'): Question =>
  ({ id: 'q1', kind: 'choice', prompt, required: true, points: 10, multiple: false, options: [{ id: 'a', text: 'ㄱ' }, { id: 'b', text: 'ㄴ' }], answer }) as unknown as Question

describe('정답 변경 감지', () => {
  it('정답을 바꾸면 잡아낸다', () => {
    expect(changedAnswerQuestionIds(lessonWith(choice(['a'])), lessonWith(choice(['b'])))).toEqual(['q1'])
  })

  it('지문만 고친 것은 잡지 않는다 — 채점 결과가 안 바뀐다', () => {
    expect(changedAnswerQuestionIds(lessonWith(choice(['a'], '묻는 말')), lessonWith(choice(['a'], '다르게 묻는 말')))).toEqual([])
  })

  it('배점이 바뀌면 잡아낸다 — 점수가 달라진다', () => {
    const before = lessonWith(choice(['a']))
    const after = lessonWith({ ...(choice(['a']) as object), points: 20 } as Question)
    expect(changedAnswerQuestionIds(before, after)).toEqual(['q1'])
  })

  it('문항을 지우거나 새로 넣은 것도 잡아낸다', () => {
    expect(changedAnswerQuestionIds(lessonWith(choice(['a'])), lessonWith())).toEqual(['q1'])
    expect(changedAnswerQuestionIds(lessonWith(), lessonWith(choice(['a'])))).toEqual(['q1'])
  })

  it('채점기가 없는 유형은 정답 지문에 들어가지 않는다', () => {
    const photo = { id: 'p1', kind: 'photo', prompt: '', required: false, points: 0 } as unknown as Question
    expect(answerKeyOf(lessonWith(photo))).toEqual({})
  })

  // ⚠️ 드리프트 방지 — 채점기를 가진 유형이 늘었는데 GRADING_FIELDS 를 안 고치면
  //    정답을 바꿔도 재채점을 안 물어본다(조용한 실패). 여기서 잡는다.
  it('채점기가 있는 모든 유형이 비교 대상 필드를 갖고 있다', () => {
    const missing = listQuestionDefinitions()
      .filter((d) => d.grade && isGradedKind(d.kind))
      .filter((d) => gradingFieldsOf(d.kind).length === 0)
      .map((d) => d.kind)
    expect(missing).toEqual([])
  })
})
