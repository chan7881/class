import { computeSlideNumbers } from '../lib/numbering'
import type { Slide } from '../types/lesson'

/**
 * 메인 슬라이드 기준으로 진행률을 계산한다 — 보조 슬라이드(4-1, 4-2 …)로 분기해 들어가도
 * 퍼센트가 요동치지 않고, 현재 위치는 그 보조 슬라이드 번호("4-1")로 그대로 보여준다
 * (docs/PLAN.md 10번 항목).
 */
export function ProgressBar({ slides, currentIndex }: { slides: Slide[]; currentIndex: number }) {
  const numbers = computeSlideNumbers(slides)
  const mainTotal = slides.filter((s) => !s.isSub).length
  const mainCountUpToCurrent = slides.slice(0, currentIndex + 1).filter((s) => !s.isSub).length
  const percent = mainTotal > 0 ? (mainCountUpToCurrent / mainTotal) * 100 : 0

  return (
    <div className="w-full px-4 pt-2">
      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-accent-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-neutral-400">
        {numbers[currentIndex]} / {mainTotal}
      </p>
    </div>
  )
}
