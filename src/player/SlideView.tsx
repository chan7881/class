import { isQuestionAnswered } from '../blocks/questions/registry'
import { getBlockDefinition } from '../blocks/registry'
import { QuestionBlockViewer } from '../blocks/QuestionBlockView'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { ClassAggregate } from './ClassAggregate'
import type { GradeResult } from '../lib/grade'
import type { FeedbackMode, Slide } from '../types/lesson'

interface SlideViewProps {
  slide: Slide
  answers: Record<string, unknown>
  onAnswerChange: (questionId: string, value: unknown) => void
  feedback: Record<string, GradeResult | null | undefined>
  defaultFeedbackMode: FeedbackMode
  disabled?: boolean
  invalidQuestionIds: Set<string>
  /** POE 예측처럼 lockAfterSubmit인 문항 중 학생이 이미 잠근 것들 (docs/PLAN.md 9번 항목) */
  lockedQuestionIds: Set<string>
  onLockQuestion: (questionId: string) => void
}

function FeedbackBanner({ result, explanation }: { result: GradeResult; explanation?: string }) {
  return (
    <div className={`mt-2 rounded-lg border p-2 text-sm ${result.correct ? 'border-success bg-green-50 text-green-800' : 'border-danger bg-red-50 text-red-800'}`}>
      {result.correct ? '✓ 정답입니다' : '✗ 오답입니다'}
      {explanation && <p className="mt-1 text-neutral-600">{explanation}</p>}
    </div>
  )
}

export function SlideView({ slide, answers, onAnswerChange, feedback, defaultFeedbackMode, disabled, invalidQuestionIds, lockedQuestionIds, onLockQuestion }: SlideViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {slide.blocks.map((block) => {
        if (block.type === 'question') {
          const q = block.q
          const mode = q.feedbackOverride ?? defaultFeedbackMode
          const result = feedback[q.id]
          const showFeedback = mode === 'immediate' && result != null
          const isInvalid = invalidQuestionIds.has(q.id)
          const isLocked = lockedQuestionIds.has(q.id)
          const canLock = q.lockAfterSubmit && !isLocked && isQuestionAnswered(q, answers[q.id])

          return (
            <div
              key={block.id}
              id={`question-${q.id}`}
              className={`rounded-lg p-2 transition-shadow ${isInvalid ? 'ring-2 ring-danger' : ''}`}
            >
              <div className="mb-2 flex items-start gap-1 text-base leading-[1.7]">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.prompt) }} />
                {q.required && (
                  <span className="mt-1 shrink-0 text-xs font-medium text-danger" aria-label="필수 문항">
                    *
                  </span>
                )}
              </div>
              <QuestionBlockViewer block={block} value={answers[q.id]} onChange={(value) => onAnswerChange(q.id, value)} disabled={disabled || isLocked} />
              {isLocked && (
                <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
                  🔒 예측은 한 번 제출하면 수정할 수 없어요
                </p>
              )}
              {canLock && (
                <button
                  type="button"
                  onClick={() => onLockQuestion(q.id)}
                  className="tap-target mt-1 rounded border border-neutral-300 px-2 text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  🔒 예측 제출하기 (제출 후 수정 불가)
                </button>
              )}
              {showFeedback && <FeedbackBanner result={result} explanation={q.explanation} />}
              {isInvalid && <p className="mt-1 text-sm text-danger">답을 입력해야 다음으로 넘어갈 수 있어요</p>}
              {q.shareClassResponses && isQuestionAnswered(q, answers[q.id]) && <ClassAggregate questionId={q.id} />}
            </div>
          )
        }

        const def = getBlockDefinition(block.type)
        return def ? <def.Viewer key={block.id} block={block} /> : null
      })}
    </div>
  )
}
