import { listBlockDefinitions } from '../blocks/registry'
import { listQuestionDefinitions } from '../blocks/questions/registry'
import type { Block } from '../types/lesson'

export interface InsertableItem {
  key: string
  label: string
  icon: string
  build: () => Block
}

/** 슬래시 메뉴가 보여줄 전체 목록 — 콘텐츠 블록(blocks/registry.ts) + 문항 kind(blocks/questions/registry.ts)를 합친다. */
export function listInsertableItems(): InsertableItem[] {
  const blockItems: InsertableItem[] = listBlockDefinitions().map((def) => ({
    key: def.type,
    label: def.label,
    icon: def.icon,
    build: () => def.createDefault(crypto.randomUUID()),
  }))

  const questionItems: InsertableItem[] = listQuestionDefinitions().map((def) => ({
    key: `question:${def.kind}`,
    label: def.label,
    icon: def.icon,
    build: (): Block => ({ id: crypto.randomUUID(), type: 'question', q: def.createDefault(crypto.randomUUID()) }),
  }))

  return [...blockItems, ...questionItems]
}
