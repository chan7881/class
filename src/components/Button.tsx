import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface BaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /**
   * 'md'(기본) = 단독으로 서는 버튼, 'sm' = 표 행·헤더처럼 밀도 높은 자리.
   * sm이어도 .tap-target(44px)은 그대로라 시각적 크기만 줄고 터치 영역은 안 줄어든다
   * (CLAUDE.md 규칙 8). 이 variant가 없어서 여러 화면이 공용 버튼을 안 쓰고 인라인
   * 클래스로 직접 버튼을 만들어 쓰던 게 스타일이 제각각이 된 원인이었다.
   */
  size?: Size
  children: ReactNode
}

/**
 * 아이콘만 있는 버튼은 라벨을 눈으로 볼 수 없으니 aria-label을 반드시 받는다 —
 * 타입 수준에서 강제해서 "나중에 넣지 뭐"로 빠지는 걸 막는다.
 */
type ButtonProps =
  | (BaseProps & { iconOnly: true; 'aria-label': string })
  | (BaseProps & { iconOnly?: false })

// 모든 버튼은 이 팔레트 안에서만 색을 쓴다 — 새 색을 즉석에서 추가하지 않는다 (CLAUDE.md 디자인 원칙)
const variantClass: Record<Variant, string> = {
  primary: 'bg-accent-500 text-white hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500',
  secondary:
    'bg-neutral-0 text-neutral-900 border border-neutral-300 hover:bg-neutral-100 disabled:text-neutral-300',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300',
  danger: 'bg-danger text-white hover:opacity-90 disabled:bg-neutral-300 disabled:text-neutral-500',
}

const sizeClass: Record<Size, string> = {
  sm: 'rounded px-2 text-sm',
  md: 'rounded-lg px-4 text-base',
}

/** 터치 타깃 44px 이상을 보장하는 공통 버튼. 색은 항상 variant로만 고른다. */
export function Button({ variant = 'primary', size = 'md', iconOnly, className, children, ...rest }: ButtonProps) {
  const classes = [
    'tap-target inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed',
    sizeClass[size],
    // 아이콘 전용은 좌우 패딩을 없애 정사각형에 가깝게 만든다(가로 폭은 tap-target의 44px가 지킨다)
    iconOnly ? 'px-0' : '',
    variantClass[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}

/**
 * 링크(`<a>`)를 버튼처럼 보이게 할 때 쓰는 클래스 문자열. 관리자 화면의 "응답 시트"처럼
 * 실제로는 다른 페이지로 이동하는 것이라 시맨틱상 `<a>`여야 하는데 생김새는 옆 버튼들과
 * 같아야 하는 경우가 있다 — 그때 `<Button>`을 억지로 쓰는 대신 이 클래스를 공유한다.
 */
export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md'): string {
  return [
    'tap-target inline-flex items-center justify-center gap-2 font-medium transition-colors',
    sizeClass[size],
    variantClass[variant],
  ].join(' ')
}
