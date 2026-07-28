import { createContext, useContext } from 'react'

export interface EditorAuth {
  code: string
  editToken: string
}

/** 이미지 업로드 등 code+editToken이 필요한 블록 Editor들이 쓴다 (예: ImageBlock) */
export const EditorAuthContext = createContext<EditorAuth | null>(null)

export function useEditorAuth(): EditorAuth {
  const ctx = useContext(EditorAuthContext)
  if (!ctx) throw new Error('useEditorAuth는 EditorAuthContext.Provider 안에서만 쓸 수 있습니다')
  return ctx
}
