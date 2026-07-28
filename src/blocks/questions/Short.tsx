import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { normalizeAnswerText } from '../../lib/textNormalize'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { ShortQuestion } from '../../types/lesson'

function Editor({ question, onChange }: QuestionEditorProps<ShortQuestion>) {
  const answerText = (question.answer ?? []).join('\n')

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          입력칸 줄 수
          <input
            type="number"
            min={1}
            max={10}
            value={question.rows}
            onChange={(e) => onChange({ ...question, rows: Math.max(1, Number(e.target.value)) })}
            className="tap-target w-14 rounded border border-neutral-300 px-1 text-center"
          />
        </label>
        <label className="flex items-center gap-1">
          채점 방식
          <select
            value={question.matchMode ?? 'exact'}
            onChange={(e) => onChange({ ...question, matchMode: e.target.value as ShortQuestion['matchMode'] })}
            className="tap-target rounded border border-neutral-300 px-1"
          >
            <option value="exact">정확히 일치</option>
            <option value="contains">키워드 포함</option>
          </select>
        </label>
      </div>
      <textarea
        value={answerText}
        onChange={(e) => onChange({ ...question, answer: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
        placeholder={'정답으로 인정할 답을 한 줄에 하나씩 (자동채점 없이 서답형만 쓰려면 비워두세요)'}
        rows={2}
        className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-accent-500"
      />
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<ShortQuestion>) {
  return (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={question.rows}
      placeholder="답을 입력하세요"
      className="tap-target w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-accent-500 disabled:bg-neutral-50"
    />
  )
}

registerQuestion<ShortQuestion>({
  kind: 'short',
  label: '서답형',
  icon: '📄',
  createDefault: (id) => ({ id, kind: 'short', prompt: '', required: true, points: 10, rows: 2, matchMode: 'exact' }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const given = normalizeAnswerText(typeof value === 'string' ? value : '')
    const answers = (question.answer ?? []).map(normalizeAnswerText)
    const correct =
      answers.length > 0 &&
      given.length > 0 &&
      (question.matchMode === 'contains' ? answers.some((a) => given.includes(a)) : answers.includes(given))
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (_question, value) => typeof value === 'string' && value.trim().length > 0,
})
