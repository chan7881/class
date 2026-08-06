import { describe, expect, it } from 'vitest'
import '../blocks' // 문항 레지스트리 등록(checkAuthoring)이 있어야 문항 점검이 동작한다
import { countBySeverity, preflightLesson } from './preflight'
import type { Block, Lesson } from '../types/lesson'

function lessonWith(blocks: Block[], overrides: Partial<Lesson> = {}): Lesson {
  return {
    version: 3,
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
    slides: [{ id: 's1', isSub: false, blocks }],
    updatedAt: '2026-08-06T00:00:00.000Z',
    ...overrides,
  }
}

const goodChoice: Block = {
  id: 'b1',
  type: 'question',
  q: {
    id: 'q1',
    kind: 'choice',
    prompt: '<p>전류의 방향은?</p>',
    required: true,
    points: 10,
    multiple: false,
    options: [
      { id: 'a', label: '(+)극에서 (−)극' },
      { id: 'b', label: '(−)극에서 (+)극' },
    ],
    answer: ['a'],
  },
}

function messages(lesson: Lesson): string[] {
  return preflightLesson(lesson).map((i) => i.message)
}

describe('preflightLesson', () => {
  it('제대로 만든 수업에는 아무 문제도 보고하지 않는다', () => {
    expect(preflightLesson(lessonWith([goodChoice]))).toEqual([])
  })

  it('자리만 잡아둔 이미지 블록을 잡아낸다 — 학생 화면에서 빈칸으로 보이는 대표적인 경우', () => {
    const lesson = lessonWith([goodChoice, { id: 'b2', type: 'image', src: '', alt: '등급 라벨', width: 'full' }])
    const issue = preflightLesson(lesson).find((i) => i.message.includes('이미지'))
    expect(issue?.severity).toBe('error')
    expect(issue?.slideId).toBe('s1')
  })

  it('화이트리스트에 없는 임베드 주소는 오류로 본다 (iframe이 아예 안 뜬다)', () => {
    const lesson = lessonWith([goodChoice, { id: 'b2', type: 'embed', source: 'url', url: 'https://example.com/sim' }])
    expect(messages(lesson).some((m) => m.includes('허용 목록에 없어'))).toBe(true)
  })

  it('허용된 호스트의 임베드는 통과시킨다', () => {
    const lesson = lessonWith([goodChoice, { id: 'b2', type: 'embed', source: 'url', url: 'https://chan7881.github.io/circuit/' }])
    expect(preflightLesson(lesson)).toEqual([])
  })

  it('보기만 만들고 정답을 안 정한 선택형을 잡아낸다', () => {
    const lesson = lessonWith([{ ...goodChoice, q: { ...goodChoice.q, answer: [] } } as Block])
    expect(messages(lesson).some((m) => m.includes('정답을 지정하지 않았어요'))).toBe(true)
  })

  it('서답형 채점 안 함은 정상 설정이므로 신고하지 않는다 (탐구 활동 자유 서술)', () => {
    const lesson = lessonWith([
      { id: 'b1', type: 'question', q: { id: 'q1', kind: 'short', prompt: '<p>왜 그렇게 생각했나요?</p>', required: true, points: 10, rows: 3, matchMode: 'none' } },
    ])
    expect(preflightLesson(lesson)).toEqual([])
  })

  it('키워드 채점을 골라놓고 키워드를 비워둔 앞뒤 안 맞는 서답형은 잡아낸다', () => {
    const lesson = lessonWith([
      { id: 'b1', type: 'question', q: { id: 'q1', kind: 'short', prompt: '<p>설명하세요</p>', required: true, points: 10, rows: 3, matchMode: 'keywords', keywordExpr: '  ' } },
    ])
    expect(messages(lesson).some((m) => m.includes('키워드가 비어 있어요'))).toBe(true)
  })

  it('문항 id가 겹치면 오류다 — 한 답이 다른 문항을 덮어쓴다', () => {
    const lesson = lessonWith([goodChoice, { ...goodChoice, id: 'b2' } as Block])
    const issue = preflightLesson(lesson).find((i) => i.message.includes('겹쳐요'))
    expect(issue?.severity).toBe('error')
  })

  it('식별 필드가 하나도 없으면 오류다', () => {
    const lesson = lessonWith([goodChoice])
    lesson.settings.identityFields = []
    expect(messages(lesson).some((m) => m.includes('식별 필드'))).toBe(true)
  })

  it('빈 슬라이드와 문항 없음은 경고일 뿐 오류가 아니다 (일부러 안내용으로만 쓰는 수업이 있다)', () => {
    const counts = countBySeverity(preflightLesson(lessonWith([])))
    expect(counts.error).toBe(0)
    expect(counts.warn).toBeGreaterThan(0)
  })

  it('지문이 태그만 있고 글자가 없으면 빈 지문으로 본다', () => {
    const lesson = lessonWith([{ ...goodChoice, q: { ...goodChoice.q, prompt: '<p></p>' } } as Block])
    expect(messages(lesson).some((m) => m.includes('지문이 비어 있어요'))).toBe(true)
  })

  it('슬라이드 문제에는 화면에 붙일 슬라이드 번호가 함께 온다', () => {
    const lesson = lessonWith([goodChoice])
    lesson.slides.push({ id: 's2', isSub: true, blocks: [] })
    const issue = preflightLesson(lesson).find((i) => i.slideId === 's2')
    expect(issue?.slideNumber).toBe('1-1')
  })
})
