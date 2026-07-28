import { RichTextEditor } from '../richtext/RichTextEditor'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { TextBlock as TextBlockData } from '../types/lesson'

function Editor({ block, onChange }: BlockEditorProps<TextBlockData>) {
  return <RichTextEditor html={block.html} onChange={(html) => onChange({ ...block, html })} />
}

function Viewer({ block }: BlockViewerProps<TextBlockData>) {
  return <div className="max-w-none text-base leading-[1.7]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }} />
}

registerBlock<TextBlockData>({
  type: 'text',
  label: '텍스트',
  icon: '📝',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'text', html: '' }),
  Editor,
  Viewer,
})
