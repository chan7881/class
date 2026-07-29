import { describe, expect, it } from 'vitest'
import { gradeQuestion, hasGrader } from '../../lib/grade'
import { getQuestionDefinition, isQuestionAnswered } from './registry'
import './index' // registerQuestion(...) 부작용으로 6종 채점기를 lib/grade.ts에 등록
import type {
  ChemQuestion,
  ChoiceQuestion,
  ClozeQuestion,
  ComboQuestion,
  DataTableQuestion,
  MatchQuestion,
  MathQuestion,
  NumericQuestion,
  OrderQuestion,
  ShortQuestion,
} from '../../types/lesson'

describe('choice 채점', () => {
  const q: ChoiceQuestion = {
    id: 'q1',
    kind: 'choice',
    prompt: '',
    required: true,
    points: 10,
    multiple: false,
    options: [
      { id: 'a', label: '9.8' },
      { id: 'b', label: '3.7' },
    ],
    answer: ['a'],
  }

  it('정답이면 만점', () => {
    expect(gradeQuestion(q, ['a'])).toEqual({ correct: true, points: 10 })
  })
  it('오답이면 0점', () => {
    expect(gradeQuestion(q, ['b'])).toEqual({ correct: false, points: 0 })
  })
  it('복수 선택은 집합으로 비교한다(순서 무관)', () => {
    const multi: ChoiceQuestion = { ...q, multiple: true, answer: ['a', 'b'] }
    expect(gradeQuestion(multi, ['b', 'a'])).toEqual({ correct: true, points: 10 })
    expect(gradeQuestion(multi, ['a'])).toEqual({ correct: false, points: 0 })
  })
  it('isAnswered는 선택이 있을 때만 true', () => {
    expect(isQuestionAnswered(q, [])).toBe(false)
    expect(isQuestionAnswered(q, ['a'])).toBe(true)
  })
})

describe('short 채점', () => {
  const exactQ: ShortQuestion = { id: 'q2', kind: 'short', prompt: '', required: true, points: 5, rows: 1, matchMode: 'exact', answer: ['미토콘드리아'] }

  it('정확히 일치(공백·대소문자 무시)하면 정답', () => {
    expect(gradeQuestion(exactQ, '  미토콘드리아  ')).toEqual({ correct: true, points: 5 })
  })
  it('다르면 오답', () => {
    expect(gradeQuestion(exactQ, '엽록체')).toEqual({ correct: false, points: 0 })
  })
  it('contains 모드는 키워드 포함이면 정답', () => {
    const containsQ: ShortQuestion = { ...exactQ, matchMode: 'contains', answer: ['광합성'] }
    expect(gradeQuestion(containsQ, '식물은 광합성을 통해 에너지를 만든다')).toEqual({ correct: true, points: 5 })
  })
  it('정답 목록이 비어있으면 항상 오답(자동채점 없음)', () => {
    const noAnswerQ: ShortQuestion = { ...exactQ, answer: undefined }
    expect(gradeQuestion(noAnswerQ, '아무거나')?.correct).toBe(false)
  })

  describe('keywords 모드 (AND/OR 키워드 조합)', () => {
    const keywordQ: ShortQuestion = { ...exactQ, matchMode: 'keywords', keywordExpr: '지진,(흔들림, 떨림), 땅' }

    it('모든 AND 그룹을 만족하면(OR는 하나만) 정답', () => {
      expect(gradeQuestion(keywordQ, '지진이 나면 땅이 흔들림')).toEqual({ correct: true, points: 5 })
      expect(gradeQuestion(keywordQ, '지진이 나면 땅이 떨림')).toEqual({ correct: true, points: 5 })
    })
    it('일부 그룹만 만족하면 절반 점수를 주는 부분정답(오답 취급, partial:true)', () => {
      expect(gradeQuestion(keywordQ, '지진이 났다')).toEqual({ correct: false, partial: true, points: 2.5 })
    })
    it('아무 그룹도 못 맞히면 0점', () => {
      expect(gradeQuestion(keywordQ, '화산 폭발')).toEqual({ correct: false, points: 0 })
    })
  })
})

