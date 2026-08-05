import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { ComboQuestion } from '../../types/lesson'

const KOREAN_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ']

function korLabel(i: number): string {
  return KOREAN_LABELS[i] ?? String(i + 1)
}

function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** 체크한 진술 조합을 "ㄱ, ㄴ" 형태로 만든다. 아무것도 안 골랐으면 "모두 옳지 않음". */
function comboLabel(statements: ComboQuestion['statements'], set: string[]): string {
  if (set.length === 0) return '모두 옳지 않음'
  return set
    .map((id) => statements.findIndex((s) => s.id === id))
    .filter((idx) => idx !== -1)
    .sort((a, b) => a - b)
    .map((idx) => korLabel(idx))
    .join(', ')
}

function Editor({ question, onChange }: QuestionEditorProps<ComboQuestion>) {
  function addStatement() {
    onChange({ ...question, statements: [...question.statements, { id: shortId(), label: '' }] })
  }
  function updateStatement(id: string, label: string) {
    onChange({ ...question, statements: question.statements.map((s) => (s.id === id ? { ...s, label } : s)) })
  }
  function removeStatement(id: string) {
    const statements = question.statements.filter((s) => s.id !== id)
    onChange({
      ...question,
      statements,
      options: question.options.map((o) => {
        const set = o.set.filter((s) => s !== id)
        return { ...o, set, label: comboLabel(statements, set) }
      }),
    })
  }

  function addOption() {
    onChange({ ...question, options: [...question.options, { id: shortId(), label: comboLabel(question.statements, []), set: [] }] })
  }
  function toggleOptionStatement(optId: string, stId: string) {
    onChange({
      ...question,
      options: question.options.map((o) => {
        if (o.id !== optId) return o
        const nextSet = o.set.includes(stId) ? o.set.filter((s) => s !== stId) : [...o.set, stId]
        return { ...o, set: nextSet, label: comboLabel(question.statements, nextSet) }
      }),
    })
  }
  function removeOption(id: string) {
    onChange({
      ...question,
      options: question.options.filter((o) => o.id !== id),
      answer: question.answer === id ? undefined : question.answer,
    })
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <p className="text-sm font-medium text-neutral-600">진술</p>
      <ul className="mt-1 flex flex-col gap-1">
        {question.statements.map((st, i) => (
          <li key={st.id} className="flex items-center gap-2">
            <span className="w-6 text-sm text-neutral-400">{korLabel(i)}</span>
            <input
              value={st.label}
              onChange={(e) => updateStatement(st.id, e.target.value)}
              placeholder="진술 내용"
              className="tap-target flex-1 rounded border border-neutral-300 px-2 text-sm"
            />
            <button type="button" onClick={() => removeStatement(st.id)} className="tap-target text-neutral-400 hover:text-danger" aria-label="진술 삭제">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addStatement} className="tap-target mt-1 px-2 text-sm text-accent-500">
        + 진술 추가
      </button>

      <p className="mt-3 text-sm font-medium text-neutral-600">보기 (정답 조합)</p>
      <ul className="mt-1 flex flex-col gap-2">
        {question.options.map((opt, i) => (
          <li key={opt.id} className="rounded border border-neutral-200 p-2">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                checked={question.answer === opt.id}
                onChange={() => onChange({ ...question, answer: opt.id })}
                aria-label="이 보기를 정답으로 표시"
              />
              <span className="text-sm text-neutral-400">{i + 1}번</span>
              <span className="flex-1 text-sm">{opt.label}</span>
              <button type="button" onClick={() => removeOption(opt.id)} className="tap-target text-neutral-400 hover:text-danger" aria-label="보기 삭제">
                ✕
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 pl-6">
              {question.statements.map((st, si) => (
                <label key={st.id} className="flex items-center gap-1 text-xs text-neutral-500">
                  <input type="checkbox" checked={opt.set.includes(st.id)} onChange={() => toggleOptionStatement(opt.id, st.id)} />
                  {korLabel(si)}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addOption} className="tap-target mt-1 px-2 text-sm text-accent-500">
        + 보기 추가
      </button>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<ComboQuestion>) {
  return (
    <div>
      <ul className="mb-2 flex flex-col gap-1 text-sm text-neutral-700">
        {question.statements.map((st, i) => (
          <li key={st.id}>
            {korLabel(i)}. {st.label}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2">
        {question.options.map((opt, i) => (
          <li key={opt.id}>
            <label className={`tap-target flex items-center gap-2 rounded-lg border p-2 ${value === opt.id ? 'border-accent-500 bg-accent-50' : 'border-neutral-200'}`}>
              <input type="radio" checked={value === opt.id} disabled={disabled} onChange={() => onChange(opt.id)} />
              <span>
                {i + 1}. {opt.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

registerQuestion<ComboQuestion>({
  kind: 'combo',
  label: '합답형',
  createDefault: (id) => ({
    id,
    kind: 'combo',
    prompt: '',
    required: true,
    points: 10,
    statements: [
      { id: shortId(), label: '' },
      { id: shortId(), label: '' },
    ],
    options: [],
  }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const correct = typeof value === 'string' && value.length > 0 && value === question.answer
    return { correct, points: correct ? question.points : 0 }
  },
  hasFixedOptions: true,
  isAnswered: (_question, value) => typeof value === 'string' && value.length > 0,
  toCell: (question, value) => (typeof value === 'string' ? (question.options.find((o) => o.id === value)?.label ?? value) : ''),
  describeAnswer: (question) => {
    if (!question.answer) return null
    const opt = question.options.find((o) => o.id === question.answer)
    return opt ? opt.label : question.answer
  },
})
