/** 잠깐 떴다 사라지는 하단 안내 배너. message가 null이면 아무것도 렌더링하지 않는다. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      {/* 배경(neutral-900)이 다크모드에서 밝은색으로 뒤집히므로 글자도 같이 뒤집히는
          text-neutral-0을 써야 한다. text-white로 두면 다크모드에서 흰 배경에 흰 글자가 된다. */}
      <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-neutral-0 shadow-lg">{message}</div>
    </div>
  )
}
