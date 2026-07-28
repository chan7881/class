import { ChartRenderer } from '../components/ChartRenderer'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { ChartBlock as ChartBlockData, ChartSpec } from '../types/lesson'

function toRecharts(spec: ChartSpec): Record<string, string | number>[] {
  return spec.rows.map((row) => {
    const record: Record<string, string | number> = {}
    spec.columns.forEach((col, i) => {
      const raw = row[i] ?? ''
      const num = typeof raw === 'number' ? raw : Number(raw)
      record[col.key] = raw !== '' && !Number.isNaN(num) ? num : raw
    })
    return record
  })
}

function Editor({ block, onChange }: BlockEditorProps<ChartBlockData>) {
  const { spec } = block
  const updateSpec = (next: Partial<ChartSpec>) => onChange({ ...block, spec: { ...spec, ...next } })

  function addColumn() {
    const key = `col${spec.columns.length + 1}_${Date.now().toString(36)}`
    updateSpec({
      columns: [...spec.columns, { key, label: `열 ${spec.columns.length + 1}` }],
      rows: spec.rows.map((row) => [...row, '']),
    })
  }

  function removeColumn(index: number) {
    if (spec.columns.length <= 1) return
    const removedKey = spec.columns[index].key
    updateSpec({
      columns: spec.columns.filter((_, i) => i !== index),
      rows: spec.rows.map((row) => row.filter((_, i) => i !== index)),
      xKey: spec.xKey === removedKey ? spec.columns[0].key : spec.xKey,
      yKeys: spec.yKeys.filter((k) => k !== removedKey),
    })
  }

  function addRow() {
    updateSpec({ rows: [...spec.rows, spec.columns.map(() => '')] })
  }

  function removeRow(index: number) {
    updateSpec({ rows: spec.rows.filter((_, i) => i !== index) })
  }

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    updateSpec({ rows: spec.rows.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row)) })
  }

  function updateColumnLabel(index: number, label: string) {
    updateSpec({ columns: spec.columns.map((col, i) => (i === index ? { ...col, label } : col)) })
  }

  const yCandidates = spec.columns.filter((c) => c.key !== spec.xKey)

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          그래프 종류
          <select
            value={spec.chartType}
            onChange={(e) => updateSpec({ chartType: e.target.value as ChartSpec['chartType'] })}
            className="tap-target rounded border border-neutral-300 px-1"
          >
            <option value="line">꺾은선</option>
            <option value="bar">막대</option>
            <option value="scatter">산점도</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          가로축
          <select value={spec.xKey} onChange={(e) => updateSpec({ xKey: e.target.value })} className="tap-target rounded border border-neutral-300 px-1">
            {spec.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {spec.columns.map((col, i) => (
                <th key={col.key} className="border border-neutral-200 p-1">
                  <div className="flex items-center gap-1">
                    <input
                      value={col.label}
                      onChange={(e) => updateColumnLabel(i, e.target.value)}
                      className="w-20 min-w-0 flex-1 rounded border border-transparent px-1 text-center focus:border-neutral-300"
                    />
                    {spec.columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(i)} className="tap-target text-neutral-400 hover:text-danger" aria-label="열 삭제">
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="border border-neutral-200 p-1">
                <button type="button" onClick={addColumn} className="tap-target px-2 text-accent-500">
                  +열
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-neutral-200 p-1">
                    <input
                      value={String(cell)}
                      onChange={(e) => updateCell(r, c, e.target.value)}
                      className="w-20 rounded border border-transparent px-1 text-center focus:border-neutral-300"
                    />
                  </td>
                ))}
                <td className="border border-neutral-200 p-1 text-center">
                  <button type="button" onClick={() => removeRow(r)} className="tap-target text-neutral-400 hover:text-danger" aria-label="행 삭제">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addRow} className="tap-target mt-1 px-2 text-sm text-accent-500">
          +행
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span>표시할 값:</span>
        {yCandidates.map((col) => (
          <label key={col.key} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={spec.yKeys.includes(col.key)}
              onChange={(e) => updateSpec({ yKeys: e.target.checked ? [...spec.yKeys, col.key] : spec.yKeys.filter((k) => k !== col.key) })}
            />
            {col.label}
          </label>
        ))}
      </div>

      <div className="mt-3">
        <ChartRenderer type={spec.chartType} data={toRecharts(spec)} xKey={spec.xKey} yKeys={spec.yKeys} />
      </div>
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<ChartBlockData>) {
  return <ChartRenderer type={block.spec.chartType} data={toRecharts(block.spec)} xKey={block.spec.xKey} yKeys={block.spec.yKeys} />
}

registerBlock<ChartBlockData>({
  type: 'chart',
  label: '차트',
  icon: '📊',
  category: '미디어',
  createDefault: (id) => ({
    id,
    type: 'chart',
    spec: {
      chartType: 'line',
      columns: [
        { key: 'x', label: 'X' },
        { key: 'y', label: 'Y' },
      ],
      rows: [
        ['1', '2'],
        ['2', '4'],
        ['3', '6'],
      ],
      xKey: 'x',
      yKeys: ['y'],
    },
  }),
  Editor,
  Viewer,
})
