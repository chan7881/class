import { RichTextEditor } from '../richtext/RichTextEditor'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { CalloutBlock as CalloutBlockData } from '../types/lesson'

const TONE_STYLE: Record<CalloutBlockData['tone'], { className: string }> = {
  info: { className: 'border-accent-500 bg-accent-50 text-neutral-900' },
  tip: { className: 'border-success bg-green-50 text-neutral-900' },
  warn: { className: 'border-warn bg-amber-50 text-neutral-900' },
}

function Editor({ block, onChange }: BlockEditorProps<CalloutBlockData>) {
  const { className } = TONE_STYLE[block.tone]
  return (
    <div className={`flex gap-2 rounded-lg border-l-4 p-3 ${className}`}>
      <select
        className="tap-target h-8 rounded border border-neutral-200 bg-neutral-0 px-1 text-sm"
        value={block.tone}
        onChange={(e) => onChange({ ...block, tone: e.target.value as CalloutBlockData['tone'] })}
      >
        <option value="info">안내</option>
        <option value="tip">팁</option>
        <option value="warn">주의</option>
      </select>
      <div className="flex-1">
        <RichTextEditor html={block.html} onChange={(html) => onChange({ ...block, html })} placeholder="안내할 내용을 입력하세요" />
      </div>
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<CalloutBlockData>) {
  const { className } = TONE_STYLE[block.tone]
  return (
    <div className={`rounded-lg border-l-4 p-3 ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }} />
  )
}

registerBlock<CalloutBlockData>({
  type: 'callout',
  label: '콜아웃',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'callout', tone: 'info', html: '' }),
  Editor,
  Viewer,
})
