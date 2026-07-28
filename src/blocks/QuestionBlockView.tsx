import { getQuestionDefinition } from './questions/registry'
import type { QuestionBlock } from '../types/lesson'

interface QuestionBlockEditorProps {
  block: QuestionBlock
  onChange: (next: QuestionBlock) => void
}

/** 'question' 블록은 kind가 12종이라 자기 Editor/Viewer를 안 갖고, q.kind로 questions 레지스트리에 위임한다. */
export function QuestionBlockEditor({ block, onChange }: QuestionBlockEditorProps) {
  const def = getQuestionDefinition(block.q.kind)
  if (!def) return <p className="rounded bg-neutral-100 p-2 text-sm text-danger">알 수 없는 문항 유형: {block.q.kind}</p>
  return <def.Editor question={block.q} onChange={(q) => onChange({ ...block, q })} />
}

interface QuestionBlockViewerProps {
  block: QuestionBlock
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

export function QuestionBlockViewer({ block, value, onChange, disabled }: QuestionBlockViewerProps) {
  const def = getQuestionDefinition(block.q.kind)
  if (!def) return null
  return <def.Viewer question={block.q} value={value} onChange={onChange} disabled={disabled} />
}