describe('cloze 채점', () => {
  const q: ClozeQuestion = {
    id: 'q3',
    kind: 'cloze',
    prompt: '',
    required: true,
    points: 10,
    segments: [
      { t: 'text', v: '지구의 중력가속도는 약 ' },
      { t: 'blank', mode: 'input', answer: ['9.8'] },
      { t: 'text', v: ' m/s² 이고, 화성은 ' },
      { t: 'blank', mode: 'select', options: ['3.7', '9.8'], answer: ['3.7'] },
      { t: 'text', v: ' m/s² 이다.' },
    ],
  }

  it('모든 빈칸이 맞으면 정답', () => {
    expect(gradeQuestion(q, ['9.8', '3.7'])).toEqual({ correct: true, points: 10 })
  })
  it('빈칸 하나라도 틀리면 오답', () => {
    expect(gradeQuestion(q, ['9.8', '9.8'])).toEqual({ correct: false, points: 0 })
  })
  it('isAnswered는 모든 빈칸이 채워져야 true', () => {
    expect(isQuestionAnswered(q, ['9.8', ''])).toBe(false)
    expect(isQuestionAnswered(q, ['9.8', '3.7'])).toBe(true)
  })
})

describe('combo(합답형) 채점', () => {
  const q: ComboQuestion = {
    id: 'q4',
    kind: 'combo',
    prompt: '',
    required: true,
    points: 10,
    statements: [
      { id: 's1', label: '광합성은 빛에너지를 이용한다' },
      { id: 's2', label: '호흡은 산소를 소비한다' },
    ],
    options: [
      { id: 'o1', label: 'ㄱ', set: ['s1'] },
      { id: 'o2', label: 'ㄱ, ㄴ', set: ['s1', 's2'] },
    ],
    answer: 'o2',
  }

  it('지정한 보기를 고르면 정답', () => {
    expect(gradeQuestion(q, 'o2')).toEqual({ correct: true, points: 10 })
  })
  it('다른 보기를 고르면 오답', () => {
    expect(gradeQuestion(q, 'o1')).toEqual({ correct: false, points: 0 })
  })

  it('toCell/describeAnswer는 체크한 진술 조합("ㄱ, ㄴ")을 그대로 보여준다', () => {
    const def = getQuestionDefinition('combo')!
    expect(def.toCell?.(q, 'o2')).toBe('ㄱ, ㄴ')
    expect(def.describeAnswer?.(q)).toBe('ㄱ, ㄴ')
  })

  it('체크한 진술이 없는 보기는 "모두 옳지 않음"으로 표시된다', () => {
    const withEmptyOption: ComboQuestion = { ...q, options: [...q.options, { id: 'o3', label: '모두 옳지 않음', set: [] }] }
    const def = getQuestionDefinition('combo')!
    expect(def.toCell?.(withEmptyOption, 'o3')).toBe('모두 옳지 않음')
  })
})

describe('order(순서배열) 채점', () => {
  const q: OrderQuestion = {
    id: 'q5',
    kind: 'order',
    prompt: '',
    required: true,
    points: 10,
    items: [
      { id: 'a', label: '알' },
      { id: 'b', label: '애벌레' },
      { id: 'c', label: '번데기' },
      { id: 'd', label: '성충' },
    ],
    answer: ['a', 'b', 'c', 'd'],
  }

  it('정답 순서와 완전히 같아야 정답', () => {
    expect(gradeQuestion(q, ['a', 'b', 'c', 'd'])).toEqual({ correct: true, points: 10 })
  })
  it('순서가 하나라도 바뀌면 오답', () => {
    expect(gradeQuestion(q, ['a', 'c', 'b', 'd'])).toEqual({ correct: false, points: 0 })
  })
  it('isAnswered는 전부 배치해야 true', () => {
    expect(isQuestionAnswered(q, ['a', 'b'])).toBe(false)
    expect(isQuestionAnswered(q, ['a', 'b', 'c', 'd'])).toBe(true)
  })
})

describe('match(연결형) 채점', () => {
  const q: MatchQuestion = {
    id: 'q6',
    kind: 'match',
    prompt: '',
    required: true,
    points: 10,
    left: [
      { id: 'l1', label: '미토콘드리아' },
      { id: 'l2', label: '엽록체' },
    ],
    right: [
      { id: 'r1', label: '광합성' },
      { id: 'r2', label: '세포호흡' },
    ],
    answer: [
      ['l1', 'r2'],
      ['l2', 'r1'],
    ],
  }

  it('모든 짝을 맞게 연결하면 정답(순서 무관)', () => {
    expect(
      gradeQuestion(q, [
        ['l2', 'r1'],
        ['l1', 'r2'],
      ]),
    ).toEqual({ correct: true, points: 10 })
  })
  it('짝이 하나라도 틀리면 오답', () => {
    expect(
      gradeQuestion(q, [
        ['l1', 'r1'],
        ['l2', 'r2'],
      ]),
    ).toEqual({ correct: false, points: 0 })
  })
  it('isAnswered는 왼쪽 항목 수만큼 짝지어야 true', () => {
    expect(isQuestionAnswered(q, [['l1', 'r2']])).toBe(false)
    expect(
      isQuestionAnswered(q, [
        ['l1', 'r2'],
        ['l2', 'r1'],
      ]),
    ).toBe(true)
  })
})

