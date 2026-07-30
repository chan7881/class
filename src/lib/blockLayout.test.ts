import { describe, expect, it } from 'vitest'
import { groupBlocksIntoRows } from './blockLayout'
import type { Block, TextBlock } from '../types/lesson'

function text(id: string, layout?: 'full' | 'half'): TextBlock {
  return { id, type: 'text', html: '', ...(layout ? { layout } : {}) }
}

describe('groupBlocksIntoRows', () => {
  it('layout이 없으면(기존 수업) 전부 한 줄씩 따로 놓는다', () => {
    const blocks: Block[] = [text('a'), text('b'), text('c')]
    expect(groupBlocksIntoRows(blocks)).toEqual([[blocks[0]], [blocks[1]], [blocks[2]]])
  })

  it('연속된 half 블록 두 개는 한 행으로 묶인다', () => {
    const blocks: Block[] = [text('a', 'half'), text('b', 'half')]
    expect(groupBlocksIntoRows(blocks)).toEqual([[blocks[0], blocks[1]]])
  })

  it('half가 3개 연속이면 2개+1개로 나뉜다(세 번째는 다음 블록과 새로 짝짓기 시도)', () => {
    const blocks: Block[] = [text('a', 'half'), text('b', 'half'), text('c', 'half')]
    expect(groupBlocksIntoRows(blocks)).toEqual([[blocks[0], blocks[1]], [blocks[2]]])
  })

  it('full 블록은 앞뒤로 half 블록이 있어도 항상 혼자 한 행을 차지한다', () => {
    const blocks: Block[] = [text('a', 'half'), text('b', 'full'), text('c', 'half'), text('d', 'half')]
    expect(groupBlocksIntoRows(blocks)).toEqual([[blocks[0]], [blocks[1]], [blocks[2], blocks[3]]])
  })

  it('빈 배열은 빈 행 목록을 돌려준다', () => {
    expect(groupBlocksIntoRows([])).toEqual([])
  })
})
