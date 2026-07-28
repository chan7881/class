import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

// 모든 버튼은 이 팔레트 안에서만 색을 쓴다 — 새 색을 즉석에서 추가하지 않는다 (CLAUDE.md 디자인 원칙)
const variantClass: Record<Variant, string> = {
  primary: 'bg-accent-500 text-white hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500',
  secondary:
    'bg-neutral-0 text-neutral-900 border border-neutral-300 hover:bg-neutral-100 disabled:text-neutral-300',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300',
  danger: 'bg-danger text-white hover:opacity-90 disabled:bg-neutral-300 disabled:text-neutral-500',
}

/** 터치 타깃 44px 이상을 보장하는 공통 버튼. 색은 항상 variant로만 고른다. */
export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  const classes = [
    'tap-target inline-flex items-center justify-center gap-2 rounded-lg px-4 text-base font-medium transition-colors disabled:cursor-not-allowed',
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
