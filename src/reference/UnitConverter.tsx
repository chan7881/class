import { useState } from 'react'
import { COMMON_UNITS, toBaseValue, unitsAreCompatible } from '../lib/units'

export function UnitConverter() {
  const [value, setValue] = useState('1')
  const [from, setFrom] = useState<string>(COMMON_UNITS[0])
  const [to, setTo] = useState<string>(COMMON_UNITS[1])

  const num = Number(value)
  const compatible = unitsAreCompatible(from, to)
  const base = compatible && Number.isFinite(num) ? toBaseValue(num, from) : null
  const factorTo = compatible ? toBaseValue(1, to) : null
  const result = base !== null && factorTo ? base / factorTo : null

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="tap-target w-24 rounded border border-neutral-300 px-2"
        />
        <select value={from} onChange={(e) => setFrom(e.target.value)} className="tap-target rounded border border-neutral-300 px-1">
          {COMMON_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span>=</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} className="tap-target rounded border border-neutral-300 px-1">
          {COMMON_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-lg font-medium">
        {result !== null ? `${Number(result.toPrecision(6))} ${to}` : compatible ? '값을 입력하세요' : '서로 환산할 수 없는 단위예요'}
      </p>
    </div>
  )
}
