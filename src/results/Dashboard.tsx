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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
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
        <SummaryCard label="접속" value={String(summary.visited)} />
        <SummaryCard label="제출" value={String(summary.submitted)} />
        <SummaryCard label="평균 점수" value={summary.avgScore !== null ? summary.avgScore.toFixed(1) : '—'} />
        <SummaryCard label="평균 소요시간" value={summary.avgDurationSec !== null ? formatDuration(summary.avgDurationSec) : '—'} />
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
