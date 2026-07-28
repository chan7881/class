import type { Block, BlockType } from '../types/lesson'
import type { BlockDefinition } from './types'

/**
 * type → {label, icon, defaultData, Editor, Viewer} 매핑 (CLAUDE.md 규칙 1).
 * 'question' 타입은 여기 없다 — 문항은 kind가 12종이라 src/blocks/questions/registry.ts가
 * 따로 관리하고, 슬래시 메뉴는 이 레지스트리와 문항 레지스트리를 합쳐서 보여준다.
 *
 * 새 콘텐츠 블록을 추가하려면: 파일 하나 만들고 `registerBlock(definition)`을 호출하면 끝.
 * src/blocks/index.ts에 import 한 줄만 추가하면 슬래시 메뉴·캔버스·미리보기에 전부 나타난다.
 */
const registry = new Map<BlockType, BlockDefinition<any>>()

export function registerBlock<B extends Block>(definition: BlockDefinition<B>): void {
  registry.set(definition.type, definition)
}

export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return registry.get(type)
}

export function listBlockDefinitions(): BlockDefinition[] {
  return [...registry.values()]
}
