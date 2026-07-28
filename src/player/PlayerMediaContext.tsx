import { createContext, useContext } from 'react'

/** 사진·그리기 답안이 uploadStudentMedia(code, ...)를 부를 때 필요한 code를 제공한다 (예: PhotoBlock). */
export const PlayerMediaContext = createContext<{ code: string } | null>(null)

export function usePlayerCode(): string {
  const ctx = useContext(PlayerMediaContext)
  if (!ctx) throw new Error('usePlayerCode는 PlayerMediaContext.Provider 안에서만 쓸 수 있습니다')
  return ctx.code
}
