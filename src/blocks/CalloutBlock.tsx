import { RichTextEditor } from '../richtext/RichTextEditor'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { CalloutBlock as CalloutBlockData } from '../types/lesson'

const TONE_STYLE: Record<CalloutBlockData['tone'], { icon: string; className: string }> = {
  info: { icon: 'ℹ️', className: 'border-accent-500 bg-accent-50 text-neutral-900' },
  tip: { icon: '💡', className: 'border-success bg-green-50 text-neutral-900' },
  warn: { icon: '⚠️', className: 'border-warn bg-amber-50 text-neutral-900' },
}

function Editor({ block, onChange }: BlockEditorProps<CalloutBlockData>) {
  const { className } = TONE_STYLE[block.tone]
  return (
    <div className={`flex gap-2 rounded-lg border-l-4 p-3 ${className}`}>
      <select
        className="tap-target h-8 rounded border border-neutral-200 bg-white px-1 text-sm"
        value={block.tone}
        onChange={(e) => onChange({ ...block, tone: e.target.value as CalloutBlockData['tone'] })}
      >
        <option value="info">ℹ️ 안내</option>
        <option value="tip">💡 팁</option>
        <option value="warn">⚠️ 주의</option>
      </select>
      <div className="flex-1">
        <RichTextEditor html={block.html} onChange={(html) => onChange({ ...block, html })} placeholder="안내할 내용을 입력하세요" />
      </div>
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<CalloutBlockData>) {
  const { icon, className } = TONE_STYLE[block.tone]
  return (
    <div className={`flex gap-2 rounded-lg border-l-4 p-3 ${className}`}>
      <span aria-hidden>{icon}</span>
      <div className="flex-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }} />
    </div>
  )
}

registerBlock<CalloutBlockData>({
  type: 'callout',
  label: '콜아웃',
  icon: '💡',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'callout', tone: 'info', html: '' }),
  Editor,
  Viewer,
})
