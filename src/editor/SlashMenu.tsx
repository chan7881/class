import { useState } from 'react'
import { listInsertableItems } from './menuItems'
import type { InsertableItem } from './menuItems'

interface SlashMenuProps {
  onSelect: (item: InsertableItem) => void
  onClose: () => void
}

/** "+"로 여는 블록·문항 삽입 메뉴. 콘텐츠 블록과 문항 6종이 한 목록에 같이 나온다. */
export function SlashMenu({ onSelect, onClose }: SlashMenuProps) {
  const [query, setQuery] = useState('')
  const items = listInsertableItems().filter((it) => it.label.includes(query))

  return (
    <>
      {/* 바깥을 클릭하면 닫히는 투명 배경 */}
      <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={onClose} aria-label="메뉴 닫기" tabIndex={-1} />
      <div className="absolute z-20 mt-1 w-56 rounded-lg border border-neutral-300 bg-white p-1 shadow-lg">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="블록·문항 검색"
          className="tap-target mb-1 w-full rounded border border-neutral-200 px-2 text-sm outline-none focus:border-accent-500"
        />
        <ul className="max-h-64 overflow-y-auto">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="tap-target flex w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-neutral-100"
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-2 py-2 text-sm text-neutral-400">일치하는 항목이 없어요</li>}
        </ul>
      </div>
    </>
  )
}
