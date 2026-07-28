/** 잠깐 떴다 사라지는 하단 안내 배너. message가 null이면 아무것도 렌더링하지 않는다. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">{message}</div>
    </div>
  )
}
