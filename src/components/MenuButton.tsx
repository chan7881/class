import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

const MenuContext = createContext<{ close: () => void } | null>(null)

interface MenuButtonProps {
  /** 트리거 버튼 안에 보일 내용 (아이콘 + 라벨) */
  label: ReactNode
  /** 트리거만 있고 라벨 텍스트가 안 보이는 경우를 위해 */
  ariaLabel?: string
  /** 드롭다운을 트리거의 어느 쪽 끝에 맞출지. 헤더 오른쪽에 붙는 메뉴는 'right'가 화면 밖으로 안 나간다 */
  align?: 'left' | 'right'
  triggerClassName?: string
  children: ReactNode
}

/**
 * 라이브러리 없이 만든 오버플로 메뉴. Escape·바깥 클릭으로 닫히고, 항목을 고르면 자동으로 닫힌다.
 *
 * ⚠️ 드롭다운은 `position: absolute`라 **감싸는 요소에 `overflow-hidden`이 걸리면 잘린다**.
 * 이 메뉴를 새 위치에 넣을 때 부모의 overflow를 먼저 확인할 것.
 */
export function MenuButton({ label, ariaLabel, align = 'right', triggerClassName, children }: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    // pointerdown을 쓰는 이유: 메뉴 항목의 click보다 먼저 발생해서, 바깥을 눌러 닫는 동작과
    // 항목을 골라 실행하는 동작이 서로 잡아먹지 않는다. 안쪽이면 아무것도 안 하고 각 항목의
    // onClick(→ close)에게 넘긴다.
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus() // 포커스가 허공에 남지 않게 트리거로 되돌린다
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // 열리자마자 첫 항목으로 포커스를 옮겨 키보드만으로도 바로 고를 수 있게 한다.
    rootRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          'tap-target inline-flex items-center justify-center gap-1 rounded px-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100'
        }
      >
        {label}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          // max-w는 좁은 화면에서 메뉴가 화면 밖으로 삐져나가지 않게 하는 안전장치.
          className={`absolute top-full z-50 mt-1 max-w-[calc(100vw-1.5rem)] min-w-44 rounded-lg border border-neutral-200 bg-neutral-0 py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <MenuContext.Provider value={{ close: () => setOpen(false) }}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  )
}

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 값을 주면 켜짐/꺼짐이 있는 토글 항목이 된다(편집 키 보기·설정처럼 패널을 여닫는 것) */
  checked?: boolean
  children: ReactNode
}

/** 메뉴 안 항목 하나 — onClick을 실행한 뒤 메뉴가 자동으로 닫힌다. */
export function MenuItem({ checked, className, children, onClick, ...rest }: MenuItemProps) {
  const ctx = useContext(MenuContext)
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      onClick={(e) => {
        onClick?.(e)
        ctx?.close()
      }}
      className={
        className ??
        'tap-target flex w-full items-center gap-2 px-3 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40'
      }
      {...rest}
    >
      {children}
    </button>
  )
}
