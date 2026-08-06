import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { CommaListInput } from '../../components/CommaListInput'
import { normalizeAnswerText } from '../../lib/textNormalize'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { ClozeQuestion, ClozeSegment } from '../../types/lesson'

function isBlank(seg: ClozeSegment): seg is Extract<ClozeSegment, { t: 'blank' }> {
  return seg.t === 'blank'
}

function Editor({ question, onChange }: QuestionEditorProps<ClozeQuestion>) {
  function updateSegments(next: ClozeSegment[]) {
    onChange({ ...question, segments: next })
  }
  function updateAt(i: number, patch: Partial<ClozeSegment>) {
    updateSegments(question.segments.map((s, idx) => (idx === i ? ({ ...s, ...patch } as ClozeSegment) : s)))
  }
  function removeAt(i: number) {
    updateSegments(question.segments.filter((_, idx) => idx !== i))
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <div className="flex flex-col gap-2">
        {question.segments.map((seg, i) =>
          seg.t === 'text' ? (
            <div key={i} className="flex items-center gap-2">
              <input
                value={seg.v}
                onChange={(e) => updateAt(i, { v: e.target.value })}
                placeholder="문장 조각"
                className="tap-target flex-1 rounded border border-neutral-300 px-2 text-sm"
              />
              <button type="button" onClick={() => removeAt(i)} className="tap-target text-neutral-400 hover:text-danger" aria-label="삭제">
                ✕
              </button>
            </div>
          ) : (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-accent-100 bg-accent-50 p-2 text-sm">
              <span className="rounded bg-accent-500 px-2 py-0.5 text-white">빈칸</span>
              <select
                value={seg.mode}
                onChange={(e) =>
                  updateAt(i, {
                    mode: e.target.value as 'input' | 'select',
                    options: e.target.value === 'select' ? (seg.options ?? ['']) : undefined,
                  })
                }
                className="tap-target rounded border border-neutral-300 px-1"
              >
                <option value="input">직접 입력</option>
                <option value="select">드롭다운 선택</option>
              </select>
              {seg.mode === 'select' && (
                <CommaListInput
                  value={seg.options ?? []}
                  onChange={(options) => updateAt(i, { options })}
                  placeholder="보기 (쉼표로 구분)"
                  className="tap-target min-w-32 flex-1 rounded border border-neutral-300 px-2"
                />
              )}
              <CommaListInput
                value={seg.answer ?? []}
                onChange={(answer) => updateAt(i, { answer })}
                placeholder="정답 (쉼표로 여러 개 가능)"
                className="tap-target min-w-32 flex-1 rounded border border-neutral-300 px-2"
              />
              <button type="button" onClick={() => removeAt(i)} className="tap-target text-neutral-400 hover:text-danger" aria-label="삭제">
                ✕
              </button>
            </div>
          ),
        )}
      </div>
      <div className="mt-2 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => updateSegments([...question.segments, { t: 'text', v: '' }])}
          className="tap-target rounded border border-neutral-300 px-2 text-neutral-600"
        >
          + 텍스트
        </button>
        <button
          type="button"
          onClick={() => updateSegments([...question.segments, { t: 'blank', mode: 'input', answer: [] }])}
          className="tap-target rounded border border-accent-300 px-2 text-accent-600"
        >
          + 빈칸
        </button>
      </div>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<ClozeQuestion>) {
  const values = Array.isArray(value) ? (value as string[]) : []
  let blankIndex = -1

  return (
    <p className="text-base leading-[2.2]">
      {question.segments.map((seg, i) => {
        if (seg.t === 'text') return <span key={i}>{seg.v}</span>
        blankIndex += 1
        const bIdx = blankIndex
        const current = values[bIdx] ?? ''

        function setValue(next: string) {
          const nextValues = [...values]
          nextValues[bIdx] = next
          onChange(nextValues)
        }

        if (seg.mode === 'select') {
          return (
            <select
              key={i}
              value={current}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              className="tap-target mx-1 rounded border border-neutral-300 px-1"
            >
              <option value="">선택</option>
              {(seg.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )
        }
        return (
          <input
            key={i}
            value={current}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            className="tap-target mx-1 inline-block w-24 rounded border-b-2 border-accent-500 px-1 text-center outline-none"
          />
        )
      })}
    </p>
  )
}

registerQuestion<ClozeQuestion>({
  kind: 'cloze',
  label: '빈칸채우기',
  createDefault: (id) => ({
    id,
    kind: 'cloze',
    prompt: '',
    required: true,
    points: 10,
    segments: [
      { t: 'text', v: '' },
      { t: 'blank', mode: 'input', answer: [] },
    ],
  }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const values = Array.isArray(value) ? (value as string[]) : []
    const blanks = question.segments.filter(isBlank)
    const correct =
      blanks.length > 0 &&
      blanks.every((blank, i) => {
        const given = normalizeAnswerText(values[i] ?? '')
        const accepted = (blank.answer ?? []).map(normalizeAnswerText)
        return accepted.length > 0 && accepted.includes(given)
      })
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (question, value) => {
    const values = Array.isArray(value) ? (value as string[]) : []
    const blankCount = question.segments.filter(isBlank).length
    return blankCount > 0 && values.length >= blankCount && values.every((v) => v.trim().length > 0)
  },
  toCell: (_question, value) => (Array.isArray(value) ? (value as string[]).join(' / ') : ''),
  describeAnswer: (question) => {
    const blanks = question.segments.filter(isBlank)
    if (blanks.length === 0) return null
    const labels = blanks.map((b) => (b.answer ?? []).join('|') || '(정답 없음)')
    return labels.join(' / ')
  },
  checkAuthoring: (question) => {
    const blanks = question.segments.filter(isBlank)
    if (blanks.length === 0) return '빈칸이 하나도 없어요'
    const emptyAnswer = blanks.findIndex((b) => (b.answer ?? []).length === 0)
    if (emptyAnswer >= 0) return `${emptyAnswer + 1}번째 빈칸에 정답이 없어요`
    const emptyOptions = blanks.findIndex((b) => b.mode === 'select' && (b.options ?? []).length < 2)
    if (emptyOptions >= 0) return `${emptyOptions + 1}번째 빈칸(드롭다운)의 보기가 2개 미만이에요`
    return null
  },
})
