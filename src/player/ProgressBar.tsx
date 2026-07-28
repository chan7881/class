import { computeSlideNumbers } from '../lib/numbering'
import type { Slide } from '../types/lesson'

/** 지금은 분기가 없어(9단계 예정) 전체 슬라이드 수 기준으로 계산한다. */
export function ProgressBar({ slides, currentIndex }: { slides: Slide[]; currentIndex: number }) {
  const numbers = computeSlideNumbers(slides)
  const percent = slides.length > 0 ? ((currentIndex + 1) / slides.length) * 100 : 0

  return (
    <div className="w-full px-4 pt-2">
      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-accent-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-neutral-400">
        {numbers[currentIndex]} / {slides.length}
      </p>
    </div>
  )
}
