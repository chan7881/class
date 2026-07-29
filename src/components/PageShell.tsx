import type { ReactNode } from 'react'

/** 홈·에디터·플레이어·결과 화면이 공유하는 바깥 여백·최대폭. 모바일 우선(작은 화면이 기본, sm 이상에서 여유). */
export function PageShell({ children }: { children: ReactNode }) {
  // min-h-dvh(동적 뷰포트 높이) — 모바일 브라우저 주소창이 나타났다 사라졌다 하며 실제 보이는
  // 높이가 바뀌는데, min-h-screen(100vh)은 이걸 반영 못 해 콘텐츠가 길어지면 스크롤이 어색해진다.
  return <div className="safe-bottom mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6">{children}</div>
}
