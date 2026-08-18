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
          className="tap-target rounded border border-accent-500 px-2 text-accent-ink"
        >
          + 빈칸
        </button>
      </div>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<ClozeQuestion>) {
  const values = Array.isArray(value) ? (value as string[]) : []
  const blankCount = question.segments.filter(isBlank).length
  let blankIndex = -1

  return (
    <p className="text-base leading-[2.2]">
      {question.segments.map((seg, i) => {
        if (seg.t === 'text') return <span key={i}>{seg.v}</span>
        blankIndex += 1
        const bIdx = blankIndex
        const current = values[bIdx] ?? ''

        function setValue(next: string) {
          // ⚠️ `[...values]` 뒤에 뒤쪽 인덱스를 대입하면 배열에 **구멍**이 생긴다. 학생이 빈칸을
          //    건너뛰고 뒤엣것부터 채우는 흔한 순서에서 그렇게 되고, JSON으로 저장되는 순간
          //    그 구멍이 null이 되어 읽는 쪽에서 터진다(2026-08-18 현황판 흰 화면 사고).
          //    빈칸 개수만큼 빈 문자열로 채운 조밀한 배열을 만들어 구멍 자체를 없앤다.
          const size = Math.max(values.length, bIdx + 1, blankCount)
          const nextValues = Array.from({ length: size }, (_, i) => (typeof values[i] === 'string' ? values[i] : ''))
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
    const values = Array.isArray(value) ? (value as unknown[]) : []
    const blankCount = question.segments.filter(isBlank).length
    // ⚠️ 원소가 문자열이라고 믿으면 안 된다. 학생이 빈칸을 건너뛰고 뒤엣것부터 채우면 배열에
    //    구멍이 생기고, JSON으로 저장될 때 그 구멍이 null이 된다(["전자", null, "(+)전기"]).
    //    2026-08-18에 이 null 하나로 `null.trim()`이 터져 현황판 전체가 흰 화면이 됐다 —
    //    한 학생의 답 때문에 학급 전체가 안 보였다. 채우는 쪽(Viewer)도 같이 고쳤지만,
    //    이미 저장된 옛 응답이 남아 있으므로 읽는 쪽 방어를 없애면 안 된다.
    // 빈칸 개수만큼 **인덱스로 직접** 확인한다. `values.every(...)`를 쓰면 안 된다 —
    // every 는 배열의 **구멍을 건너뛴다.** 저장 전(메모리)에는 구멍인 채라, 건너뛴 빈칸이
    // 검사에서 통째로 빠져 "다 채웠다"로 통과해 버린다(requireAnswerToAdvance가 무력해진다).
    return blankCount > 0 && Array.from({ length: blankCount }, (_, i) => values[i]).every((v) => typeof v === 'string' && v.trim().length > 0)
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
