import type { ReactNode } from 'react'
import { RichTextEditor } from '../../richtext/RichTextEditor'
import type { Question } from '../../types/lesson'

interface QuestionEditorShellProps<Q extends Question> {
  question: Q
  onChange: (next: Q) => void
  children: ReactNode
}

/** 6종 문항 에디터가 공통으로 두르는 틀 — 문항 지문·필수여부·배점·해설. 유형별 본문은 children으로 들어온다. */
export function QuestionEditorShell<Q extends Question>({ question, onChange, children }: QuestionEditorShellProps<Q>) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <RichTextEditor html={question.prompt} onChange={(prompt) => onChange({ ...question, prompt })} placeholder="문항을 입력하세요" />

      <div className="mt-3">{children}</div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-2 text-sm text-neutral-500">
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
      </div>

      <textarea
        value={question.explanation ?? ''}
        onChange={(e) => onChange({ ...question, explanation: e.target.value || undefined })}
        placeholder="해설 (선택 — 정오답 공개 시 함께 보여줌)"
        rows={2}
        className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm text-neutral-600 outline-none focus:border-accent-500"
      />
    </div>
  )
}
