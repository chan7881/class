import { getQuestionDefinition } from '../blocks/questions/registry'
import type { ResponseRecord } from '../api/types'
import type { Question } from '../types/lesson'

/**
 * 결과 대시보드·엑셀 내보내기가 공유하는 순수 통계 함수들. UI를 전혀 모른다 (CLAUDE.md 규칙 4).
 * 교사 테스트 모드 응답(isTest:true)은 통계·집계에서 항상 제외한다 (docs/PLAN.md).
 */

export interface SummaryStats {
  visited: number
  submitted: number
  /** 제출한 학생의 평균 총점. 제출자가 없으면 null */
  avgScore: number | null
  /** 제출한 학생의 평균 소요시간(초). 계산 불가하면 null */
  avgDurationSec: number | null
}

function realRecords(records: ResponseRecord[]): ResponseRecord[] {
  return records.filter((r) => !r.isTest)
}

export function computeSummary(records: ResponseRecord[]): SummaryStats {
  const real = realRecords(records)
  const submittedRecords = real.filter((r) => r.submittedAt)

  const scores = submittedRecords.map((r) => Object.values(r.scores).reduce((sum, s) => sum + s.points, 0))
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  const durations = submittedRecords
    .map((r) => (r.submittedAt ? (new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 1000 : null))
    .filter((d): d is number => d !== null && Number.isFinite(d) && d >= 0)
  const avgDurationSec = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null

  return { visited: real.length, submitted: submittedRecords.length, avgScore, avgDurationSec }
}

/** 문항 답 값을 결과 표·엑셀 셀에 쓸 사람이 읽을 수 있는 문자열로 바꾼다. 문항 유형의 toCell을 우선 쓴다. */
export function cellForAnswer(question: Question, value: unknown): string {
  const def = getQuestionDefinition(question.kind)
  if (def?.toCell) return def.toCell(question, value)
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export interface QuestionStat {
  questionId: string
  answeredCount: number
  /** 자동채점 유형이 아니면(그리기·사진 등) null */
  accuracyPct: number | null
  /** 답 값(셀 문자열)별 응답 수, 응답 수 내림차순 */
  distribution: { label: string; count: number }[]
}

export function computeQuestionStats(question: Question, records: ResponseRecord[]): QuestionStat {
  const real = realRecords(records)
  const withAnswer = real.filter((r) => r.answers[question.id] !== undefined)
  const graded = real.filter((r) => r.scores[question.id] !== undefined)
  const accuracyPct = graded.length > 0 ? (graded.filter((r) => r.scores[question.id].correct).length / graded.length) * 100 : null

  const counts = new Map<string, number>()
  for (const r of withAnswer) {
    const label = cellForAnswer(question, r.answers[question.id]) || '(빈 답)'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const distribution = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)

  return { questionId: question.id, answeredCount: withAnswer.length, accuracyPct, distribution }
}
