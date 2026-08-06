import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Icon } from '../components/Icon'
import { Accordion } from '../components/Accordion'
import { PageTitle } from '../components/PageTitle'
import { gradeTone } from '../lib/gradeStyle'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { GradeResult } from '../lib/grade'
import type { Lesson } from '../types/lesson'

export interface SummaryQuestionResult {
  questionId: string
  prompt: string
  /** null이면 채점하지 않은 문항이다(서답형 '채점 안함') — 정오답 표시 없이 답안만 보여준다 */
  result: GradeResult | null
  explanation?: string
  /** 학생이 제출한 답을 사람이 읽을 수 있는 형태로 바꾼 값 — 아코디언에 펼쳐 보여준다 */
  answerText: string
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
  /** 공용 기기 정리 — 이 기기에 남은 진행상황·식별정보를 지운다. 생략하면(교사 미리보기) 버튼만 표시된다 */
  onClearDevice?: () => void
}

export function SummaryView({ lesson, totalPoints, maxPoints, results, poePairs = [], onClearDevice: onClear }: SummaryViewProps) {
  const [cleared, setCleared] = useState(false)

  function onClearDevice() {
    onClear?.()
    setCleared(true)
  }

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
            <p className="text-4xl font-bold text-accent-ink">
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
            // result가 null이면 채점 자체를 안 한 문항(서답형 '채점 안함')이라 정오답 색·아이콘
            // 없이 중립적인 카드로 답만 보여준다.
            const style = r.result ? gradeTone(r.result) : null
            return (
              <div
                key={r.questionId}
                className={`rounded-lg border p-3 text-sm ${style ? style.className : 'border-neutral-200 bg-neutral-0 text-neutral-700'}`}
              >
                <div className="mb-1 font-medium" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.prompt) }} />
                {style && (
                  <p className="flex items-center gap-1.5 font-medium">
                    <Icon icon={style.icon} />
                    {style.label}
                    {style.note && <span className="font-normal">({style.note})</span>}
                  </p>
                )}
                {r.explanation && <p className="mt-1 text-neutral-600">{r.explanation}</p>}
                <Accordion title="내 답안 보기">
                  <p className="whitespace-pre-wrap text-neutral-700">{r.answerText || '(답변 없음)'}</p>
                </Accordion>
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

      {/*
        학교에서는 태블릿·크롬북을 반끼리 돌려 쓰는 경우가 많다. 이 앱은 새로고침 대비로
        진행상황을 그 기기의 localStorage에 남기는데(lib/playerProgress.ts), 제출까지 마쳤으면
        더 남아 있을 이유가 없고 다음 사용자가 이어받을 수도 있다. 제출 시점에 이미
        clearLocalProgress를 부르지만, 학생이 직접 확인하고 지울 수 있는 버튼을 같이 둔다.
      */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
        <p className="flex items-center gap-1.5 font-medium">
          <Icon icon={ShieldCheck} className="text-neutral-400" />
          공용 기기를 쓰고 있나요?
        </p>
        <p className="mt-1">
          이 기기에 남은 내 이름·답안 기록을 지우고 나가세요. 지운 뒤에도 제출한 답안은 선생님께 그대로 전달됩니다.
        </p>
        <button
          type="button"
          onClick={onClearDevice}
          disabled={cleared}
          className="tap-target mt-2 rounded border border-neutral-300 bg-neutral-0 px-3 text-sm disabled:text-neutral-400"
        >
          {cleared ? '지웠습니다' : '이 기기에서 내 기록 지우기'}
        </button>
      </div>
    </div>
  )
}
