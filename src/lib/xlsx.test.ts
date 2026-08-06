import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import '../blocks/questions/index'
import { buildResultsWorkbook } from './xlsx'
import type { ResponseRecord } from '../api/types'
import type { ChoiceQuestion, Lesson } from '../types/lesson'

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

function makeLesson(): Lesson {
  return {
    version: 3,
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
    slides: [{ id: 's1', isSub: false, blocks: [{ id: 'b1', type: 'question', q: choiceQuestion }] }],
    updatedAt: '2026-07-28T00:00:00.000Z',
  }
}

describe('buildResultsWorkbook', () => {
  it('학생별 행 + 문항별 답/정오/점수 열을 만든다', () => {
    const records: ResponseRecord[] = [
      {
        studentKey: 'k1',
        identity: { name: '홍길동' },
        startedAt: '2026-07-28T00:00:00.000Z',
        submittedAt: '2026-07-28T00:01:00.000Z',
        path: ['s1'],
        answers: { q1: ['a'] },
        scores: { q1: { correct: true, points: 10 } },
        isTest: false,
      },
    ]

    const workbook = buildResultsWorkbook(makeLesson(), records)
    const sheet = workbook.Sheets['응답']
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    expect(rows[0]).toEqual(['이름', '시작시각', '제출시각', '진행경로', 'Q1_답', 'Q1_정오', 'Q1_점수'])
    expect(rows[1]).toEqual(['홍길동', '2026-07-28T00:00:00.000Z', '2026-07-28T00:01:00.000Z', 's1', '9.8', 'O', 10])
  })

  it('테스트 모드 응답은 행에서 제외한다', () => {
    const records: ResponseRecord[] = [
      {
        studentKey: 'test1',
        identity: { name: '테스트교사' },
        startedAt: '2026-07-28T00:00:00.000Z',
        path: ['s1'],
        answers: {},
        scores: {},
        isTest: true,
      },
    ]
    const workbook = buildResultsWorkbook(makeLesson(), records)
    const sheet = workbook.Sheets['응답']
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    expect(rows.length).toBe(1) // 헤더만
  })
})
