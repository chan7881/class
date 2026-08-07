import { isQuestionAnswered } from '../blocks/questions/registry'
import { listQuestionsInLesson } from './findQuestion'
import { computeSlideNumbers } from './numbering'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

/**
 * 수업 중 실시간 모니터링 화면(`/live/:code`)이 쓰는 순수 판정 로직.
 * 화면(React)에는 아무 판단도 두지 않는다 — 여기만 테스트하면 규칙이 다 검증되도록(CLAUDE.md 규칙 4).
 */

/** 교사가 화면에서 고를 수 있는 "멈춤" 기준 (분) */
export const STALL_THRESHOLD_MINUTES = [3, 5, 10] as const
export type StallThresholdMinutes = (typeof STALL_THRESHOLD_MINUTES)[number]

/** "방금"으로 볼 시간(초). 이 안이면 활발히 하는 중으로 본다. */
const ACTIVE_WINDOW_SEC = 90

export type ActivityState =
  /** 최근에 저장이 있었다 — 지금 하는 중 */
  | 'active'
  /** 조용하지만 아직 멈춤 기준에는 못 미친다 */
  | 'idle'
  /** 기준 시간 넘게 활동이 없다 — 교사가 들여다볼 대상 */
  | 'stalled'
  /**
   * 활동 기록이 없다. 서버가 lastSeen을 **캐시**에 두기 때문에(만료·축출 가능,
   * docs/DECISIONS.md 참고) 정상적으로도 일어난다. "오래 멈췄다"와 구별해야 한다 —
   * 모르는 것을 멈춘 것으로 표시하면 교사가 헛걸음한다.
   */
  | 'unknown'

export interface LiveStudent {
  record: ResponseRecord
  /** 지금 보고 있는 슬라이드 표시 번호("4-1"). 알 수 없으면 null */
  slideLabel: string | null
  /** 메인 슬라이드 기준 진행률 0~1 */
  progress: number
  answered: number
  totalQuestions: number
  state: ActivityState
  /** 마지막 활동 이후 흐른 초. 기록이 없으면 null */
  secondsSince: number | null
}

/**
 * 학생이 지금 있는 슬라이드의 표시 번호.
 *
 * `path`는 조건 분기로 실제 통과한 슬라이드 id 순서라 **마지막 항목이 현재 위치**다.
 * 슬라이드가 지워졌거나 path가 비었으면 null(모름) — 0번이나 1번으로 넘겨짚지 않는다.
 */
export function currentSlideLabel(lesson: Lesson, record: ResponseRecord): string | null {
  const lastId = record.path?.[record.path.length - 1]
  if (!lastId) return null
  const index = lesson.slides.findIndex((s) => s.id === lastId)
  if (index === -1) return null
  return computeSlideNumbers(lesson.slides)[index] ?? null
}

/**
 * 진행률. ProgressBar와 같은 기준으로 **메인 슬라이드만** 센다 — 보조 슬라이드(4-1)로
 * 분기해 들어갔다고 퍼센트가 요동치면 교사가 학급 상태를 잘못 읽는다.
 */
export function slideProgress(lesson: Lesson, record: ResponseRecord): number {
  const lastId = record.path?.[record.path.length - 1]
  if (!lastId) return 0
  const index = lesson.slides.findIndex((s) => s.id === lastId)
  if (index === -1) return 0
  const mainTotal = lesson.slides.filter((s) => !s.isSub).length
  if (mainTotal === 0) return 0
  const passed = lesson.slides.slice(0, index + 1).filter((s) => !s.isSub).length
  return Math.min(1, passed / mainTotal)
}

/** 실제로 답을 채운 문항 수 (결과 화면의 학생별 표와 같은 기준) */
export function answeredCount(lesson: Lesson, record: ResponseRecord): number {
  return listQuestionsInLesson(lesson).filter((q) => isQuestionAnswered(q, record.answers[q.id])).length
}

