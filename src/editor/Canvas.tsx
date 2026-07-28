import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { getBlockDefinition } from '../blocks/registry'
import { useEditorStore } from '../store/editorStore'
import { BlockWrapper } from './BlockWrapper'
import { SlashMenu } from './SlashMenu'
import type { Slide } from '../types/lesson'
import type { BlockDefinition } from '../blocks/types'

export function Canvas({ slide }: { slide: Slide }) {
  const addBlock = useEditorStore((s) => s.addBlock)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const reorderBlocks = useEditorStore((s) => s.reorderBlocks)

  const [menuAnchor, setMenuAnchor] = useState<string | 'end' | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = slide.blocks.findIndex((b) => b.id === active.id)
    const toIndex = slide.blocks.findIndex((b) => b.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    reorderBlocks(slide.id, fromIndex, toIndex)
  }

  function insertBlock(def: BlockDefinition, anchor: string | 'end') {
    const block = def.createDefault(crypto.randomUUID())
    const index = anchor === 'end' ? slide.blocks.length : slide.blocks.findIndex((b) => b.id === anchor) + 1
    addBlock(slide.id, block, index)
    setMenuAnchor(null)
  }

  return (
    <div className="flex flex-col gap-1">
      {slide.blocks.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">아래 버튼으로 첫 블록을 추가하세요</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slide.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {slide.blocks.map((block) => {
            const def = getBlockDefinition(block.type)
            return (
              <div key={block.id} className="relative">
                <BlockWrapper id={block.id} onAddAfter={() => setMenuAnchor(block.id)} onDelete={() => removeBlock(slide.id, block.id)}>
                  {def ? (
                    <def.Editor block={block} onChange={(next) => updateBlock(slide.id, block.id, () => next)} />
                  ) : (
                    <p className="rounded bg-neutral-100 p-2 text-sm text-neutral-500">
                      {block.type === 'question' || block.type === 'poeGroup'
                        ? '이 블록 유형의 편집기는 아직 없어요 (다음 단계에서 추가됩니다)'
                        : `지원하지 않는 블록: ${block.type}`}
                    </p>
                  )}
                </BlockWrapper>
                {menuAnchor === block.id && <SlashMenu onSelect={(d) => insertBlock(d, block.id)} onClose={() => setMenuAnchor(null)} />}
              </div>
            )
          })}
        </SortableContext>
      </DndContext>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuAnchor('end')}
          className="tap-target flex items-center gap-2 rounded px-2 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          ＋ 블록 추가
        </button>
        {menuAnchor === 'end' && <SlashMenu onSelect={(d) => insertBlock(d, 'end')} onClose={() => setMenuAnchor(null)} />}
      </div>
    </div>
  )
}
