import { registerBlock } from './registry'
import type { DividerBlock as DividerBlockData } from '../types/lesson'

function View() {
  return <hr className="my-2 border-neutral-200" />
}

registerBlock<DividerBlockData>({
  type: 'divider',
  label: '구분선',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'divider' }),
  Editor: View,
  Viewer: View,
})
