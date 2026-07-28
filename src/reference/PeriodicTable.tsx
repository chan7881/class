import { useState } from 'react'
import { CATEGORY_COLORS, ELEMENTS } from '../data/periodic'
import type { Element } from '../data/periodic'

export function PeriodicTable() {
  const [selected, setSelected] = useState<Element | null>(null)

  return (
    <div>
      <div className="grid gap-0.5 overflow-x-auto text-[10px]" style={{ gridTemplateColumns: 'repeat(18, minmax(1.6rem, 1fr))' }}>
        {ELEMENTS.map((el) => (
          <button
            key={el.number}
            type="button"
            onClick={() => setSelected(el)}
            style={{ gridRow: el.row, gridColumn: el.col, backgroundColor: CATEGORY_COLORS[el.category] }}
            className="tap-target flex aspect-square flex-col items-center justify-center rounded text-white"
            aria-label={`${el.nameKo} (${el.symbol})`}
          >
            <span className="leading-none">{el.number}</span>
            <span className="text-xs font-semibold leading-none">{el.symbol}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-neutral-200 p-3 text-sm">
          <p className="text-lg font-semibold">
            {selected.symbol} · {selected.nameKo}
          </p>
          <p className="mt-1 text-neutral-500">
            원자번호 {selected.number} · {selected.category}
          </p>
        </div>
      )}
    </div>
  )
}
