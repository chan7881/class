import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { MathField } from '../../math/MathField'
import { latexMatches } from '../../lib/mathNormalize'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { MathKeyboardLayer, MathQuestion } from '../../types/lesson'

const ALL_LAYERS: MathKeyboardLayer[] = ['basic', 'letters', 'fraction', 'symbols', 'greek', 'unit', 'chem']
const LAYER_LABELS: Record<MathKeyboardLayer, string> = {
  basic: '기본',
  letters: '영문자',
  fraction: '분수·근호',
  symbols: '기호',
  greek: '그리스',
  unit: '단위',
  chem: '화학',
}

function Editor({ question, onChange }: QuestionEditorProps<MathQuestion>) {
  const answers = question.answer ?? []
  const activeKeyboards = question.keyboards.length ? question.keyboards : (['basic'] as MathKeyboardLayer[])

  function updateAnswerAt(i: number, latex: string) {
    const next = [...answers]
    next[i] = latex
    onChange({ ...question, answer: next })
  }
  function addAnswer() {
    onChange({ ...question, answer: [...answers, ''] })
  }
  function removeAnswer(i: number) {
    onChange({ ...question, answer: answers.filter((_, idx) => idx !== i) })
  }
  function toggleLayer(layer: MathKeyboardLayer) {
    onChange({
      ...question,
      keyboards: question.keyboards.includes(layer) ? question.keyboards.filter((l) => l !== layer) : [...question.keyboards, layer],
    })
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <p className="text-sm font-medium text-neutral-600">학생에게 보여줄 버튼판</p>
      <div className="mt-1 flex flex-wrap gap-3">
        {ALL_LAYERS.map((layer) => (
          <label key={layer} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={question.keyboards.includes(layer)} onChange={() => toggleLayer(layer)} />
            {LAYER_LABELS[layer]}
          </label>
        ))}
      </div>

      <p className="mt-3 text-sm font-medium text-neutral-600">정답 (여러 개 가능 — 서로 다른 표현도 전부 등록하면 정답 처리됨)</p>
      <div className="mt-1 flex flex-col gap-2">
        {answers.map((a, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <MathField value={a} onChange={(latex) => updateAnswerAt(i, latex)} keyboards={activeKeyboards} />
            </div>
            <button type="button" onClick={() => removeAnswer(i)} className="tap-target text-neutral-400 hover:text-danger" aria-label="정답 삭제">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addAnswer} className="tap-target mt-1 px-2 text-sm text-accent-500">
        + 정답 추가
      </button>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<MathQuestion>) {
  const current = typeof value === 'string' ? value : ''
  const activeKeyboards = question.keyboards.length ? question.keyboards : (['basic'] as MathKeyboardLayer[])
  return <MathField value={current} onChange={onChange} keyboards={activeKeyboards} disabled={disabled} />
}

registerQuestion<MathQuestion>({
  kind: 'math',
  label: '수식',
  createDefault: (id) => ({ id, kind: 'math', prompt: '', required: true, points: 10, keyboards: ['basic', 'letters'], compareMode: 'normalized', answer: [] }),
  Editor,
  Viewer,
  grade: (question, value) => {
    // compareMode: 'symbolic'은 아직 미구현(Compute Engine 동적 import 예정, docs/DECISIONS.md 참고) —
    // 지금은 항상 normalized 비교로 채점한다.
    const given = typeof value === 'string' ? value : ''
    const correct = given.trim().length > 0 && latexMatches(given, question.answer ?? [])
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (_question, value) => typeof value === 'string' && value.trim().length > 0,
  describeAnswer: (question) => ((question.answer ?? []).length > 0 ? question.answer!.join(' 또는 ') : null),
})
