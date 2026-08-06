import { useState } from 'react'
import { CATEGORY_COLORS, ELEMENTS } from '../data/periodic'
import { parseColor, relativeLuminance } from '../lib/richTextColor'
import type { Element } from '../data/periodic'

/**
 * 칸 색이 밝으면 검은 글자, 어두우면 흰 글자를 쓴다.
 * 원소 분류 색은 노랑(#eda100)처럼 밝은 것부터 남색까지 밝기 차이가 커서, 전부 흰 글자로
 * 두면 밝은 칸의 기호가 2.2:1까지 떨어져 읽기 어려웠다(2026-08-06 대비 점검).
 * 분류 색 자체는 다크모드에서도 그대로 두는 색이라 이 판정도 모드와 무관하다.
 */
function inkFor(background: string): string {
  const rgb = parseColor(background)
  if (!rgb) return '#ffffff'
  // 0.179는 흰 글자와 검은 글자의 대비가 같아지는 지점이다((L+0.05)² = 1.05×0.05).
  // 이 값을 경계로 고르면 어떤 배경색이든 둘 중 나은 쪽이 뽑혀 최소 4.5:1이 보장된다.
  return relativeLuminance(rgb) > 0.179 ? '#18181b' : '#ffffff'
}

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
            style={{
              gridRow: el.row,
              gridColumn: el.col,
              backgroundColor: CATEGORY_COLORS[el.category],
              color: inkFor(CATEGORY_COLORS[el.category]),
            }}
            className="tap-target flex aspect-square flex-col items-center justify-center rounded"
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
