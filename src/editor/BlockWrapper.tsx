import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface BlockWrapperProps {
  id: string
  children: ReactNode
  onAddAfter: () => void
  onDelete: () => void
  /** 현재 이 블록의 폭. onToggleLayout이 없으면(문항 블록 등) 폭 전환 버튼 자체를 안 보여준다. */
  layout?: 'full' | 'half'
  onToggleLayout?: () => void
}

/** 블록마다 공통으로 두르는 hover 핸들(+/⠿/✕, 폭 전환). 실제 편집 UI는 children으로 들어온다. */
export function BlockWrapper({ id, children, onAddAfter, onDelete, layout, onToggleLayout }: BlockWrapperProps) {
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
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onToggleLayout && (
          <button
            type="button"
            onClick={onToggleLayout}
            className={`tap-target flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-medium ${
              layout === 'half' ? 'bg-accent-50 text-accent-500' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'
            }`}
            aria-label={layout === 'half' ? '전체 폭으로 전환' : '절반 폭으로 전환(다른 절반 폭 블록과 나란히 배치)'}
            title={layout === 'half' ? '절반 폭 (누르면 전체 폭으로)' : '전체 폭 (누르면 절반 폭으로, 옆 블록과 나란히)'}
          >
            ½
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="tap-target flex h-6 min-w-6 items-center justify-center rounded text-neutral-300 hover:text-danger"
          aria-label="블록 삭제"
          title="삭제"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
