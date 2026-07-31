import { Icon } from '../components/Icon'
import { PageTitle } from '../components/PageTitle'
import { gradeTone } from '../lib/gradeStyle'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { GradeResult } from '../lib/grade'
import type { Lesson } from '../types/lesson'

export interface SummaryQuestionResult {
  questionId: string
  prompt: string
  result: GradeResult
  explanation?: string
}

export interface PoePair {
  predictPrompt: string
  predictAnswer: string
  explainPrompt: string
  explainAnswer: string
}

interface SummaryViewProps {
  lesson: Lesson
  /** null이면 점수 자체를 보여주지 않는다 (feedbackMode:'never'인 문항만 있는 경우 등) */
  totalPoints: number | null
  maxPoints: number
  /** feedbackMode:'onFinish'로 지금 처음 공개하는 문항들 */
  results: SummaryQuestionResult[]
  /** POE(예측-관찰-설명) 그룹마다 내 예측과 내 설명을 나란히 보여준다 (docs/PLAN.md 9번 항목) */
  poePairs?: PoePair[]
}

export function SummaryView({ lesson, totalPoints, maxPoints, results, poePairs = [] }: SummaryViewProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <div className="text-center">
        <PageTitle>제출 완료!</PageTitle>
        <p className="mt-1 text-neutral-500">{lesson.title} 수업에 참여해주셔서 감사합니다.</p>
        {totalPoints !== null && (
          <div className="mt-4">
            {/*
              점수는 값이 하나뿐인 헤드라인 숫자라 도넛·파이 같은 차트를 쓰지 않는다 —
              숫자를 크게 보여주고 만점 대비 비율만 얇은 막대로 거든다.
            */}
            <p className="text-4xl font-bold text-accent-500">
              {totalPoints}
              <span className="text-xl font-medium text-neutral-400"> / {maxPoints}</span>
            </p>
            {maxPoints > 0 && (
              <div
                className="mx-auto mt-2 h-2 w-40 overflow-hidden rounded-full bg-neutral-200"
                role="img"
                aria-label={`만점 ${maxPoints}점 중 ${totalPoints}점`}
              >
                <div
                  className="h-full rounded-full bg-accent-500"
                  style={{ width: `${Math.max(0, Math.min(100, (totalPoints / maxPoints) * 100))}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {results.map((r) => {
            // 예전엔 correct만 보고 초록/빨강으로 갈라서, 절반 점수를 받은 문항이 총점에는
            // 반영돼 있는데 카드에는 그냥 "오답"으로 보였다 — 진행 중 배너와 같은 규칙을 쓴다.
            const style = gradeTone(r.result)
            return (
              <div key={r.questionId} className={`rounded-lg border p-3 text-sm ${style.className}`}>
                <div className="mb-1 font-medium" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.prompt) }} />
                <p className="flex items-center gap-1.5 font-medium">
                  <Icon icon={style.icon} />
                  {style.label}
                  {style.note && <span className="font-normal">({style.note})</span>}
                </p>
                {r.explanation && <p className="mt-1 text-neutral-600">{r.explanation}</p>}
              </div>
            )
          })}
        </div>
      )}

      {poePairs.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-500">내 예측 vs 내 설명</p>
          {poePairs.map((p, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-3 text-sm">
              <div className="mb-2">
                <div className="text-xs font-medium text-neutral-400" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.predictPrompt) }} />
                <p className="mt-0.5 rounded bg-neutral-50 p-2">{p.predictAnswer}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-neutral-400" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.explainPrompt) }} />
                <p className="mt-0.5 rounded bg-neutral-50 p-2">{p.explainAnswer}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