/**
 * 마지막 활동 이후 흐른 초.
 *
 * **서버 시각(`serverNow`)을 기준으로 잰다.** 교사 기기 시계가 몇 분씩 틀어져 있는 일이
 * 흔한데, 클라이언트 시계로 재면 "-3분 전" 같은 값이 나오거나 멀쩡한 학생이 전부
 * 멈춤으로 보인다. 음수는 0으로 눌러 시계 오차가 화면에 새지 않게 한다.
 */
export function secondsSince(lastSeenIso: string | undefined, serverNowIso: string): number | null {
  if (!lastSeenIso) return null
  const last = Date.parse(lastSeenIso)
  const now = Date.parse(serverNowIso)
  if (Number.isNaN(last) || Number.isNaN(now)) return null
  return Math.max(0, Math.round((now - last) / 1000))
}

export function activityState(secs: number | null, thresholdMinutes: number): ActivityState {
  if (secs === null) return 'unknown'
  if (secs >= thresholdMinutes * 60) return 'stalled'
  return secs <= ACTIVE_WINDOW_SEC ? 'active' : 'idle'
}

/** "방금 / 3분 전"처럼 짧게. 수업 중 멀리서 읽는 화면이라 초 단위는 안 쓴다. */
export function formatSince(secs: number | null): string {
  if (secs === null) return '활동 기록 없음'
  if (secs <= ACTIVE_WINDOW_SEC) return '방금'
  const minutes = Math.floor(secs / 60)
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}

export interface LiveView {
  /** 아직 제출하지 않은 학생 — 멈춘 학생이 앞에 온다 */
  inProgress: LiveStudent[]
  /** 제출을 끝낸 학생 — 이 화면의 주인공이 아니라 아래로 내린다 */
  submitted: LiveStudent[]
  stalledCount: number
}

/**
 * 화면이 그대로 그릴 수 있는 형태로 정리한다.
 *
 * 정렬은 **멈춘 학생이 맨 앞**이고 그 안에서는 오래 멈춘 순. 이 화면의 목적이
 * "지금 개입이 필요한 학생 찾기"라, 이름순으로 늘어놓으면 정작 찾아야 할 학생이 묻힌다.
 */
export function buildLiveView(
  lesson: Lesson,
  records: ResponseRecord[],
  lastSeen: Record<string, string>,
  serverNow: string,
  thresholdMinutes: number,
): LiveView {
  const totalQuestions = listQuestionsInLesson(lesson).length

  const students: LiveStudent[] = records
    .filter((r) => !r.isTest) // 교사 테스트 응답이 학급 명단에 섞이면 인원수가 틀어진다
    .map((record) => {
      const secs = secondsSince(lastSeen[record.studentKey], serverNow)
      return {
        record,
        slideLabel: currentSlideLabel(lesson, record),
        progress: slideProgress(lesson, record),
        answered: answeredCount(lesson, record),
        totalQuestions,
        state: record.submittedAt ? 'active' : activityState(secs, thresholdMinutes),
        secondsSince: secs,
      }
    })

  const inProgress = students
    .filter((s) => !s.record.submittedAt)
    .sort((a, b) => {
      const aStalled = a.state === 'stalled' ? 1 : 0
      const bStalled = b.state === 'stalled' ? 1 : 0
      if (aStalled !== bStalled) return bStalled - aStalled
      if (aStalled === 1) return (b.secondsSince ?? 0) - (a.secondsSince ?? 0)
      return a.progress - b.progress // 그다음은 덜 나간 학생부터
    })

  const submitted = students.filter((s) => s.record.submittedAt)

  return { inProgress, submitted, stalledCount: inProgress.filter((s) => s.state === 'stalled').length }
}

/**
 * 교실 앞 화면에 띄울 때 쓰는 가림 이름. 이름 대신 **번호**를 쓰되, 번호가 없으면
 * 명단 순서로 "학생 3"을 준다(가린다면서 다른 식별정보를 흘리면 의미가 없다).
 */
export function maskedLabel(record: ResponseRecord, index: number): string {
  const number = record.identity.number
  return number ? `${number}번` : `학생 ${index + 1}`
}
