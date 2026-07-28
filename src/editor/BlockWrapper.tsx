import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface BlockWrapperProps {
  id: string
  children: ReactNode
  onAddAfter: () => void
  onDelete: () => void
}

/** 블록마다 공통으로 두르는 hover 핸들(+/⠿/✕). 실제 편집 UI는 children으로 들어온다. */
export function BlockWrapper({ id, children, onAddAfter, onDelete }: BlockWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-start gap-1 rounded-md py-1 ${isDragging ? 'z-10 opacity-70' : ''}`}
    >
      <div className="flex shrink-0 items-center gap-0.5 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onAddAfter}
          className="tap-target flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="아래에 블록 추가"
          title="블록 추가"
        >
          ＋
        </button>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="tap-target flex h-6 w-6 cursor-grab items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
          aria-label="드래그해서 순서 바꾸기"
          title="드래그"
        >
          ⠿
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onDelete}
        className="tap-target shrink-0 self-start rounded px-1 text-neutral-300 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        aria-label="블록 삭제"
        title="삭제"
      >
        ✕
      </button>
    </div>
  )
}