describe('numeric 채점', () => {
  const q: NumericQuestion = {
    id: 'q7',
    kind: 'numeric',
    prompt: '',
    required: true,
    points: 10,
    answer: 9.8,
    tolerance: { mode: 'abs', value: 0.2 },
    unit: 'm/s^2',
    unitMode: 'convertible',
  }

  it('허용오차 안이면 정답', () => {
    expect(gradeQuestion(q, { raw: '9.7', unit: 'm/s^2' })).toEqual({ correct: true, points: 10 })
  })
  it('허용오차 밖이면 오답', () => {
    expect(gradeQuestion(q, { raw: '9.4', unit: 'm/s^2' })).toEqual({ correct: false, points: 0 })
  })
  it('단위가 호환 안 되면 오답(convertible)', () => {
    expect(gradeQuestion(q, { raw: '9.8', unit: 's' })).toEqual({ correct: false, points: 0 })
  })
  it('유효숫자가 지정되면 원문 표기까지 확인한다', () => {
    const withSigFigs: NumericQuestion = { ...q, sigFigs: 3 }
    expect(gradeQuestion(withSigFigs, { raw: '9.8', unit: 'm/s^2' })).toEqual({ correct: false, points: 0 }) // 2자리라 탈락
    expect(gradeQuestion(withSigFigs, { raw: '9.80', unit: 'm/s^2' })).toEqual({ correct: true, points: 10 })
  })
  it('unitMode: required는 정확히 같은 단위 문자열만 인정한다', () => {
    const requiredUnit: NumericQuestion = { ...q, unitMode: 'required' }
    expect(gradeQuestion(requiredUnit, { raw: '9.8', unit: 'm/s²' })).toEqual({ correct: false, points: 0 }) // 표기가 다름
    expect(gradeQuestion(requiredUnit, { raw: '9.8', unit: 'm/s^2' })).toEqual({ correct: true, points: 10 })
  })
  it('isAnswered는 값이 입력돼야 true', () => {
    expect(isQuestionAnswered(q, { raw: '', unit: '' })).toBe(false)
    expect(isQuestionAnswered(q, { raw: '9.8', unit: '' })).toBe(true)
  })
})

describe('chem(화학식) 채점', () => {
  const q: ChemQuestion = { id: 'q8', kind: 'chem', prompt: '', required: true, points: 10, answer: ['H2O'] }

  it('버튼으로 입력한 유니코드 첨자도 정답으로 인정한다', () => {
    expect(gradeQuestion(q, 'H₂O')).toEqual({ correct: true, points: 10 })
  })
  it('다르면 오답', () => {
    expect(gradeQuestion(q, 'H2O2')).toEqual({ correct: false, points: 0 })
  })
})

describe('math(수식) 채점', () => {
  const q: MathQuestion = {
    id: 'q9',
    kind: 'math',
    prompt: '',
    required: true,
    points: 10,
    keyboards: ['basic'],
    compareMode: 'normalized',
    answer: ['\\frac{1}{2}'],
  }

  it('서식만 다른 같은 표현은 정답', () => {
    expect(gradeQuestion(q, '\\frac{1}{2}')).toEqual({ correct: true, points: 10 })
  })
  it('다른 수식은 오답 (문자열 정규화 비교라 수식적 동치까지는 못 잡음 — symbolic 모드 몫, 아직 미구현)', () => {
    expect(gradeQuestion(q, '0.5')).toEqual({ correct: false, points: 0 })
  })
})

describe('dataTable(데이터표)은 정오답 개념이 없다', () => {
  it('grade가 등록되어 있지 않다(그리기·사진과 같은 방식)', () => {
    expect(hasGrader('dataTable')).toBe(false)
  })
  it('gradeQuestion은 항상 null을 반환한다', () => {
    const q: DataTableQuestion = { id: 'q10', kind: 'dataTable', prompt: '', required: true, points: 10, columns: [], rowCount: 3 }
    expect(gradeQuestion(q, { cells: [] })).toBeNull()
  })
})
