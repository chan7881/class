import { CircleCheck, CircleX, Minus } from 'lucide-react'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { listQuestionsInLesson } from '../lib/findQuestion'
import { cellForAnswer } from '../lib/resultsStats'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { ResponseRecord } from '../api/types'
import type { IdentityField, Lesson } from '../types/lesson'

export function studentLabel(record: ResponseRecord, idFields: IdentityField[]): string {
  const parts = idFields.map((f) => record.identity[f]).filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : '(이름 없음)'
}

/**
 * 학생 한 명의 답안을 문항 지문과 나란히 펼쳐 보여준다.
 *
 * 왜 필요한가: 학생별 표는 한 칸이 한 문항이라 서답형처럼 긴 답이 잘려서(`truncate`) 정작
 * 읽어야 할 탐구 서술을 못 읽는다. 게다가 표에는 문항 번호(Q3)만 있어 무슨 질문이었는지
 * 기억해가며 봐야 한다. 이 화면은 "지문 → 그 학생의 답"을 한 쌍으로 붙여 그 두 문제를 없앤다.
 */
export function StudentDetail({ lesson, record, onClose }: { lesson: Lesson; record: ResponseRecord; onClose: () => void }) {
  const questions = listQuestionsInLesson(lesson)
  const idFields = lesson.settings.identityFields
  const total = Object.values(record.scores).reduce((sum, s) => sum + s.points, 0)
  const maxTotal = questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-label="답안 창 닫기" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="학생 답안"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border border-neutral-200 bg-neutral-0 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:w-[40rem] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-lg font-semibold">{studentLabel(record, idFields)}</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {record.submittedAt ? `제출 완료 · ${new Date(record.submittedAt).toLocaleString()}` : '아직 제출하지 않음(진행 중)'} · 총점 {total}/
            {maxTotal}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {questions.length === 0 ? (
            <p className="text-sm text-neutral-400">문항이 없어요</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {questions.map((q, i) => {
                const value = record.answers[q.id]
                const score = record.scores[q.id]
                // 채점 결과가 없는 건 "틀렸다"가 아니라 "자동 채점 대상이 아니다"라는 뜻이다
                // (서답형 채점 안 함·사진·그리기·데이터표). 색과 아이콘을 중립으로 둔다.
                const icon = score === undefined ? Minus : score.correct ? CircleCheck : CircleX
                const tone = score === undefined ? 'text-neutral-400' : score.correct ? 'text-success' : 'text-danger'
                const label = score === undefined ? '채점 안 함' : score.correct ? '정답' : score.partial ? '부분 정답' : '오답'
                return (
                  <li key={q.id}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-sm font-medium text-neutral-400">Q{i + 1}</span>
                      <div
                        className="min-w-0 flex-1 text-sm font-medium"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.prompt) || '(지문 없음)' }}
                      />
                    </div>
                    <div className="mt-1 ml-8 rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <Icon icon={icon} className={tone} />
                        <span className={tone}>{label}</span>
                        {score !== undefined && <span>· {score.points}점</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                        {value === undefined ? <span className="text-neutral-400">무응답</span> : cellForAnswer(q, value)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="flex justify-end border-t border-neutral-200 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </>
  )
}
