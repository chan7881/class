import { ChartRenderer } from '../components/ChartRenderer'
import { getQuestionDefinition } from '../blocks/questions/registry'
import { computeQuestionStats } from '../lib/resultsStats'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { ResponseRecord } from '../api/types'
import type { Question } from '../types/lesson'

const MAX_BARS = 8
const MAX_LIST_ITEMS = 30

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

/**
 * 보기가 없는 문항(서답형·수치형·수식 등)의 응답을 목록으로 보여준다.
 *
 * 왜 막대그래프를 안 쓰나: 학생이 자유롭게 쓰는 답은 거의 전부 서로 달라서, 분포 막대가
 * "높이 1짜리 막대 N개"로만 늘어선다 — 그래프의 의미(비교)가 사라지고 답 내용도 축 라벨에
 * 잘려 읽기 어렵다. 교사가 실제로 원하는 건 "무슨 답들이 나왔나"를 훑어보는 것이라 목록이 낫다.
 * 같은 답이 여러 번 나오면 그 횟수만 옆에 배지로 붙인다.
 */
function AnswerList({ distribution }: { distribution: { label: string; count: number }[] }) {
  const shown = distribution.slice(0, MAX_LIST_ITEMS)
  const hiddenCount = distribution.length - shown.length

  return (
    <div className="mt-2">
      <ul className="max-h-56 overflow-y-auto rounded border border-neutral-200 text-sm">
        {shown.map((d, i) => (
          <li key={i} className="flex items-start justify-between gap-2 border-b border-neutral-100 px-2 py-1.5 last:border-b-0">
            <span className="min-w-0 whitespace-pre-wrap break-words text-neutral-700">{d.label}</span>
            {d.count > 1 && <span className="shrink-0 rounded bg-neutral-100 px-1.5 text-xs text-neutral-500">{d.count}명</span>}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && <p className="mt-1 text-xs text-neutral-400">외 {hiddenCount}개 — 전체는 엑셀로 내려받아 확인하세요</p>}
    </div>
  )
}

export function QuestionStats({ question, index, records }: { question: Question; index: number; records: ResponseRecord[] }) {
  const stats = computeQuestionStats(question, records)
  // 보기 중에서 고르는 유형(선택형·합답형)만 분포 막대그래프가 의미 있다 — 나머지는 답안 목록.
  const showChart = getQuestionDefinition(question.kind)?.hasFixedOptions === true
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
      {stats.distribution.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">아직 응답이 없어요</p>
      ) : showChart ? (
        // 넓은 화면에서 막대 하나가 화면 폭만큼 늘어나 과장돼 보이던 문제 — 폭을 제한한다.
        <div className="mt-2 max-w-sm">
          <ChartRenderer type="bar" data={chartData} xKey="값" yKeys={['응답수']} height={140} />
        </div>
      ) : (
        <AnswerList distribution={stats.distribution} />
      )}
    </div>
  )
}
