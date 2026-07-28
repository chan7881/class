import type { ReactNode } from 'react'

/** 홈·에디터·플레이어·결과 화면이 공유하는 바깥 여백·최대폭. 모바일 우선(작은 화면이 기본, sm 이상에서 여유). */
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="safe-bottom mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6">{children}</div>
}
