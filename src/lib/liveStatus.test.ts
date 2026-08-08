import { describe, expect, it } from 'vitest'
import '../blocks/questions/index' // registerQuestion(...) 부작용으로 isAnswered를 registry에 등록
import {
  activityState,
  mainSlideCount,
  answeredCount,
  buildLiveView,
  currentSlideLabel,
  formatSince,
  maskedLabel,
  secondsSince,
  slideProgress,
} from './liveStatus'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

/** 메인 3장 + 2번 뒤에 보조 1장 → 표시 번호는 1, 2, 2-1, 3 */
function makeLesson(): Lesson {
  const questionBlock = (blockId: string, id: string) => ({
    id: blockId,
    type: 'question' as const,
    q: { id, kind: 'short' as const, prompt: '', points: 10, required: false, rows: 3, matchMode: 'none' as const },
  })
  return {
    version: 3,
    code: 'ABC123',
    title: '테스트',
    published: true,
    updatedAt: '2026-08-08T00:00:00.000Z',
    settings: {
      identityFields: ['number', 'name'],
      requireAnswerToAdvance: false,
      feedbackMode: 'onFinish',
      shuffleChoices: false,
    },
    slides: [
      { id: 's1', isSub: false, blocks: [questionBlock('b1', 'q1')] },
      { id: 's2', isSub: false, blocks: [questionBlock('b2', 'q2')] },
      { id: 's2a', isSub: true, blocks: [] },
      { id: 's3', isSub: false, blocks: [] },
    ],
  } as unknown as Lesson
}

function makeRecord(over: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    studentKey: 'k1',
    identity: { number: '7', name: '민수' },
    startedAt: '2026-08-08T00:00:00.000Z',
    path: ['s1'],
    answers: {},
    scores: {},
    isTest: false,
    ...over,
  }
}

const NOW = '2026-08-08T09:00:00.000Z'
const minutesAgo = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString()

describe('currentSlideLabel', () => {
  it('path의 마지막 슬라이드를 현재 위치로 본다', () => {
    expect(currentSlideLabel(makeLesson(), makeRecord({ path: ['s1', 's2'] }))).toBe('2')
  })

  it('보조 슬라이드에 있으면 4-1 형식으로 보여준다', () => {
    expect(currentSlideLabel(makeLesson(), makeRecord({ path: ['s1', 's2', 's2a'] }))).toBe('2-1')
  })

  it('path가 비면 1번으로 넘겨짚지 않고 모른다고 한다', () => {
    expect(currentSlideLabel(makeLesson(), makeRecord({ path: [] }))).toBeNull()
  })

  it('지워진 슬라이드 id가 남아 있어도 터지지 않는다', () => {
    expect(currentSlideLabel(makeLesson(), makeRecord({ path: ['없는슬라이드'] }))).toBeNull()
  })
})

describe('slideProgress', () => {
  it('메인 슬라이드만 세어 보조 슬라이드에서 퍼센트가 요동치지 않는다', () => {
    const lesson = makeLesson()
    // s2(메인 2/3)와 s2a(그 하위)는 진행률이 같아야 한다
    expect(slideProgress(lesson, makeRecord({ path: ['s1', 's2'] }))).toBeCloseTo(2 / 3)
    expect(slideProgress(lesson, makeRecord({ path: ['s1', 's2', 's2a'] }))).toBeCloseTo(2 / 3)
  })

  it('마지막 슬라이드면 1', () => {
    expect(slideProgress(makeLesson(), makeRecord({ path: ['s3'] }))).toBe(1)
  })
})

describe('mainSlideCount', () => {
  it('보조 슬라이드는 세지 않는다 — 학생 화면의 진행 표시와 같은 기준', () => {
    // 메인 3장 + 보조 1장
    expect(mainSlideCount(makeLesson())).toBe(3)
  })

  it('카드에 실리는 전체 수도 같은 값이다', () => {
    const view = buildLiveView(makeLesson(), [makeRecord()], {}, NOW, 5)
    expect(view.inProgress[0].slideTotal).toBe(3)
  })

  it('보조 슬라이드에 있어도 전체 수는 그대로다 ("2-1 / 3")', () => {
    const view = buildLiveView(makeLesson(), [makeRecord({ path: ['s1', 's2', 's2a'] })], {}, NOW, 5)
    expect(view.inProgress[0].slideLabel).toBe('2-1')
    expect(view.inProgress[0].slideTotal).toBe(3)
  })
})

describe('answeredCount', () => {
  it('실제로 답을 채운 문항만 센다', () => {
    const lesson = makeLesson()
    expect(answeredCount(lesson, makeRecord({ answers: {} }))).toBe(0)
    expect(answeredCount(lesson, makeRecord({ answers: { q1: '답' } }))).toBe(1)
    // 빈 문자열은 답한 게 아니다
    expect(answeredCount(lesson, makeRecord({ answers: { q1: '' } }))).toBe(0)
  })
})

