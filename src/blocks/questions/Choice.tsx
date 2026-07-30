import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { ChoiceOption, ChoiceQuestion } from '../../types/lesson'

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((x) => setB.has(x))
}

function newOptionId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function Editor({ question, onChange }: QuestionEditorProps<ChoiceQuestion>) {
  function updateOption(id: string, patch: Partial<ChoiceOption>) {
    onChange({ ...question, options: question.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) })
  }

  function addOption() {
    const id = newOptionId()
    onChange({ ...question, options: [...question.options, { id, label: '' }] })
  }

  function removeOption(id: string) {
    onChange({ ...question, options: question.options.filter((o) => o.id !== id), answer: (question.answer ?? []).filter((a) => a !== id) })
  }

  function toggleAnswer(id: string) {
    const current = question.answer ?? []
    if (question.multiple) {
      onChange({ ...question, answer: current.includes(id) ? current.filter((a) => a !== id) : [...current, id] })
    } else {
      onChange({ ...question, answer: current.includes(id) ? [] : [id] })
    }
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <label className="mb-2 flex items-center gap-1 text-sm text-neutral-500">
        <input type="checkbox" checked={question.multiple} onChange={(e) => onChange({ ...question, multiple: e.target.checked })} />
        복수 선택 허용
      </label>
      <ul className="flex flex-col gap-1">
        {question.options.map((opt) => (
          <li key={opt.id} className="flex items-center gap-2">
            <input
              type={question.multiple ? 'checkbox' : 'radio'}
              checked={(question.answer ?? []).includes(opt.id)}
              onChange={() => toggleAnswer(opt.id)}
              aria-label={`${opt.label || '보기'}를 정답으로 표시`}
            />
            <input
              value={opt.label}
              onChange={(e) => updateOption(opt.id, { label: e.target.value })}
              placeholder="보기 내용"
              className="tap-target flex-1 rounded border border-neutral-300 px-2 text-sm"
            />
            <button type="button" onClick={() => removeOption(opt.id)} className="tap-target text-neutral-400 hover:text-danger" aria-label="보기 삭제">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addOption} className="tap-target mt-1 px-2 text-sm text-accent-500">
        + 보기 추가
      </button>
      {(question.answer ?? []).length === 0 && question.options.some((o) => o.label.trim()) && (
        <p className="mt-1 text-sm text-warn">정답을 하나도 안 골랐어요 — 이대로면 학생이 뭘 골라도 오답 처리돼요.</p>
      )}
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<ChoiceQuestion>) {
  const selected = Array.isArray(value) ? (value as string[]) : []

  function toggle(id: string) {
    if (disabled) return
    if (question.multiple) {
      onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id])
    } else {
      onChange([id])
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {question.options.map((opt) => (
        <li key={opt.id}>
          <label className={`tap-target flex items-center gap-2 rounded-lg border p-2 ${selected.includes(opt.id) ? 'border-accent-500 bg-accent-50' : 'border-neutral-200'}`}>
            <input type={question.multiple ? 'checkbox' : 'radio'} checked={selected.includes(opt.id)} onChange={() => toggle(opt.id)} disabled={disabled} />
            <span>{opt.label}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

registerQuestion<ChoiceQuestion>({
  kind: 'choice',
  label: '선택형',
  createDefault: (id) => ({
    id,
    kind: 'choice',
    prompt: '',
    required: true,
    points: 10,
    multiple: false,
    options: [
      { id: newOptionId(), label: '' },
      { id: newOptionId(), label: '' },
    ],
    answer: [],
  }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const given = Array.isArray(value) ? (value as string[]) : []
    const correct = sameSet(given, question.answer ?? [])
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (_question, value) => Array.isArray(value) && value.length > 0,
  toCell: (question, value) => {
    const given = Array.isArray(value) ? (value as string[]) : []
    return given.map((id) => question.options.find((o) => o.id === id)?.label ?? id).join(', ')
  },
  describeAnswer: (question) => {
    const ids = question.answer ?? []
    if (ids.length === 0) return null
    return ids.map((id) => question.options.find((o) => o.id === id)?.label ?? id).join(', ')
  },
})
