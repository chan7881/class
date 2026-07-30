import { describe, expect, it } from 'vitest'
import '../blocks/questions/index'
import { describeAnswerToken, describeCorrectAnswer } from './answerPreview'
import type {
  ChemQuestion,
  ChoiceQuestion,
  ClozeQuestion,
  ComboQuestion,
  DataTableQuestion,
  DrawingQuestion,
  MatchQuestion,
  MathQuestion,
  NumericQuestion,
  OrderQuestion,
  PhotoQuestion,
  ShortQuestion,
} from '../types/lesson'

const base = { prompt: '', required: true, points: 10 }

describe('describeCorrectAnswer', () => {
  it('choice: 옵션 id를 라벨로 바꿔 보여준다', () => {
    const q: ChoiceQuestion = {
      ...base,
      id: 'q1',
      kind: 'choice',
      multiple: false,
      options: [
        { id: 'a', label: '9.8' },
        { id: 'b', label: '3.7' },
      ],
      answer: ['a'],
    }
    expect(describeCorrectAnswer(q)).toBe('9.8')
  })

  it('cloze: 빈칸마다 정답 후보를 보여준다', () => {
    const q: ClozeQuestion = {
      ...base,
      id: 'q1',
      kind: 'cloze',
      segments: [
        { t: 'text', v: '물의 화학식은 ' },
        { t: 'blank', mode: 'input', answer: ['H2O', 'H₂O'] },
      ],
    }
    expect(describeCorrectAnswer(q)).toBe('H2O|H₂O')
  })

  it('combo: 정답 보기의 라벨을 보여준다', () => {
    const q: ComboQuestion = {
      ...base,
      id: 'q1',
      kind: 'combo',
      statements: [{ id: 's1', label: '진술1' }],
      options: [{ id: 'o1', label: 'ㄱ', set: ['s1'] }],
      answer: 'o1',
    }
    expect(describeCorrectAnswer(q)).toBe('ㄱ')
  })

  it('order: 정답 순서를 화살표로 이어 보여준다', () => {
    const q: OrderQuestion = {
      ...base,
      id: 'q1',
      kind: 'order',
      items: [
        { id: 'i1', label: '하나' },
        { id: 'i2', label: '둘' },
      ],
      answer: ['i1', 'i2'],
    }
    expect(describeCorrectAnswer(q)).toBe('하나 → 둘')
  })

  it('match: 정답 페어를 보여준다', () => {
    const q: MatchQuestion = {
      ...base,
      id: 'q1',
      kind: 'match',
      left: [{ id: 'l1', label: '좌' }],
      right: [{ id: 'r1', label: '우' }],
      answer: [['l1', 'r1']],
    }
    expect(describeCorrectAnswer(q)).toBe('좌→우')
  })

  it('numeric: 값·단위·허용오차를 함께 보여준다', () => {
    const q: NumericQuestion = {
      ...base,
      id: 'q1',
      kind: 'numeric',
      answer: 9.8,
      unit: 'm/s²',
      tolerance: { mode: 'abs', value: 0.2 },
    }
    expect(describeCorrectAnswer(q)).toBe('9.8 m/s² (허용오차 ±0.2)')
  })

  it('short: 정답이 있으면 보여주고, 없으면(서답형 전용) null', () => {
    const withAnswer: ShortQuestion = { ...base, id: 'q1', kind: 'short', rows: 2, answer: ['정답A', '정답B'] }
    const withoutAnswer: ShortQuestion = { ...base, id: 'q2', kind: 'short', rows: 2, answer: [] }
    expect(describeCorrectAnswer(withAnswer)).toBe('정답A 또는 정답B')
    expect(describeCorrectAnswer(withoutAnswer)).toBeNull()
  })

  it('math/chem: 복수 정답을 "또는"으로 잇는다', () => {
    const math: MathQuestion = { ...base, id: 'q1', kind: 'math', keyboards: ['basic'], compareMode: 'normalized', answer: ['7+8', '15'] }
    const chem: ChemQuestion = { ...base, id: 'q2', kind: 'chem', answer: ['H2O'] }
    expect(describeCorrectAnswer(math)).toBe('7+8 또는 15')
    expect(describeCorrectAnswer(chem)).toBe('H2O')
  })

  it('drawing/photo/dataTable: 정답 개념이 없어 항상 null', () => {
    const drawing: DrawingQuestion = { ...base, id: 'q1', kind: 'drawing', tools: ['pen'] }
    const photo: PhotoQuestion = { ...base, id: 'q2', kind: 'photo', maxFiles: 1 }
    const dataTable: DataTableQuestion = { ...base, id: 'q3', kind: 'dataTable', columns: [], rowCount: 3 }
    expect(describeCorrectAnswer(drawing)).toBeNull()
    expect(describeCorrectAnswer(photo)).toBeNull()
    expect(describeCorrectAnswer(dataTable)).toBeNull()
  })
})

// 학급 응답 분포 차트·POE 요약처럼 getAggregate가 평탄화한 "낱개 토큰" 하나를 사람이
// 읽는 라벨로 바꿔야 하는 곳에서 쓴다 — 원시 id가 그대로 노출되던 문제(2026-07-30) 수정.
describe('describeAnswerToken', () => {
  it('choice: 옵션 id 하나를 라벨로 바꾼다', () => {
    const q: ChoiceQuestion = {
      ...base,
      id: 'q1',
      kind: 'choice',
      multiple: false,
      options: [
        { id: 'a', label: '9.8' },
        { id: 'b', label: '3.7' },
      ],
      answer: ['a'],
    }
    expect(describeAnswerToken(q, 'b')).toBe('3.7')
  })

  it('combo: 보기 id 하나를 라벨로 바꾼다', () => {
    const q: ComboQuestion = {
      ...base,
      id: 'q1',
      kind: 'combo',
      statements: [{ id: 's1', label: '진술1' }],
      options: [{ id: 'o1', label: 'ㄱ', set: ['s1'] }],
      answer: 'o1',
    }
    expect(describeAnswerToken(q, 'o1')).toBe('ㄱ')
  })

  it('order: 항목 id 하나를 라벨로 바꾼다', () => {
    const q: OrderQuestion = {
      ...base,
      id: 'q1',
      kind: 'order',
      items: [
        { id: 'i1', label: '하나' },
        { id: 'i2', label: '둘' },
      ],
      answer: ['i1', 'i2'],
    }
    expect(describeAnswerToken(q, 'i2')).toBe('둘')
  })

  it('match: 좌/우 어느 쪽 id든 라벨로 바꾼다', () => {
    const q: MatchQuestion = {
      ...base,
      id: 'q1',
      kind: 'match',
      left: [{ id: 'l1', label: '좌' }],
      right: [{ id: 'r1', label: '우' }],
      answer: [['l1', 'r1']],
    }
    expect(describeAnswerToken(q, 'l1')).toBe('좌')
    expect(describeAnswerToken(q, 'r1')).toBe('우')
  })

  it('매핑을 모르는 유형(수치형 등)은 토큰을 그대로 돌려준다', () => {
    const q: NumericQuestion = { ...base, id: 'q1', kind: 'numeric', answer: 9.8 }
    expect(describeAnswerToken(q, '9.8')).toBe('9.8')
  })

  it('id를 못 찾으면(삭제된 보기 등) 토큰 자체를 그대로 돌려준다', () => {
    const q: ChoiceQuestion = { ...base, id: 'q1', kind: 'choice', multiple: false, options: [{ id: 'a', label: '9.8' }], answer: ['a'] }
    expect(describeAnswerToken(q, 'ghost')).toBe('ghost')
  })
})
