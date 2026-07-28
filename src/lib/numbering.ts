import type { Slide } from '../types/lesson'

/**
 * 슬라이드 배열에서 "3", "4-1", "4-2" 같은 표시 번호를 계산한다.
 * 번호는 데이터에 저장하지 않고 배열에서 매번 다시 계산한다 (docs/PLAN.md 10번 항목).
 */
export function computeSlideNumbers(slides: Slide[]): string[] {
  const numbers: string[] = []
  let mainCount = 0
  let subCount = 0

  for (const slide of slides) {
    if (slide.isSub) {
      subCount += 1
      numbers.push(`${mainCount}-${subCount}`)
    } else {
      mainCount += 1
      subCount = 0
      numbers.push(`${mainCount}`)
    }
  }

  return numbers
}
