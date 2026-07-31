import type { LucideIcon } from 'lucide-react'

/**
 * 아이콘 크기·굵기를 프로젝트 표준으로 고정하는 얇은 래퍼.
 *
 * 왜 래퍼를 두나: 호출부마다 `size={16} strokeWidth={2}`를 반복하면 값이 조금씩 어긋나
 * 아이콘 굵기가 화면마다 달라진다. 여기서 세 단계로만 고르게 한다.
 *
 * 색은 절대 여기서 정하지 않는다 — lucide 아이콘은 `stroke="currentColor"`가 기본이라
 * 감싸는 요소의 글자색을 그대로 따라간다. 그래서 다크모드에서 토큰이 뒤집히면 아이콘도
 * 같이 뒤집힌다(CLAUDE.md 규칙 9 — 단색 SVG만, 색 하드코딩 금지).
 */
const SIZES = { sm: 16, md: 20, lg: 24 } as const

export type IconSize = keyof typeof SIZES

interface IconProps {
  icon: LucideIcon
  size?: IconSize
  className?: string
}

export function Icon({ icon: LucideComponent, size = 'sm', className }: IconProps) {
  return (
    <LucideComponent
      size={SIZES[size]}
      strokeWidth={2}
      // 아이콘은 항상 라벨(텍스트나 aria-label)을 동반한다는 게 이 프로젝트 규칙이라,
      // 아이콘 자체는 보조 도형으로 취급해 접근성 트리에서 감춘다 — 안 그러면 스크린리더가
      // 버튼 이름을 두 번 읽는다.
      aria-hidden="true"
      focusable="false"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    />
  )
}
