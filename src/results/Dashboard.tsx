import { CheckCheck, Clock, Target, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from '../components/Icon'
import { listQuestionsInLesson } from '../lib/findQuestion'
import { computeSummary } from '../lib/resultsStats'
import { MediaGallery } from './MediaGallery'
import { QuestionStats } from './QuestionStats'
import { StudentTable } from './StudentTable'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}분 ${s}초`
}

/**
 * 아이콘은 `text-neutral-400`으로 눌러 보조 역할에 묶어둔다 — 이 타일의 주인공은 어디까지나
 * 숫자다. 아이콘에 색을 주면 숫자보다 먼저 눈에 들어와 오히려 읽기 어려워진다.
 */
function SummaryCard({
  label,
  value,
  icon,
  ratio,
}: {
  label: string
  value: string
  icon: LucideIcon
  /** 0~1. 주면 값 아래에 얇은 비율 막대를 그린다(제출률처럼 "전체 중 얼마"가 핵심인 지표용) */
  ratio?: number | null
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon icon={icon} className="text-neutral-400" />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {ratio !== null && ratio !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-accent-500"
            style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function Dashboard({ lesson, records }: { lesson: Lesson; records: ResponseRecord[] }) {
  const real = records.filter((r) => !r.isTest)
  const summary = computeSummary(records)
  const questions = listQuestionsInLesson(lesson)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="접속" value={String(summary.visited)} icon={Users} />
        {/* 제출률은 "몇 명이 아직 안 냈나"라는 이 화면의 핵심 질문이라 막대를 같이 준다 */}
        <SummaryCard
          label="제출"
          value={String(summary.submitted)}
          icon={CheckCheck}
          ratio={summary.visited > 0 ? summary.submitted / summary.visited : null}
        />
        <SummaryCard label="평균 점수" value={summary.avgScore !== null ? summary.avgScore.toFixed(1) : '—'} icon={Target} />
        <SummaryCard
          label="평균 소요시간"
          value={summary.avgDurationSec !== null ? formatDuration(summary.avgDurationSec) : '—'}
          icon={Clock}
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold">문항별 통계</h2>
        <div className="mt-2 flex flex-col gap-3">
          {questions.length === 0 ? (
            <p className="text-sm text-neutral-400">문항이 없어요</p>
          ) : (
            questions.map((q, i) => <QuestionStats key={q.id} question={q} index={i} records={real} />)
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">사진·그림 답안</h2>
        <div className="mt-2">
          <MediaGallery lesson={lesson} records={real} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">학생별 답안</h2>
        <div className="mt-2">
          <StudentTable lesson={lesson} records={real} />
        </div>
      </section>
    </div>
  )
}
