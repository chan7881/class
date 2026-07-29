import { useRef } from 'react'
import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { CommaListInput } from '../../components/CommaListInput'
import { chemFormulasMatch } from '../../lib/chemNormalize'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { ChemQuestion } from '../../types/lesson'

/** 자동 변환 없이 버튼으로만 첨자를 넣는다 — 사용자 지시(docs/DECISIONS.md 참고). */
const CHEM_BUTTONS: { label: string; insert: string; ariaLabel?: string }[] = [
  { label: '₀', insert: '₀' },
  { label: '₁', insert: '₁' },
  { label: '₂', insert: '₂' },
  { label: '₃', insert: '₃' },
  { label: '₄', insert: '₄' },
  { label: '₅', insert: '₅' },
  { label: '₆', insert: '₆' },
  { label: '⁺', insert: '⁺', ariaLabel: '양전하' },
  { label: '⁻', insert: '⁻', ariaLabel: '음전하' },
  { label: '→', insert: '→' },
  { label: '⇌', insert: '⇌' },
  { label: '↑', insert: '↑', ariaLabel: '기체 발생' },
  { label: '↓', insert: '↓', ariaLabel: '침전' },
  { label: '↔', insert: '↔', ariaLabel: '양방향' },
  { label: 'Δ', insert: 'Δ' },
  { label: '·', insert: '·' },
  { label: '(s)', insert: '(s)' },
  { label: '(l)', insert: '(l)' },
  { label: '(g)', insert: '(g)' },
  { label: '(aq)', insert: '(aq)' },
]

function useCursorInsert(value: string, onChange: (next: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  function insert(text: string) {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      if (el) {
        const pos = start + text.length
        el.setSelectionRange(pos, pos)
        el.focus()
      }
    })
  }
  return { ref, insert }
}

function ChemToolbar({ onPress, disabled }: { onPress: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {CHEM_BUTTONS.map((btn) => (
        <button
          key={btn.label}
          type="button"
          disabled={disabled}
          onClick={() => onPress(btn.insert)}
          aria-label={btn.ariaLabel ?? btn.label}
          className="tap-target rounded border border-neutral-300 bg-white px-2 text-sm disabled:opacity-50"
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

function Editor({ question, onChange }: QuestionEditorProps<ChemQuestion>) {
  const answerText = (question.answer ?? []).join(', ')
  const { ref, insert } = useCursorInsert(answerText, (next) =>
    onChange({
      ...question,
      answer: next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  )

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <label className="flex flex-col gap-1 text-sm text-neutral-600">
        정답 화학식 (쉼표로 여러 개 가능)
        <CommaListInput
          ref={ref}
          value={question.answer ?? []}
          onChange={(answer) => onChange({ ...question, answer })}
          className="tap-target rounded border border-neutral-300 px-2 text-base"
          placeholder="예: H₂O"
        />
      </label>
      <ChemToolbar onPress={insert} />
    </QuestionEditorShell>
  )
}

function Viewer({ value, onChange, disabled }: QuestionViewerProps<ChemQuestion>) {
  const current = typeof value === 'string' ? value : ''
  const { ref, insert } = useCursorInsert(current, onChange)

  return (
    <div>
      <input
        ref={ref}
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="tap-target w-full rounded-lg border border-neutral-300 px-3 text-base outline-none focus:border-accent-500 disabled:bg-neutral-50"
        placeholder="화학식을 입력하세요"
      />
      <ChemToolbar onPress={insert} disabled={disabled} />
    </div>
  )
}

registerQuestion<ChemQuestion>({
  kind: 'chem',
  label: '화학식',
  createDefault: (id) => ({ id, kind: 'chem', prompt: '', required: true, points: 10, answer: [] }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const given = typeof value === 'string' ? value : ''
    const correct = given.trim().length > 0 && chemFormulasMatch(given, question.answer ?? [])
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (_question, value) => typeof value === 'string' && value.trim().length > 0,
  describeAnswer: (question) => ((question.answer ?? []).length > 0 ? question.answer!.join(' 또는 ') : null),
})
