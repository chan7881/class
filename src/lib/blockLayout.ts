import type { Block } from '../types/lesson'

/**
 * 슬라이드의 블록 목록을 화면에 그릴 "행" 단위로 묶는다. `layout: 'half'`로 표시된 블록이
 * 배열에서 연속으로 나오면 최대 2개씩 한 행에 나란히 놓고, 그 외(생략·'full')는 항상 혼자
 * 한 행을 차지한다 — 이미지·텍스트처럼 가로 공간을 덜 차지하는 블록을 2단으로 배치하고
 * 싶다는 요청(2026-07-30)에 대응한다. 에디터 캔버스와 학생 플레이어가 이 함수 하나를
 * 같이 써서 편집 화면과 실제로 보이는 모양이 어긋나지 않게 한다.
 */
export function groupBlocksIntoRows(blocks: Block[]): Block[][] {
  const rows: Block[][] = []
  let i = 0
  while (i < blocks.length) {
    const current = blocks[i]
    const next = blocks[i + 1]
    if (current.layout === 'half' && next?.layout === 'half') {
      rows.push([current, next])
      i += 2
    } else {
      rows.push([current])
      i += 1
    }
  }
  return rows
}
