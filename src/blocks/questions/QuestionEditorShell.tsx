import type { ReactNode } from 'react'
import { Accordion } from '../../components/Accordion'
import { CommaListInput } from '../../components/CommaListInput'
import { RichTextEditor } from '../../richtext/RichTextEditor'
import type { FeedbackMode, Question } from '../../types/lesson'

interface QuestionEditorShellProps<Q extends Question> {
  question: Q
  onChange: (next: Q) => void
  children: ReactNode
}

const FEEDBACK_LABELS: Record<string, string> = {
  immediate: '즉시',
  onSlideLeave: '슬라이드를 넘길 때',
  onFinish: '제출 후',
  never: '공개 안 함',
}

/**
 * 접힌 상태에서도 지금 설정이 어떤지 한눈에 읽히도록, 아코디언 제목에 요약을 넣는다.
 * (열어보지 않으면 알 수 없으면 접는 의미가 반감된다)
 */
function settingsSummary(question: Question): string {
  const parts: string[] = []
  parts.push(question.required ? '필수' : '선택')
  parts.push(`${question.points}점`)
  if (question.feedbackOverride) parts.push(`정오답 ${FEEDBACK_LABELS[question.feedbackOverride] ?? question.feedbackOverride}`)
  if (question.lockAfterSubmit) parts.push('제출 후 잠금')
  if (question.shareClassResponses) parts.push('분포 공유')
  if (question.explanation?.trim()) parts.push('해설 있음')
  if (question.standardsTags?.length) parts.push(`태그 ${question.standardsTags.length}`)
  return parts.join(' · ')
}

/**
 * 문항 에디터가 공통으로 두르는 틀 — 지문·유형별 본문은 항상 보이고, 그 밖의 설정
 * (필수·배점·정오답 공개·해설·성취기준 태그)은 접어 둔다.
 *
 * 왜 접나: 이 설정들이 문항마다 늘 펼쳐져 있으면 문항이 대여섯 개만 돼도 슬라이드 하나가
 * 화면 몇 개 길이가 되어, 정작 자주 고치는 지문·보기가 서로 멀어진다. 대부분의 문항은
 * 이 설정을 기본값 그대로 쓰므로 평소에는 접어두고 요약만 보여주는 편이 낫다.
 */
export function QuestionEditorShell<Q extends Question>({ question, onChange, children }: QuestionEditorShellProps<Q>) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <RichTextEditor html={question.prompt} onChange={(prompt) => onChange({ ...question, prompt })} placeholder="문항을 입력하세요" />

      <div className="mt-3">{children}</div>

      <Accordion title={`세부 설정 — ${settingsSummary(question)}`}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={question.required} onChange={(e) => onChange({ ...question, required: e.target.checked })} />
          필수(답해야 다음으로)
        </label>
        <label className="flex items-center gap-1">
          배점
          <input
            type="number"
            min={0}
            value={question.points}
            onChange={(e) => onChange({ ...question, points: Number(e.target.value) })}
            className="tap-target w-16 rounded border border-neutral-300 px-1 text-center"
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={!!question.lockAfterSubmit}
            onChange={(e) => onChange({ ...question, lockAfterSubmit: e.target.checked || undefined })}
          />
          제출 후 잠금 (POE 예측용)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={!!question.shareClassResponses}
            onChange={(e) => onChange({ ...question, shareClassResponses: e.target.checked || undefined })}
          />
          학급 응답 분포 공유
        </label>
        <label className="flex items-center gap-1">
          정오답 공개
          <select
            value={question.feedbackOverride ?? ''}
            onChange={(e) => onChange({ ...question, feedbackOverride: (e.target.value || undefined) as FeedbackMode | undefined })}
            className="tap-target rounded border border-neutral-300 px-1"
          >
            <option value="">(수업 기본값)</option>
            <option value="immediate">즉시</option>
            <option value="onSlideLeave">슬라이드를 넘길 때</option>
            <option value="onFinish">제출 후</option>
            <option value="never">공개 안 함</option>
          </select>
        </label>
      </div>

      <textarea
        value={question.explanation ?? ''}
        onChange={(e) => onChange({ ...question, explanation: e.target.value || undefined })}
        placeholder="해설 (선택 — 정오답 공개 시 함께 보여줌)"
        rows={2}
        className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-600 outline-none focus:border-accent-500"
      />

      <label className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
        성취기준 태그
        <CommaListInput
          value={question.standardsTags ?? []}
          onChange={(tags) => onChange({ ...question, standardsTags: tags.length ? tags : undefined })}
          placeholder="예: 9과15-01, 9과15-02 (쉼표로 구분, 선택)"
          className="tap-target flex-1 rounded border border-neutral-200 px-2 text-sm text-neutral-600 outline-none focus:border-accent-500"
        />
      </label>
      </Accordion>
    </div>
  )
}
