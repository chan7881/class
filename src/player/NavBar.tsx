interface NavBarProps {
  canGoBack: boolean
  isLast: boolean
  nextLocked: boolean
  /** feedbackMode 'onSlideLeave' 문항의 정오답을 아직 안 보여줬을 때 — 이번 클릭은 이동 대신 공개만 한다 */
  pendingReveal?: boolean
  onBack: () => void
  onNext: () => void
}

/**
 * "다음"은 미응답이 있으면 잠긴 것처럼 흐리게 보이지만 실제로는 클릭할 수 있게 둔다 —
 * 그래야 클릭했을 때 Player.tsx가 토스트+스크롤로 "왜 안 되는지"를 알려줄 수 있다.
 * (네이티브 disabled 버튼은 클릭 이벤트 자체가 막혀 이 피드백을 줄 수 없다)
 */
export function NavBar({ canGoBack, isLast, nextLocked, pendingReveal, onBack, onNext }: NavBarProps) {
  return (
    <div className="safe-bottom sticky bottom-0 flex items-center justify-between border-t border-neutral-200 bg-neutral-0 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        className="tap-target rounded-lg border border-neutral-300 bg-neutral-0 px-4 text-base font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        이전
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-disabled={nextLocked}
        // 잠긴 상태는 배경(neutral-300)이 두 모드에서 뒤집히므로 글자색도 같이 뒤집히는
        // 토큰을 써야 한다. accent-500은 뒤집히지 않는 색이라 그 위에서는 흰 글자가 맞다.
        className={`tap-target rounded-lg px-4 text-base font-medium transition-colors ${
          nextLocked ? 'bg-neutral-300 text-neutral-500' : 'bg-accent-500 text-white hover:bg-accent-600'
        }`}
      >
        {pendingReveal ? '정답 확인' : isLast ? '제출하기' : '다음'}
      </button>
    </div>
  )
}