describe('secondsSince — 서버 시각 기준', () => {
  it('서버 시각에서 마지막 활동을 뺀다', () => {
    expect(secondsSince(minutesAgo(3), NOW)).toBe(180)
  })

  it('기록이 없으면 null', () => {
    expect(secondsSince(undefined, NOW)).toBeNull()
  })

  it('미래 시각이 와도 음수를 내보내지 않는다 (기기 시계가 틀어진 경우)', () => {
    const future = new Date(Date.parse(NOW) + 5 * 60_000).toISOString()
    expect(secondsSince(future, NOW)).toBe(0)
  })

  it('망가진 시각 문자열은 null', () => {
    expect(secondsSince('어제', NOW)).toBeNull()
  })
})

describe('activityState — 멈춤 판정 경계', () => {
  it('임계 직전은 멈춤이 아니고, 임계에 닿으면 멈춤이다', () => {
    expect(activityState(5 * 60 - 1, 5)).toBe('idle')
    expect(activityState(5 * 60, 5)).toBe('stalled')
  })

  it('최근 활동은 active', () => {
    expect(activityState(10, 5)).toBe('active')
  })

  it('기록이 없으면 stalled가 아니라 unknown — 모르는 것과 멈춘 것은 다르다', () => {
    expect(activityState(null, 5)).toBe('unknown')
  })

  it('기준 시간을 바꾸면 판정도 따라 바뀐다', () => {
    expect(activityState(4 * 60, 3)).toBe('stalled')
    expect(activityState(4 * 60, 10)).toBe('idle')
  })
})

describe('formatSince', () => {
  it('활동 기록이 없으면 시간처럼 보이지 않게 쓴다', () => {
    expect(formatSince(null)).toBe('활동 기록 없음')
  })

  it('최근이면 방금', () => {
    expect(formatSince(30)).toBe('방금')
  })

  it('분·시간 단위로 줄여 쓴다', () => {
    expect(formatSince(5 * 60)).toBe('5분 전')
    expect(formatSince(2 * 3600)).toBe('2시간 전')
  })
})

describe('buildLiveView', () => {
  const lesson = makeLesson()

  it('제출한 학생은 진행 중 명단에서 빠진다', () => {
    const records = [
      makeRecord({ studentKey: 'a' }),
      makeRecord({ studentKey: 'b', submittedAt: NOW }),
    ]
    const view = buildLiveView(lesson, records, {}, NOW, 5)
    expect(view.inProgress.map((s) => s.record.studentKey)).toEqual(['a'])
    expect(view.submitted.map((s) => s.record.studentKey)).toEqual(['b'])
  })

  it('교사 테스트 응답은 학급 명단에 섞이지 않는다', () => {
    const records = [makeRecord({ studentKey: 'a' }), makeRecord({ studentKey: 't', isTest: true })]
    const view = buildLiveView(lesson, records, {}, NOW, 5)
    expect(view.inProgress).toHaveLength(1)
    expect(view.submitted).toHaveLength(0)
  })

  it('멈춘 학생이 맨 앞에, 오래 멈춘 순으로 온다', () => {
    const records = [
      makeRecord({ studentKey: 'ok' }),
      makeRecord({ studentKey: 'stall2' }),
      makeRecord({ studentKey: 'stall9' }),
    ]
    const lastSeen = { ok: minutesAgo(0), stall2: minutesAgo(6), stall9: minutesAgo(20) }
    const view = buildLiveView(lesson, records, lastSeen, NOW, 5)
    expect(view.inProgress.map((s) => s.record.studentKey)).toEqual(['stall9', 'stall2', 'ok'])
    expect(view.stalledCount).toBe(2)
  })

  it('멈춘 학생이 없으면 덜 나간 학생부터 보여준다', () => {
    const records = [
      makeRecord({ studentKey: 'far', path: ['s1', 's2', 's3'] }),
      makeRecord({ studentKey: 'near', path: ['s1'] }),
    ]
    const lastSeen = { far: minutesAgo(0), near: minutesAgo(0) }
    const view = buildLiveView(lesson, records, lastSeen, NOW, 5)
    expect(view.inProgress.map((s) => s.record.studentKey)).toEqual(['near', 'far'])
  })

  it('활동 기록이 없어도 진행 정보는 그대로 나온다 (캐시가 비었을 때)', () => {
    const view = buildLiveView(lesson, [makeRecord({ path: ['s1', 's2'], answers: { q1: '답' } })], {}, NOW, 5)
    const student = view.inProgress[0]
    expect(student.state).toBe('unknown')
    expect(student.slideLabel).toBe('2')
    expect(student.answered).toBe(1)
    expect(view.stalledCount).toBe(0) // 모르는 것을 멈춘 것으로 세면 안 된다
  })
})

describe('maskedLabel — 교실 앞 화면용', () => {
  it('번호가 있으면 번호로 가린다', () => {
    expect(maskedLabel(makeRecord(), 0)).toBe('7번')
  })

  it('번호가 없으면 이름 대신 순번을 쓴다 (다른 식별정보를 흘리지 않는다)', () => {
    expect(maskedLabel(makeRecord({ identity: { name: '민수' } }), 2)).toBe('학생 3')
  })
})
