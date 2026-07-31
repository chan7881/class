import { ChartRenderer } from '../components/ChartRenderer'
import { computeQuestionStats } from '../lib/resultsStats'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { ResponseRecord } from '../api/types'
import type { Question } from '../types/lesson'

const MAX_BARS = 8

/**
 * 정답률을 색이 있는 가로 막대로 보여준다 — 문항이 20개쯤 되면 숫자만으로는 어느 게 어려웠는지
 * 훑어보기 어렵다. 색은 임계값으로 정하되 **숫자 라벨을 항상 함께 남긴다**(CLAUDE.md 규칙 9 —
 * 색만으로 정보를 전달하지 않는다. 색약 사용자와 흑백 인쇄를 위해서다).
 */
function AccuracyMeter({ pct }: { pct: number }) {
  const fill = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warn' : 'bg-danger'
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className="shrink-0 text-xs font-medium text-neutral-600">정답률 {pct.toFixed(0)}%</span>
    </div>
  )
}

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
        <span className="shrink-0 text-xs text-neutral-500">{stats.answeredCount}명 응답</span>
      </div>
      {/* 자동채점 대상이 아닌 문항(서답형 자유서술 등)은 정답률 자체가 null이라 미터를 안 그린다 */}
      {stats.accuracyPct !== null && <AccuracyMeter pct={stats.accuracyPct} />}
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
