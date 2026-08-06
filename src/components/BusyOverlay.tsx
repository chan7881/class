import { Loader2 } from 'lucide-react'
import { Icon } from './Icon'

/**
 * 시간이 걸리는 작업 중에 화면 전체를 덮는 안내창.
 *
 * 왜 필요한가: 이 앱의 백엔드는 Apps Script라 한 번 왕복에 1~3초가 걸리는 일이 흔하다.
 * 그동안 화면이 아무 반응이 없으면 사용자는 버튼이 안 눌린 줄 알고 다시 누른다 — 제출이
 * 두 번 되거나, 삭제를 두 번 누르는 사고로 이어진다. 그래서 "지금 처리 중"을 반드시 보여주고,
 * 겸사겸사 오버레이가 뒤쪽 버튼을 물리적으로 막아 중복 클릭 자체를 차단한다.
 *
 * `role="status"` + `aria-live="polite"`로 화면을 읽어주는 사용자에게도 알린다.
 * 스피너 아이콘만으로는 의미가 전달되지 않으므로 문구를 항상 함께 둔다(CLAUDE.md 규칙 9).
 */
export function BusyOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40" role="status" aria-live="polite">
      <div className="mx-4 flex flex-col items-center gap-3 rounded-xl bg-neutral-0 px-8 py-6 shadow-lg">
        <Icon icon={Loader2} size="lg" className="animate-spin text-accent-ink" />
        <p className="text-center text-sm font-medium text-neutral-700">{message}</p>
      </div>
    </div>
  )
}
