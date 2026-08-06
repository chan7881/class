import { useState } from 'react'
import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { MatchQuestion } from '../../types/lesson'

function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function Editor({ question, onChange }: QuestionEditorProps<MatchQuestion>) {
  function addLeft() {
    onChange({ ...question, left: [...question.left, { id: shortId(), label: '' }] })
  }
  function addRight() {
    onChange({ ...question, right: [...question.right, { id: shortId(), label: '' }] })
  }
  function updateLeft(id: string, label: string) {
    onChange({ ...question, left: question.left.map((i) => (i.id === id ? { ...i, label } : i)) })
  }
  function updateRight(id: string, label: string) {
    onChange({ ...question, right: question.right.map((i) => (i.id === id ? { ...i, label } : i)) })
  }
  function removeLeft(id: string) {
    onChange({ ...question, left: question.left.filter((i) => i.id !== id), answer: (question.answer ?? []).filter(([l]) => l !== id) })
  }
  function removeRight(id: string) {
    onChange({ ...question, right: question.right.filter((i) => i.id !== id), answer: (question.answer ?? []).filter(([, r]) => r !== id) })
  }
  function setPair(leftId: string, rightId: string) {
    const withoutLeft = (question.answer ?? []).filter(([l]) => l !== leftId)
    onChange({ ...question, answer: rightId ? [...withoutLeft, [leftId, rightId] as [string, string]] : withoutLeft })
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-600">왼쪽</p>
          <ul className="mt-1 flex flex-col gap-1">
            {question.left.map((item) => (
              <li key={item.id} className="flex items-center gap-1">
                <input
                  value={item.label}
                  onChange={(e) => updateLeft(item.id, e.target.value)}
                  placeholder="항목"
                  className="tap-target flex-1 rounded border border-neutral-300 px-2 text-sm"
                />
                <button type="button" onClick={() => removeLeft(item.id)} className="tap-target text-neutral-400 hover:text-danger" aria-label="삭제">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addLeft} className="tap-target mt-1 px-2 text-sm text-accent-ink">
            + 추가
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-600">오른쪽</p>
          <ul className="mt-1 flex flex-col gap-1">
            {question.right.map((item) => (
              <li key={item.id} className="flex items-center gap-1">
                <input
                  value={item.label}
                  onChange={(e) => updateRight(item.id, e.target.value)}
                  placeholder="항목"
                  className="tap-target flex-1 rounded border border-neutral-300 px-2 text-sm"
                />
                <button type="button" onClick={() => removeRight(item.id)} className="tap-target text-neutral-400 hover:text-danger" aria-label="삭제">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addRight} className="tap-target mt-1 px-2 text-sm text-accent-ink">
            + 추가
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-neutral-600">정답 연결</p>
      <ul className="mt-1 flex flex-col gap-1">
        {question.left.map((item) => {
          const pair = (question.answer ?? []).find(([l]) => l === item.id)
          return (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{item.label || '(항목)'}</span>
              <span className="text-neutral-400">→</span>
              <select value={pair?.[1] ?? ''} onChange={(e) => setPair(item.id, e.target.value)} className="tap-target rounded border border-neutral-300 px-1">
                <option value="">선택 안 함</option>
                {question.right.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || '(항목)'}
                  </option>
                ))}
              </select>
            </li>
          )
        })}
      </ul>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<MatchQuestion>) {
  const pairs = Array.isArray(value) ? (value as [string, string][]) : []
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)

  const rightUsed = new Map(pairs.map(([l, r]) => [r, l]))
  const leftPaired = new Map(pairs.map(([l, r]) => [l, r]))

  function clickLeft(id: string) {
    if (disabled) return
    if (leftPaired.has(id)) {
      onChange(pairs.filter(([l]) => l !== id))
      setSelectedLeft(null)
      return
    }
    setSelectedLeft(id === selectedLeft ? null : id)
  }

  function clickRight(id: string) {
    if (disabled) return
    if (rightUsed.has(id)) {
      onChange(pairs.filter(([, r]) => r !== id))
      return
    }
    if (!selectedLeft) return
    onChange([...pairs.filter(([l]) => l !== selectedLeft), [selectedLeft, id]])
    setSelectedLeft(null)
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <ul className="flex flex-col gap-2">
        {question.left.map((item) => {
          const isPaired = leftPaired.has(item.id)
          const isSelected = selectedLeft === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => clickLeft(item.id)}
                disabled={disabled}
                className={`tap-target w-full rounded-lg border p-2 text-left text-sm ${
                  isSelected ? 'border-accent-500 bg-accent-50' : isPaired ? 'border-success bg-green-50' : 'border-neutral-200'
                }`}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
      <ul className="flex flex-col gap-2">
        {question.right.map((item) => {
          const isPaired = rightUsed.has(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => clickRight(item.id)}
                disabled={disabled}
                className={`tap-target w-full rounded-lg border p-2 text-left text-sm ${isPaired ? 'border-success bg-green-50' : 'border-neutral-200'}`}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

registerQuestion<MatchQuestion>({
  kind: 'match',
  label: '연결형',
  createDefault: (id) => ({
    id,
    kind: 'match',
    prompt: '',
    required: true,
    points: 10,
    left: [
      { id: shortId(), label: '' },
      { id: shortId(), label: '' },
    ],
    right: [
      { id: shortId(), label: '' },
      { id: shortId(), label: '' },
    ],
    answer: [],
  }),
  Editor,
  Viewer,
  grade: (question, value) => {
    const given = Array.isArray(value) ? (value as [string, string][]) : []
    const answer = question.answer ?? []
    const correct = given.length === answer.length && answer.every(([l, r]) => given.some(([gl, gr]) => gl === l && gr === r))
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (question, value) => Array.isArray(value) && value.length === question.left.length,
  toCell: (question, value) => {
    const pairs = Array.isArray(value) ? (value as [string, string][]) : []
    const leftLabel = new Map(question.left.map((i) => [i.id, i.label]))
    const rightLabel = new Map(question.right.map((i) => [i.id, i.label]))
    return pairs.map(([l, r]) => `${leftLabel.get(l) ?? l}→${rightLabel.get(r) ?? r}`).join(', ')
  },
  describeAnswer: (question) => {
    const pairs = question.answer ?? []
    if (pairs.length === 0) return null
    const leftLabel = new Map(question.left.map((i) => [i.id, i.label]))
    const rightLabel = new Map(question.right.map((i) => [i.id, i.label]))
    return pairs.map(([l, r]) => `${leftLabel.get(l) ?? l}→${rightLabel.get(r) ?? r}`).join(', ')
  },
  checkAuthoring: (question) => {
    if (question.left.length === 0 || question.right.length === 0) return '왼쪽·오른쪽 항목을 모두 채워야 해요'
    const pairs = question.answer ?? []
    if (pairs.length === 0) return '정답 연결을 지정하지 않았어요'
    const unpaired = question.left.filter((item) => !pairs.some(([l]) => l === item.id))
    if (unpaired.length > 0) return `연결되지 않은 왼쪽 항목이 있어요: ${unpaired.map((i) => i.label || '(빈 항목)').join(', ')}`
    return null
  },
})
