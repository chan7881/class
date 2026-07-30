import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { getBlockDefinition } from '../blocks/registry'
import { QuestionBlockEditor } from '../blocks/QuestionBlockView'
import { groupBlocksIntoRows } from '../lib/blockLayout'
import { useEditorStore } from '../store/editorStore'
import { BlockWrapper } from './BlockWrapper'
import { SlashMenu } from './SlashMenu'
import type { InsertableItem } from './menuItems'
import type { Block, Slide } from '../types/lesson'

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

  function insertItem(item: InsertableItem, anchor: string | 'end') {
    const block = item.build()
    const index = anchor === 'end' ? slide.blocks.length : slide.blocks.findIndex((b) => b.id === anchor) + 1
    addBlock(slide.id, block, index)
    setMenuAnchor(null)
  }

  function toggleLayout(block: Block) {
    const next: Block['layout'] = block.layout === 'half' ? 'full' : 'half'
    updateBlock(slide.id, block.id, (b) => ({ ...b, layout: next }))
  }

  const rows = groupBlocksIntoRows(slide.blocks)

  return (
    <div className="flex flex-col gap-1">
      {slide.blocks.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">아래 버튼으로 첫 블록을 추가하세요</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slide.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <div key={row.map((b) => b.id).join('-')} className={row.length === 2 ? 'flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2' : undefined}>
              {row.map((block) => {
                const def = block.type === 'question' ? undefined : getBlockDefinition(block.type)
                return (
                  <div key={block.id} className={`relative ${row.length === 2 ? 'sm:min-w-0 sm:flex-1' : ''}`}>
                    <BlockWrapper
                      id={block.id}
                      onAddAfter={() => setMenuAnchor(block.id)}
                      onDelete={() => removeBlock(slide.id, block.id)}
                      layout={block.type === 'question' ? undefined : (block.layout ?? 'full')}
                      onToggleLayout={block.type === 'question' ? undefined : () => toggleLayout(block)}
                    >
                      {block.type === 'question' ? (
                        <QuestionBlockEditor block={block} onChange={(next) => updateBlock(slide.id, block.id, () => next)} />
                      ) : def ? (
                        <def.Editor block={block} onChange={(next) => updateBlock(slide.id, block.id, () => next)} />
                      ) : (
                        <p className="rounded bg-neutral-100 p-2 text-sm text-neutral-500">
                          {block.type === 'poeGroup' ? '이 블록 유형의 편집기는 아직 없어요 (9단계에서 추가됩니다)' : `지원하지 않는 블록: ${block.type}`}
                        </p>
                      )}
                    </BlockWrapper>
                    {menuAnchor === block.id && <SlashMenu onSelect={(item) => insertItem(item, block.id)} onClose={() => setMenuAnchor(null)} />}
                  </div>
                )
              })}
            </div>
          ))}
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
        {menuAnchor === 'end' && <SlashMenu onSelect={(item) => insertItem(item, 'end')} onClose={() => setMenuAnchor(null)} />}
      </div>
    </div>
  )
}
