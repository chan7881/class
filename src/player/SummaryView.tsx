import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { GradeResult } from '../lib/grade'
import type { Lesson } from '../types/lesson'

export interface SummaryQuestionResult {
  questionId: string
  prompt: string
  result: GradeResult
  explanation?: string
}

interface SummaryViewProps {
  lesson: Lesson
  /** null이면 점수 자체를 보여주지 않는다 (feedbackMode:'never'인 문항만 있는 경우 등) */
  totalPoints: number | null
  maxPoints: number
  /** feedbackMode:'onFinish'로 지금 처음 공개하는 문항들 */
  results: SummaryQuestionResult[]
}

export function SummaryView({ lesson, totalPoints, maxPoints, results }: SummaryViewProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <div className="text-center">
        <div className="text-4xl">🎉</div>
        <h1 className="mt-2 text-xl font-semibold">제출 완료!</h1>
        <p className="mt-1 text-neutral-500">{lesson.title} 수업에 참여해주셔서 감사합니다.</p>
        {totalPoints !== null && (
          <p className="mt-3 text-lg font-medium">
            점수: <span className="text-accent-500">{totalPoints}</span> / {maxPoints}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.questionId} className={`rounded-lg border p-3 text-sm ${r.result.correct ? 'border-success bg-green-50' : 'border-danger bg-red-50'}`}>
              <div className="mb-1 font-medium" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.prompt) }} />
              <p>{r.result.correct ? '✓ 정답' : '✗ 오답'}</p>
              {r.explanation && <p className="mt-1 text-neutral-600">{r.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
