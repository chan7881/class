import { useState } from 'react'
import { listBlockDefinitions } from '../blocks/registry'
import type { BlockDefinition } from '../blocks/types'

interface SlashMenuProps {
  onSelect: (def: BlockDefinition) => void
  onClose: () => void
}

/** "+"로 여는 블록 삽입 메뉴. 문항 종류는 4단계부터 이 목록에 합류한다. */
export function SlashMenu({ onSelect, onClose }: SlashMenuProps) {
  const [query, setQuery] = useState('')
  const defs = listBlockDefinitions().filter((d) => d.label.includes(query))

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
          placeholder="블록 검색"
          className="tap-target mb-1 w-full rounded border border-neutral-200 px-2 text-sm outline-none focus:border-accent-500"
        />
        <ul className="max-h-64 overflow-y-auto">
          {defs.map((def) => (
            <li key={def.type}>
              <button
                type="button"
                onClick={() => onSelect(def)}
                className="tap-target flex w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-neutral-100"
              >
                <span aria-hidden>{def.icon}</span>
                {def.label}
              </button>
            </li>
          ))}
          {defs.length === 0 && <li className="px-2 py-2 text-sm text-neutral-400">일치하는 블록이 없어요</li>}
        </ul>
      </div>
    </>
  )
}
