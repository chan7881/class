import { useMemo } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { OrderQuestion } from '../../types/lesson'

function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Editor({ question, onChange }: QuestionEditorProps<OrderQuestion>) {
  function setItems(items: OrderQuestion['items']) {
    onChange({ ...question, items, answer: items.map((i) => i.id) })
  }
  function addItem() {
    setItems([...question.items, { id: shortId(), label: '' }])
  }
  function updateItem(id: string, label: string) {
    setItems(question.items.map((i) => (i.id === id ? { ...i, label } : i)))
  }
  function removeItem(id: string) {
    setItems(question.items.filter((i) => i.id !== id))
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= question.items.length) return
    const next = [...question.items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <p className="text-sm text-neutral-500">아래가 정답 순서입니다. 학생에게는 뒤섞여 보여요.</p>
      <ul className="mt-1 flex flex-col gap-1">
        {question.items.map((item, i) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="w-6 text-sm text-neutral-400">{i + 1}</span>
            <input
              value={item.label}
              onChange={(e) => updateItem(item.id, e.target.value)}
              placeholder="항목"
              className="tap-target flex-1 rounded border border-neutral-300 px-2 text-sm"
            />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="tap-target text-neutral-400 disabled:opacity-30" aria-label="위로">
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === question.items.length - 1}
              className="tap-target text-neutral-400 disabled:opacity-30"
              aria-label="아래로"
            >
              ↓
            </button>
            <button type="button" onClick={() => removeItem(item.id)} className="tap-target text-neutral-400 hover:text-danger" aria-label="삭제">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addItem} className="tap-target mt-1 px-2 text-sm text-accent-500">
        + 항목 추가
      </button>
    </QuestionEditorShell>
  )
}

function SortableItem({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`tap-target flex items-center gap-2 rounded-lg border border-neutral-300 bg-white p-2 ${isDragging ? 'z-10 opacity-70 shadow-lg' : ''}`}
    >
      <button type="button" {...attributes} {...listeners} className="tap-target cursor-grab text-neutral-400 active:cursor-grabbing" aria-label="드래그해서 순서 바꾸기">
        ⠿
      </button>
      <span>{label}</span>
    </li>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<OrderQuestion>) {
  // 문항이 처음 나타날 때 한 번 섞는다. 학생이 새로고침하면 다시 섞일 수 있다는 점은 알려진 한계
  // (완벽히 고정하려면 studentKey로 시드를 고정해야 하는데, 지금은 우선순위가 낮다고 판단).
  const shuffled = useMemo(() => shuffle(question.items), [question.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const order = Array.isArray(value) && value.length === question.items.length ? (value as string[]) : shuffled.map((i) => i.id)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const byId = new Map(question.items.map((i) => [i.id, i.label]))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (disabled || !over || active.id === over.id) return
    const from = order.indexOf(active.id as string)
    const to = order.indexOf(over.id as string)
    if (from === -1 || to === -1) return
    const next = [...order]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {order.map((id) => (
            <SortableItem key={id} id={id} label={byId.get(id) ?? ''} disabled={disabled} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

registerQuestion<OrderQuestion>({
  kind: 'order',
  label: '순서배열',
  icon: '🔢',
  createDefault: (id) => {
    const items = [
      { id: shortId(), label: '' },
      { id: shortId(), label: '' },
      { id: shortId(), label: '' },
    ]
    return { id, kind: 'order', prompt: '', required: true, points: 10, items, answer: items.map((i) => i.id) }
  },
  Editor,
  Viewer,
  grade: (question, value) => {
    const given = Array.isArray(value) ? (value as string[]) : []
    const answer = question.answer ?? []
    const correct = given.length === answer.length && given.every((id, i) => id === answer[i])
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (question, value) => Array.isArray(value) && value.length === question.items.length,
})
