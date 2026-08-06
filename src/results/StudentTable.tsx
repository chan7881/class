import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { isQuestionAnswered } from '../blocks/questions/registry'
import { listQuestionsInLesson } from '../lib/findQuestion'
import { cellForAnswer } from '../lib/resultsStats'
import { StudentDetail, studentLabel } from './StudentDetail'
import type { ResponseRecord } from '../api/types'
import type { IdentityField, Lesson } from '../types/lesson'

const IDENTITY_LABELS: Record<IdentityField, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }

export function StudentTable({
  lesson,
  records,
  onDeleteResponse,
}: {
  lesson: Lesson
  records: ResponseRecord[]
  onDeleteResponse?: (studentKey: string) => Promise<void>
}) {
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [onlyUnsubmitted, setOnlyUnsubmitted] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  async function handleDelete(record: ResponseRecord) {
    if (!onDeleteResponse) return
    if (!window.confirm(`${studentLabel(record, lesson.settings.identityFields)} 학생의 응답을 지울까요? 되돌릴 수 없어요.`)) return
    setDeletingKey(record.studentKey)
    try {
      await onDeleteResponse(record.studentKey)
    } finally {
      setDeletingKey(null)
    }
  }

  const questions = listQuestionsInLesson(lesson)
  const idFields = lesson.settings.identityFields
  const unsubmittedCount = records.filter((r) => !r.submittedAt).length

  if (records.length === 0) return <p className="text-sm text-neutral-400">아직 응답이 없어요</p>

  const shown = onlyUnsubmitted ? records.filter((r) => !r.submittedAt) : records
  const detail = records.find((r) => r.studentKey === detailKey)

  return (
    <>
      {/* 수업 중에 교사가 가장 자주 하는 질문이 "누가 아직 안 냈나"라서 바로 거를 수 있게 한다 */}
      <label className="mb-2 flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" checked={onlyUnsubmitted} onChange={(e) => setOnlyUnsubmitted(e.target.checked)} />
        아직 제출하지 않은 학생만 보기 ({unsubmittedCount}명)
      </label>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              {idFields.map((f) => (
                <th key={f} className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">
                  {IDENTITY_LABELS[f]}
                </th>
              ))}
              <th className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">진행</th>
              <th className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">총점</th>
              {questions.map((q, i) => (
                <th key={q.id} className="whitespace-nowrap border border-neutral-200 bg-neutral-50 p-1.5 text-left">
                  Q{i + 1}
                </th>
              ))}
              {onDeleteResponse && <th className="border border-neutral-200 bg-neutral-50 p-1.5" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const total = Object.values(r.scores).reduce((sum, s) => sum + s.points, 0)
              // 제출 여부만으론 "어디까지 갔나"를 알 수 없어, 답한 문항 수를 같이 센다.
              // 진행 중인 학생이 3번에서 막혔는지 거의 다 왔는지가 수업 중엔 중요한 정보다.
              const answered = questions.filter((q) => isQuestionAnswered(q, r.answers[q.id])).length
              const ratio = questions.length > 0 ? answered / questions.length : 0
              return (
                <tr
                  key={r.studentKey}
                  onClick={() => setDetailKey(r.studentKey)}
                  className="cursor-pointer hover:bg-neutral-50"
                  tabIndex={0}
                  role="button"
                  aria-label={`${studentLabel(r, idFields)} 답안 자세히 보기`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetailKey(r.studentKey)
                    }
                  }}
                >
                  {idFields.map((f) => (
                    <td key={f} className="whitespace-nowrap border border-neutral-200 p-1.5">
                      {r.identity[f] ?? ''}
                    </td>
                  ))}
                  <td className="whitespace-nowrap border border-neutral-200 p-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-200">
                        <div className="h-full rounded-full bg-accent-500" style={{ width: `${ratio * 100}%` }} />
                      </div>
                      <span className="text-xs text-neutral-500">
                        {answered}/{questions.length}
                      </span>
                      {r.submittedAt && <span className="text-xs text-success">제출</span>}
                    </div>
                  </td>
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
                  {onDeleteResponse && (
                    <td className="border border-neutral-200 p-1.5">
                      {/* 행 클릭(상세 보기)과 겹치지 않게 이벤트를 여기서 끊는다 */}
                      <Button
                        variant="danger"
                        size="sm"
                        iconOnly
                        aria-label={`${studentLabel(r, idFields)} 응답 삭제`}
                        disabled={deletingKey === r.studentKey}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(r)
                        }}
                      >
                        <Icon icon={Trash2} />
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="mt-2 text-sm text-neutral-400">모두 제출했어요</p>}
      <p className="mt-2 text-xs text-neutral-400">행을 누르면 그 학생의 답안을 문항 지문과 함께 펼쳐 볼 수 있어요.</p>

      {detail && <StudentDetail lesson={lesson} record={detail} onClose={() => setDetailKey(null)} />}
    </>
  )
}
