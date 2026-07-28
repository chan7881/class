import { listQuestionsInLesson } from '../lib/findQuestion'
import { cellForAnswer } from '../lib/resultsStats'
import type { ResponseRecord } from '../api/types'
import type { IdentityField, Lesson } from '../types/lesson'

const IDENTITY_LABELS: Record<IdentityField, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }

export function StudentTable({ lesson, records }: { lesson: Lesson; records: ResponseRecord[] }) {
  const questions = listQuestionsInLesson(lesson)
  const idFields = lesson.settings.identityFields

  if (records.length === 0) return <p className="text-sm text-neutral-400">아직 응답이 없어요</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            {idFields.map((f) => (
              <th key={f} className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">
                {IDENTITY_LABELS[f]}
              </th>
            ))}
            <th className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">제출</th>
            <th className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">총점</th>
            {questions.map((q, i) => (
              <th key={q.id} className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">
                Q{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const total = Object.values(r.scores).reduce((sum, s) => sum + s.points, 0)
            return (
              <tr key={r.studentKey}>
                {idFields.map((f) => (
                  <td key={f} className="whitespace-nowrap border border-neutral-200 p-1.5">
                    {r.identity[f] ?? ''}
                  </td>
                ))}
                <td className="whitespace-nowrap border border-neutral-200 p-1.5">{r.submittedAt ? '✓' : '진행중'}</td>
                <td className="whitespace-nowrap border border-neutral-200 p-1.5">{total}</td>
                {questions.map((q) => {
                  const value = r.answers[q.id]
                  const score = r.scores[q.id]
                  const bg = score ? (score.correct ? 'bg-green-50' : 'bg-red-50') : ''
                  return (
                    <td key={q.id} className={`max-w-48 truncate border border-neutral-200 p-1.5 ${bg}`}>
                      {value === undefined ? '' : cellForAnswer(q, value)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
