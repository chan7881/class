import { computeSlideNumbers } from '../lib/numbering'
import { useEditorStore } from '../store/editorStore'
import type { BranchRule, Question, Slide } from '../types/lesson'

function questionsInSlide(slide: Slide): Question[] {
  return slide.blocks.filter((b) => b.type === 'question').map((b) => b.q)
}

function whenOptions(question: Question | undefined): { value: string; label: string }[] {
  if (!question) return []
  const base = [
    { value: 'correct', label: '정답이면' },
    { value: 'incorrect', label: '오답이면' },
  ]
  if (question.kind === 'choice') {
    return [...base, ...question.options.map((o) => ({ value: `choice:${o.id}`, label: `"${o.label}" 선택 시` }))]
  }
  return base
}

export function BranchEditor({ slide, allSlides }: { slide: Slide; allSlides: Slide[] }) {
  const updateSlideBranch = useEditorStore((s) => s.updateSlideBranch)
  const questions = questionsInSlide(slide)
  const numbers = computeSlideNumbers(allSlides)
  const targetOptions = allSlides
    .map((s, i) => ({ id: s.id, label: `${numbers[i]}${s.id === slide.id ? ' (현재 슬라이드)' : ''}` }))
    .filter((o) => o.id !== slide.id)

  if (questions.length === 0) {
    return <p className="mt-3 text-xs text-neutral-400">이 슬라이드에 문항이 있어야 분기 규칙을 설정할 수 있어요.</p>
  }

  if (!slide.branch) {
    return (
      <button
        type="button"
        onClick={() =>
          updateSlideBranch(slide.id, { questionId: questions[0].id, rules: [], default: undefined })
        }
        className="tap-target mt-3 rounded border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50"
      >
        ＋ 분기 규칙 추가 (정답/오답에 따라 다른 슬라이드로)
      </button>
    )
  }

  const branch = slide.branch
  const triggerQuestion = questions.find((q) => q.id === branch.questionId)
  const options = whenOptions(triggerQuestion)

  function update(patch: Partial<BranchRule>) {
    updateSlideBranch(slide.id, { ...branch, ...patch })
  }
  function updateRule(i: number, patch: Partial<BranchRule['rules'][number]>) {
    update({ rules: branch.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
  }
  function addRule() {
    update({ rules: [...branch.rules, { when: (options[0]?.value ?? 'correct') as BranchRule['rules'][number]['when'], goTo: targetOptions[0]?.id ?? '' }] })
  }
  function removeRule(i: number) {
    update({ rules: branch.rules.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600">분기 규칙</p>
        <button type="button" onClick={() => updateSlideBranch(slide.id, undefined)} className="text-xs text-neutral-400 hover:text-danger">
          분기 제거
        </button>
      </div>

      <label className="mt-2 flex items-center gap-2 text-sm">
        기준 문항
        <select
          value={branch.questionId}
          onChange={(e) => update({ questionId: e.target.value })}
          className="tap-target rounded border border-neutral-300 px-1"
        >
          {questions.map((q, i) => (
            <option key={q.id} value={q.id}>
              문항 {i + 1}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-col gap-1">
        {branch.rules.map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1 text-sm">
            <select value={rule.when} onChange={(e) => updateRule(i, { when: e.target.value as BranchRule['rules'][number]['when'] })} className="tap-target rounded border border-neutral-300 px-1">
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span>→</span>
            <select value={rule.goTo} onChange={(e) => updateRule(i, { goTo: e.target.value })} className="tap-target rounded border border-neutral-300 px-1">
              {targetOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removeRule(i)} className="tap-target text-neutral-400 hover:text-danger" aria-label="규칙 삭제">
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addRule} className="tap-target self-start px-1 text-sm text-accent-ink">
          + 규칙 추가
        </button>
      </div>

      <label className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
        그 외에는
        <select
          value={branch.default ?? ''}
          onChange={(e) => update({ default: e.target.value || undefined })}
          className="tap-target rounded border border-neutral-300 px-1"
        >
          <option value="">보통 진행(다음 메인 슬라이드)</option>
          {targetOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
