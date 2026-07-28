import { ChartRenderer } from '../components/ChartRenderer'
import { computeQuestionStats } from '../lib/resultsStats'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { ResponseRecord } from '../api/types'
import type { Question } from '../types/lesson'

const MAX_BARS = 8

export function QuestionStats({ question, index, records }: { question: Question; index: number; records: ResponseRecord[] }) {
  const stats = computeQuestionStats(question, records)
  const chartData = stats.distribution.slice(0, MAX_BARS).map((d) => ({ 값: d.label, 응답수: d.count }))

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-400">Q{index + 1}</p>
          <div className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.prompt) || '(지문 없음)' }} />
        </div>
        <span className="shrink-0 text-xs text-neutral-500">
          {stats.answeredCount}명 응답{stats.accuracyPct !== null ? ` · 정답률 ${stats.accuracyPct.toFixed(0)}%` : ''}
        </span>
      </div>
      {chartData.length > 0 ? (
        <div className="mt-2">
          <ChartRenderer type="bar" data={chartData} xKey="값" yKeys={['응답수']} height={140} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">아직 응답이 없어요</p>
      )}
    </div>
  )
}
