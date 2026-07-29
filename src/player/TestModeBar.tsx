interface TestModeBarProps {
  showAnswers: boolean
  onToggleShowAnswers: () => void
  onRestart: () => void
}

/** 교사 테스트 모드 전용 배너 (docs/PLAN.md 「교사 미리보기/테스트 모드」 절). */
export function TestModeBar({ showAnswers, onToggleShowAnswers, onRestart }: TestModeBarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
      <span className="font-medium">테스트 모드 — 이 링크에는 편집 키가 들어 있어요. 학생에게 공유하지 마세요.</span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showAnswers} onChange={onToggleShowAnswers} />
          정답 보기
        </label>
        <button
          type="button"
          onClick={onRestart}
          className="tap-target rounded border border-amber-400 bg-neutral-0 px-2 py-1 text-amber-900"
        >
          처음부터 다시
        </button>
      </div>
    </div>
  )
}
