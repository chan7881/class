import { isQuestionAnswered } from '../blocks/questions/registry'
import { listQuestionsInLesson } from './findQuestion'
import { computeSlideNumbers } from './numbering'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

/**
 * 수업 중 실시간 모니터링 화면(`/live/:code`)이 쓰는 순수 판정 로직.
 * 화면(React)에는 아무 판단도 두지 않는다 — 여기만 테스트하면 규칙이 다 검증되도록(CLAUDE.md 규칙 4).
 */

/*
 * ⚠️ **「멈춤」 판정은 없앴다** (2026-08-18, 사용자 지시).
 *
 * 판정의 근거인 "마지막 활동 시각"은 학생이 서버에 저장할 때마다 갱신되는 값인데,
 * 같은 날 서버 부하를 줄이려고 **저장을 슬라이드 이동 시점과 60초 주기로 낮췄다.**
 * 그러면 한 슬라이드에서 오래 고민하는 학생이 "멈춤"으로 뜬다 — 없는 문제를 있다고
 * 알리는 셈이라, 잘못된 신호를 주느니 판정을 걷어내는 쪽을 골랐다.
 *
 * 「마지막 활동 N분 전」 표시 자체는 남긴다. 사실을 그대로 보여줄 뿐 판단을 하지 않는다.
 */

/** "방금"으로 볼 시간(초). */
const ACTIVE_WINDOW_SEC = 90

export interface LiveStudent {
  record: ResponseRecord
  /** 지금 보고 있는 슬라이드 표시 번호("4-1"). 알 수 없으면 null */
  slideLabel: string | null
  /** 전체 슬라이드 수(메인 기준). "3 / 5"처럼 어디쯤인지 함께 보여주기 위한 값 */
  slideTotal: number
  /** 메인 슬라이드 기준 진행률 0~1 */
  progress: number
  answered: number
  totalQuestions: number
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
 * 전체 슬라이드 수. 학생 화면의 진행 표시("4-1 / 5")와 **같은 기준**으로 메인만 센다 —
 * 두 화면이 다른 수를 보여주면 교사와 학생이 서로 다른 이야기를 하게 된다.
 */
export function mainSlideCount(lesson: Lesson): number {
  return lesson.slides.filter((s) => !s.isSub).length
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

/** "방금 / 3분 전"처럼 짧게. 수업 중 멀리서 읽는 화면이라 초 단위는 안 쓴다. */
export function formatSince(secs: number | null): string {
  if (secs === null) return '활동 기록 없음'
  if (secs <= ACTIVE_WINDOW_SEC) return '방금'
  const minutes = Math.floor(secs / 60)
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}

/**
 * 학생을 늘어놓는 기준.
 *
 * 기준마다 **교사가 하려는 행동**이 다르다 — 많이 만들지 않고 실제로 쓰는 것만 둔다:
 *  · `progress` 뒤처진 학생 찾기 (이 화면의 기본 목적. 「도움 필요 순」이 하던 자리)
 *  · `number`   출석부·자리표와 대조하며 훑기
 *  · `joined`   늦게 들어온 학생 찾기
 *  · `name`     번호를 안 쓰는 학급에서 이름으로 찾기
 */
export const SORT_MODES = [
  { id: 'progress', label: '진행 느린 순' },
  { id: 'number', label: '번호순' },
  { id: 'joined', label: '접속 순' },
  { id: 'name', label: '이름순' },
] as const
export type SortMode = (typeof SORT_MODES)[number]['id']

/**
 * 번호는 문자열이라 그냥 비교하면 "10"이 "2"보다 앞에 온다. 숫자로 읽어 비교한다.
 *
 * ⚠️ **빈 값을 그냥 `Number()`에 넣으면 안 된다** — `Number('')`은 NaN이 아니라 **0**이라
 * 번호 없는 학생이 1번보다 앞으로 온다. 빈 값은 먼저 걸러낸다.
 */
function numberValue(record: ResponseRecord): number {
  const raw = String(record.identity.number ?? '').trim()
  if (!raw) return Number.POSITIVE_INFINITY // 번호 없는 학생은 뒤로
  const n = Number(raw)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function compareBy(mode: SortMode, a: LiveStudent, b: LiveStudent): number {
  switch (mode) {
    case 'number':
      return numberValue(a.record) - numberValue(b.record)
    case 'joined':
      return String(a.record.startedAt).localeCompare(String(b.record.startedAt))
    case 'name':
      return String(a.record.identity.name ?? '').localeCompare(String(b.record.identity.name ?? ''), 'ko')
    case 'progress':
    default:
      return a.progress - b.progress // 덜 나간 학생부터 — 뒤처진 쪽이 먼저 보여야 한다
  }
}

/**
 * 고른 기준으로 정렬한다.
 *
 * **마지막에 항상 `studentKey`로 한 번 더 가른다.** 이 화면은 8초마다 다시 그리는데, 값이 같은
 * 학생들의 순서가 그때그때 달라지면 카드가 계속 자리를 바꿔 눈으로 좇을 수가 없다.
 */
export function sortStudents(students: LiveStudent[], mode: SortMode): LiveStudent[] {
  return [...students].sort((a, b) => {
    const primary = compareBy(mode, a, b)
    if (primary !== 0) return primary
    return a.record.studentKey.localeCompare(b.record.studentKey)
  })
}

export interface LiveView {
  /** 아직 제출하지 않은 학생 — 덜 나간 쪽이 앞에 온다 */
  inProgress: LiveStudent[]
  /** 제출을 끝낸 학생 — 이 화면의 주인공이 아니라 아래로 내린다 */
  submitted: LiveStudent[]
}

/** 화면이 그대로 그릴 수 있는 형태로 정리한다. 기본 정렬은 **덜 나간 학생부터**. */
export function buildLiveView(
  lesson: Lesson,
  records: ResponseRecord[],
  lastSeen: Record<string, string>,
  serverNow: string,
  sortMode: SortMode = 'progress',
): LiveView {
  const totalQuestions = listQuestionsInLesson(lesson).length
  const slideTotal = mainSlideCount(lesson)

  const students: LiveStudent[] = records
    .filter((r) => !r.isTest) // 교사 테스트 응답이 학급 명단에 섞이면 인원수가 틀어진다
    .map((record) => {
      const secs = secondsSince(lastSeen[record.studentKey], serverNow)
      return {
        record,
        slideLabel: currentSlideLabel(lesson, record),
        slideTotal,
        progress: slideProgress(lesson, record),
        answered: answeredCount(lesson, record),
        totalQuestions,
        secondsSince: secs,
      }
    })

  const inProgress = sortStudents(
    students.filter((s) => !s.record.submittedAt),
    sortMode,
  )
  // 제출한 학생도 같은 기준으로 늘어놓는다 — 번호순을 골랐는데 아래 묶음만 딴 순서면 헷갈린다.
  const submitted = sortStudents(
    students.filter((s) => s.record.submittedAt),
    sortMode,
  )

  return { inProgress, submitted }
}

/**
 * 교실 앞 화면에 띄울 때 쓰는 가림 이름. 이름 대신 **번호**를 쓰되, 번호가 없으면
 * 명단 순서로 "학생 3"을 준다(가린다면서 다른 식별정보를 흘리면 의미가 없다).
 */
export function maskedLabel(record: ResponseRecord, index: number): string {
  const number = record.identity.number
  return number ? `${number}번` : `학생 ${index + 1}`
}
