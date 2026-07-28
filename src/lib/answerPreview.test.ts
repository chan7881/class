import { describe, expect, it } from 'vitest'
import '../blocks/questions/index'
import { describeCorrectAnswer } from './answerPreview'
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

  it('dataTable: answerTargets가 있으면 기울기·절편을 보여주고, 없으면 null', () => {
    const withTargets: DataTableQuestion = {
      ...base,
      id: 'q1',
      kind: 'dataTable',
      columns: [{ key: 'A', label: 'A', type: 'number' }],
      rowCount: 3,
      answerTargets: { slope: 2, intercept: 0, tolerance: 0.5 },
    }
    const withoutTargets: DataTableQuestion = { ...base, id: 'q2', kind: 'dataTable', columns: [], rowCount: 3 }
    expect(describeCorrectAnswer(withTargets)).toBe('기울기 2 · 절편 0 (허용오차 ±0.5)')
    expect(describeCorrectAnswer(withoutTargets)).toBeNull()
  })

  it('drawing/photo: 정답 개념이 없어 항상 null', () => {
    const drawing: DrawingQuestion = { ...base, id: 'q1', kind: 'drawing', tools: ['pen'] }
    const photo: PhotoQuestion = { ...base, id: 'q2', kind: 'photo', maxFiles: 1 }
    expect(describeCorrectAnswer(drawing)).toBeNull()
    expect(describeCorrectAnswer(photo)).toBeNull()
  })
})
