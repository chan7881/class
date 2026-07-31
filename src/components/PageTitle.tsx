import type { ReactNode } from 'react'

/**
 * 화면 최상단 제목의 규격. 지금까지 페이지마다 `text-2xl font-bold`와 `text-xl font-semibold`가
 * 섞여 있어서 화면을 옮길 때마다 제목 크기가 들쭉날쭉했다 — 여기 하나로 모아 재발을 막는다.
 *
 * 에디터 편집 화면의 제목만 예외로 `<input>`을 그대로 쓴다(제목을 그 자리에서 고치는 게
 * 그 화면의 핵심 동작이라 텍스트로 바꿀 수 없다) — 대신 글자 크기만 여기와 똑같이 맞춰둔다.
 */
export function PageTitle({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'danger' }) {
  return <h1 className={`text-2xl font-bold ${tone === 'danger' ? 'text-danger' : ''}`}>{children}</h1>
}
