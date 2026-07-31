import { isQuestionAnswered } from '../blocks/questions/registry'
import { getBlockDefinition } from '../blocks/registry'
import { QuestionBlockViewer } from '../blocks/QuestionBlockView'
import { Icon } from '../components/Icon'
import { describeCorrectAnswer } from '../lib/answerPreview'
import { groupBlocksIntoRows } from '../lib/blockLayout'
import { gradeTone } from '../lib/gradeStyle'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { ClassAggregate } from './ClassAggregate'
import type { GradeResult } from '../lib/grade'
import type { Block, FeedbackMode, Slide } from '../types/lesson'

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
  /** 테스트 모드 "정답 보기" 토글이 켜져 있을 때만 문항마다 정답을 보여준다 */
  showAnswers?: boolean
}

function FeedbackBanner({ result, explanation }: { result: GradeResult; explanation?: string }) {
  // 색·아이콘·라벨은 gradeStyle이 정한다 — 제출 요약 화면(SummaryView)과 같은 규칙을 쓰기 위함
  const style = gradeTone(result)
  return (
    <div className={`mt-2 rounded-lg border p-2 text-sm ${style.className}`}>
      <p className="flex items-center gap-1.5 font-medium">
        <Icon icon={style.icon} />
        {style.label}
        {style.note && <span className="font-normal">({style.note})</span>}
      </p>
      {explanation && <p className="mt-1 text-neutral-600">{explanation}</p>}
    </div>
  )
}

export function SlideView({
  slide,
  answers,
  onAnswerChange,
  feedback,
  defaultFeedbackMode,
  disabled,
  invalidQuestionIds,
  lockedQuestionIds,
  onLockQuestion,
  showAnswers,
}: SlideViewProps) {
  function renderBlock(block: Block) {
        if (block.type === 'question') {
          const q = block.q
          const mode = q.feedbackOverride ?? defaultFeedbackMode
          const result = feedback[q.id]
          // onSlideLeave는 즉시 채점하지 않고 Player가 "다음"을 누른 시점에만 feedback을 채워
          // 넣는다 — 그 시점 전까지는 result가 null이라 자연히 안 보이고, 채워지는 순간부터는
          // immediate와 같은 배너로 보여준다.
          const showFeedback = (mode === 'immediate' || mode === 'onSlideLeave') && result != null
          const isInvalid = invalidQuestionIds.has(q.id)
          const isLocked = lockedQuestionIds.has(q.id)
          const canLock = q.lockAfterSubmit && !isLocked && isQuestionAnswered(q, answers[q.id])
          const correctAnswerText = showAnswers ? describeCorrectAnswer(q) : null

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
                  예측은 한 번 제출하면 수정할 수 없어요
                </p>
              )}
              {canLock && (
                <button
                  type="button"
                  onClick={() => onLockQuestion(q.id)}
                  className="tap-target mt-1 rounded border border-neutral-300 px-2 text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  예측 제출하기 (제출 후 수정 불가)
                </button>
              )}
              {showFeedback && <FeedbackBanner result={result} explanation={q.explanation} />}
              {correctAnswerText && (
                <p className="mt-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-sm text-neutral-600">정답: {correctAnswerText}</p>
              )}
              {isInvalid && (
                <p className="mt-1 text-sm text-danger">
                  {q.kind === 'order'
                    ? '항목을 한 번 이상 옮겨야 답으로 인정돼요 — 순서가 이미 맞아 보여도 한 번 옮겼다 되돌려 보세요'
                    : '답을 입력해야 다음으로 넘어갈 수 있어요'}
                </p>
              )}
              {q.shareClassResponses && isQuestionAnswered(q, answers[q.id]) && <ClassAggregate question={q} />}
            </div>
          )
        }

    const def = getBlockDefinition(block.type)
    return def ? <def.Viewer key={block.id} block={block} /> : null
  }

  const rows = groupBlocksIntoRows(slide.blocks)

  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => (
        <div key={row.map((b) => b.id).join('-')} className={row.length === 2 ? 'flex flex-col gap-5 sm:flex-row sm:gap-4' : undefined}>
          {row.map((block) => (
            <div key={block.id} className={row.length === 2 ? 'sm:min-w-0 sm:flex-1' : undefined}>
              {renderBlock(block)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
