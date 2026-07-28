import type { ComponentType } from 'react'
import type { Block } from '../types/lesson'

export interface BlockEditorProps<B extends Block> {
  block: B
  onChange: (next: B) => void
}

export interface BlockViewerProps<B extends Block> {
  block: B
}

export interface BlockDefinition<B extends Block = Block> {
  type: B['type']
  label: string
  icon: string
  category: '콘텐츠' | '미디어'
  createDefault: (id: string) => B
  Editor: ComponentType<BlockEditorProps<B>>
  Viewer: ComponentType<BlockViewerProps<B>>
}
