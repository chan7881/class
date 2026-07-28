import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { HeadingBlock as HeadingBlockData } from '../types/lesson'

const LEVEL_CLASS: Record<1 | 2 | 3, string> = {
  1: 'text-2xl font-bold',
  2: 'text-xl font-bold',
  3: 'text-lg font-semibold',
}

function Editor({ block, onChange }: BlockEditorProps<HeadingBlockData>) {
  return (
    <div className="flex items-center gap-2">
      <select
        className="tap-target rounded border border-neutral-200 bg-white px-1 text-sm"
        value={block.level}
        onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}
      >
        <option value={1}>제목 1</option>
        <option value={2}>제목 2</option>
        <option value={3}>제목 3</option>
      </select>
      <input
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        placeholder="제목을 입력하세요"
        className={`tap-target flex-1 rounded border border-transparent bg-transparent px-1 outline-none focus:border-neutral-300 ${LEVEL_CLASS[block.level]}`}
      />
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<HeadingBlockData>) {
  const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3'
  return <Tag className={LEVEL_CLASS[block.level]}>{block.text}</Tag>
}

registerBlock<HeadingBlockData>({
  type: 'heading',
  label: '제목',
  icon: '🔠',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'heading', level: 2, text: '' }),
  Editor,
  Viewer,
})
