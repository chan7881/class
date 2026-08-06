import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { countSigFigs } from '../../lib/sigfigs'
import { parseNumericInput } from '../../lib/numericInput'
import { COMMON_UNITS, normalizeUnitString, toBaseValue, unitsAreCompatible } from '../../lib/units'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { NumericQuestion } from '../../types/lesson'

interface NumericAnswerValue {
  raw: string
  unit: string
}

function withinTolerance(given: number, answer: number, tolerance?: NumericQuestion['tolerance']): boolean {
  if (!tolerance) return given === answer
  const allowed = tolerance.mode === 'pct' ? Math.abs(answer) * (tolerance.value / 100) : tolerance.value
  return Math.abs(given - answer) <= allowed
}

function Editor({ question, onChange }: QuestionEditorProps<NumericQuestion>) {
  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          정답
          <input
            type="number"
            value={question.answer ?? ''}
            onChange={(e) => onChange({ ...question, answer: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="tap-target rounded border border-neutral-300 px-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          단위 (선택)
          <input
            list="numeric-common-units"
            value={question.unit ?? ''}
            onChange={(e) => onChange({ ...question, unit: e.target.value || undefined })}
            placeholder="예: m/s"
            className="tap-target rounded border border-neutral-300 px-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          단위 판정
          <select
            value={question.unitMode ?? 'none'}
            onChange={(e) => onChange({ ...question, unitMode: e.target.value as NumericQuestion['unitMode'] })}
            className="tap-target rounded border border-neutral-300 px-2"
          >
            <option value="none">단위 안 봄</option>
            <option value="required">정확히 같은 단위만</option>
            <option value="convertible">환산 허용 (예: km↔m)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          허용 오차
          <div className="flex gap-1">
            <select
              value={question.tolerance?.mode ?? ''}
              onChange={(e) => {
                const mode = e.target.value as 'abs' | 'pct' | ''
                onChange({ ...question, tolerance: mode ? { mode, value: question.tolerance?.value ?? 0 } : undefined })
              }}
              className="tap-target rounded border border-neutral-300 px-1"
            >
              <option value="">정확히 일치</option>
              <option value="abs">± 값</option>
              <option value="pct">± %</option>
            </select>
            {question.tolerance && (
              <input
                type="number"
                value={question.tolerance.value}
                onChange={(e) =>
                  onChange({ ...question, tolerance: { mode: question.tolerance ? question.tolerance.mode : 'abs', value: Number(e.target.value) } })
                }
                className="tap-target w-20 rounded border border-neutral-300 px-1"
              />
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          유효숫자 (선택)
          <input
            type="number"
            min={1}
            value={question.sigFigs ?? ''}
            onChange={(e) => onChange({ ...question, sigFigs: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="tap-target rounded border border-neutral-300 px-2"
          />
        </label>
      </div>
      <datalist id="numeric-common-units">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<NumericQuestion>) {
  const current = (value as NumericAnswerValue | undefined) ?? { raw: '', unit: '' }
  const showUnit = !!question.unitMode && question.unitMode !== 'none'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={current.raw}
        disabled={disabled}
        onChange={(e) => onChange({ ...current, raw: e.target.value })}
        placeholder="숫자 (예: 9.8 또는 3.0×10^8)"
        className="tap-target flex-1 rounded-lg border border-neutral-300 px-3 outline-none focus:border-accent-500 disabled:bg-neutral-50"
      />
      {showUnit && (
        <>
          <input
            list="numeric-common-units-viewer"
            value={current.unit}
            disabled={disabled}
            onChange={(e) => onChange({ ...current, unit: e.target.value })}
            placeholder="단위"
            className="tap-target w-28 rounded-lg border border-neutral-300 px-2 outline-none focus:border-accent-500 disabled:bg-neutral-50"
          />
          <datalist id="numeric-common-units-viewer">
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}

registerQuestion<NumericQuestion>({
  kind: 'numeric',
  label: '수치형',
  createDefault: (id) => ({ id, kind: 'numeric', prompt: '', required: true, points: 10, unitMode: 'none' }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const input = value as NumericAnswerValue | undefined
    if (!input || question.answer === undefined) return { correct: false, points: 0 }

    const parsed = parseNumericInput(input.raw)
    if (parsed === null) return { correct: false, points: 0 }

    if (question.sigFigs !== undefined && countSigFigs(input.raw) !== question.sigFigs) {
      return { correct: false, points: 0 }
    }

    let comparisonValue = parsed
    let comparisonAnswer = question.answer

    if (question.unitMode === 'required') {
      if (normalizeUnitString(input.unit) !== normalizeUnitString(question.unit)) return { correct: false, points: 0 }
    } else if (question.unitMode === 'convertible') {
      if (!unitsAreCompatible(input.unit, question.unit)) return { correct: false, points: 0 }
      const givenBase = toBaseValue(parsed, input.unit)
      const answerBase = toBaseValue(question.answer, question.unit)
      if (givenBase === null || answerBase === null) return { correct: false, points: 0 }
      comparisonValue = givenBase
      comparisonAnswer = answerBase
    }

    const correct = withinTolerance(comparisonValue, comparisonAnswer, question.tolerance)
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (_question, value) => {
    const input = value as NumericAnswerValue | undefined
    return !!input && input.raw.trim().length > 0
  },
  toCell: (_question, value) => {
    const input = value as NumericAnswerValue | undefined
    if (!input) return ''
    return input.unit ? `${input.raw} ${input.unit}` : input.raw
  },
  describeAnswer: (question) => {
    if (question.answer === undefined) return null
    const tolerance = question.tolerance ? ` (허용오차 ±${question.tolerance.value}${question.tolerance.mode === 'pct' ? '%' : ''})` : ''
    return `${question.answer}${question.unit ? ' ' + question.unit : ''}${tolerance}`
  },
  checkAuthoring: (question) => {
    if (question.answer === undefined) return '정답 값을 입력하지 않았어요'
    if (question.unitMode && question.unitMode !== 'none' && !(question.unit ?? '').trim()) return '단위를 요구하도록 해놓고 단위를 비워뒀어요'
    return null
  },
})
