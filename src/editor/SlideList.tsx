import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { computeSlideNumbers } from '../lib/numbering'
import { useEditorStore } from '../store/editorStore'

interface SlideThumbProps {
  id: string
  number: string
  active: boolean
  isSub: boolean
  canToggleSub: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleSub: () => void
  canDelete: boolean
}

function SlideThumb({ id, number, active, isSub, canToggleSub, onSelect, onDuplicate, onDelete, onToggleSub, canDelete }: SlideThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-1 rounded-lg border p-2 ${
        active ? 'border-accent-500 bg-accent-50' : 'border-neutral-200 bg-white'
      } ${isDragging ? 'z-10 opacity-70' : ''} ${isSub ? 'ml-4' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="tap-target cursor-grab px-1 text-neutral-400 active:cursor-grabbing"
        aria-label="드래그해서 순서 바꾸기"
      >
        ⠿
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-left text-sm">
        <span className="mr-1 font-mono text-neutral-400">{number}</span>
        슬라이드
      </button>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        {canToggleSub && (
          <button
            type="button"
            onClick={onToggleSub}
            title="보조 슬라이드로 지정/해제"
            className={`tap-target rounded px-1 text-xs ${isSub ? 'text-accent-500' : 'text-neutral-400 hover:text-neutral-700'}`}
          >
            ⤷
          </button>
        )}
        <button type="button" onClick={onDuplicate} title="복제" className="tap-target rounded px-1 text-neutral-400 hover:text-neutral-700">
          ⧉
        </button>
        {canDelete && (
          <button type="button" onClick={onDelete} title="삭제" className="tap-target rounded px-1 text-neutral-400 hover:text-danger">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

export function SlideList() {
  const lesson = useEditorStore((s) => s.lesson)
  const currentSlideId = useEditorStore((s) => s.currentSlideId)
  const setCurrentSlide = useEditorStore((s) => s.setCurrentSlide)
  const addSlide = useEditorStore((s) => s.addSlide)
  const removeSlide = useEditorStore((s) => s.removeSlide)
  const duplicateSlide = useEditorStore((s) => s.duplicateSlide)
  const reorderSlides = useEditorStore((s) => s.reorderSlides)
  const toggleSubSlide = useEditorStore((s) => s.toggleSubSlide)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (!lesson) return null
  const numbers = computeSlideNumbers(lesson.slides)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !lesson) return
    const fromIndex = lesson.slides.findIndex((s) => s.id === active.id)
    const toIndex = lesson.slides.findIndex((s) => s.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    reorderSlides(fromIndex, toIndex)
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lesson.slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {lesson.slides.map((slide, i) => (
            <SlideThumb
              key={slide.id}
              id={slide.id}
              number={numbers[i]}
              active={slide.id === currentSlideId}
              isSub={slide.isSub}
              canToggleSub={i > 0}
              canDelete={lesson.slides.length > 1}
              onSelect={() => setCurrentSlide(slide.id)}
              onDuplicate={() => duplicateSlide(slide.id)}
              onDelete={() => removeSlide(slide.id)}
              onToggleSub={() => toggleSubSlide(slide.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={() => addSlide(currentSlideId ?? undefined)}
        className="tap-target rounded-lg border border-dashed border-neutral-300 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
      >
        ＋ 슬라이드 추가
      </button>
    </div>
  )
}
