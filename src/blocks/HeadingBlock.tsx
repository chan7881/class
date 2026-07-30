import { RichTextEditor } from '../richtext/RichTextEditor'
import { sanitizeHtml } from '../lib/sanitizeHtml'
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
    <div className="flex items-start gap-2">
      <select
        className="tap-target mt-0.5 shrink-0 rounded border border-neutral-200 bg-neutral-0 px-1 text-sm"
        value={block.level}
        onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}
      >
        <option value={1}>제목 1</option>
        <option value={2}>제목 2</option>
        <option value={3}>제목 3</option>
      </select>
      <RichTextEditor
        html={block.html}
        onChange={(html) => onChange({ ...block, html })}
        placeholder="제목을 입력하세요"
        singleLine
        className="min-w-0 flex-1"
        contentClassName={`${LEVEL_CLASS[block.level]} focus:outline-none`}
      />
    </div>
  )
}

// singleLine RichTextEditor는 항상 내용을 <p>...</p> 하나로 감싸 돌려준다 — heading 태그
// 안에 block-level <p>를 또 중첩시키면(<h2><p>...</p></h2>) 유효하지 않은 HTML이 되므로 벗겨낸다.
function unwrapParagraph(html: string): string {
  const match = /^<p>([\s\S]*)<\/p>$/.exec(html.trim())
  return match ? match[1] : html
}

function Viewer({ block }: BlockViewerProps<HeadingBlockData>) {
  const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3'
  return <Tag className={LEVEL_CLASS[block.level]} dangerouslySetInnerHTML={{ __html: unwrapParagraph(sanitizeHtml(block.html)) }} />
}

registerBlock<HeadingBlockData>({
  type: 'heading',
  label: '제목',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'heading', level: 2, html: '' }),
  Editor,
  Viewer,
})
