import { useRef, useState } from 'react'
import { Accordion } from '../components/Accordion'
import { ChartRenderer } from '../components/ChartRenderer'
import { parseSpreadsheetFile, SpreadsheetParseError, SpreadsheetTooLargeError } from '../lib/spreadsheet'
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

/** 엑셀/CSV에서 행·열 범위를 골라 ChartSpec으로 가져오는 아코디언 — chart 참고 레포의
 *  "업로드 → 행/열 선택 → 그래프 종류 선택" 흐름을 간소화해 이식했다. 학생에게는 이 설정
 *  자체가 보이지 않는다(Editor만 렌더링, 학생 화면은 Viewer만 씀). */
function SpreadsheetImport({ onImport }: { onImport: (spec: Pick<ChartSpec, 'columns' | 'rows' | 'xKey' | 'yKeys'>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [grid, setGrid] = useState<(string | number)[][] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [rowStart, setRowStart] = useState(1)
  const [rowEnd, setRowEnd] = useState(1)
  const [colStart, setColStart] = useState(1)
  const [colEnd, setColEnd] = useState(1)

  const dataRows = grid ? (hasHeader ? grid.slice(1) : grid) : []
  const headerRow = grid && hasHeader ? grid[0] : null

  async function handleFile(file: File) {
    setError(null)
    try {
      const parsed = await parseSpreadsheetFile(file)
      if (parsed.length === 0) {
        setError('시트에 데이터가 없어요.')
        return
      }
      setGrid(parsed)
      const dr = hasHeader ? parsed.slice(1) : parsed
      setRowStart(1)
      setRowEnd(Math.max(1, dr.length))
      setColStart(1)
      setColEnd(Math.max(1, parsed[0]?.length ?? 1))
    } catch (e) {
      if (e instanceof SpreadsheetTooLargeError || e instanceof SpreadsheetParseError) setError(e.message)
      else setError('파일을 읽지 못했습니다')
    }
  }

  function apply() {
    if (!grid) return
    const cs = Math.max(1, Math.min(colStart, colEnd))
    const ce = Math.max(colStart, colEnd)
    const rs = Math.max(1, Math.min(rowStart, rowEnd))
    const re = Math.max(rowStart, rowEnd)

    const colIndices = Array.from({ length: ce - cs + 1 }, (_, i) => cs - 1 + i).filter((i) => i < (grid[0]?.length ?? 0))
    const columns = colIndices.map((i, n) => ({
      key: `col${n + 1}_${Date.now().toString(36)}`,
      label: headerRow ? String(headerRow[i] ?? `열${n + 1}`) : `열${n + 1}`,
    }))
    const rows = dataRows.slice(rs - 1, re).map((row) => colIndices.map((i) => row[i] ?? ''))

    onImport({
      columns,
      rows,
      xKey: columns[0]?.key ?? '',
      yKeys: columns.slice(1).map((c) => c.key),
    })
  }

  return (
    <Accordion title="엑셀/CSV에서 데이터 가져오기">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => inputRef.current?.click()} className="tap-target rounded border border-neutral-300 px-3 text-neutral-600">
          파일 선택 (.xlsx, .csv)
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => {
              setHasHeader(e.target.checked)
              if (grid) {
                const dr = e.target.checked ? grid.slice(1) : grid
                setRowStart(1)
                setRowEnd(Math.max(1, dr.length))
              }
            }}
          />
          첫 행을 열 이름으로 사용
        </label>
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      {grid && (
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-neutral-500">가져올 행</span>
            <input
              type="number"
              min={1}
              max={dataRows.length}
              value={rowStart}
              onChange={(e) => setRowStart(Number(e.target.value) || 1)}
              className="tap-target w-16 rounded border border-neutral-300 px-1 text-center"
            />
            ~
            <input
              type="number"
              min={1}
              max={dataRows.length}
              value={rowEnd}
              onChange={(e) => setRowEnd(Number(e.target.value) || 1)}
              className="tap-target w-16 rounded border border-neutral-300 px-1 text-center"
            />
            <span className="text-neutral-400">(전체 {dataRows.length}행)</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-neutral-500">가져올 열</span>
            <input
              type="number"
              min={1}
              max={grid[0]?.length ?? 1}
              value={colStart}
              onChange={(e) => setColStart(Number(e.target.value) || 1)}
              className="tap-target w-16 rounded border border-neutral-300 px-1 text-center"
            />
            ~
            <input
              type="number"
              min={1}
              max={grid[0]?.length ?? 1}
              value={colEnd}
              onChange={(e) => setColEnd(Number(e.target.value) || 1)}
              className="tap-target w-16 rounded border border-neutral-300 px-1 text-center"
            />
            <span className="text-neutral-400">(전체 {grid[0]?.length ?? 0}열)</span>
          </div>
          <button type="button" onClick={apply} className="tap-target self-start rounded bg-accent-500 px-3 text-white">
            표에 적용
          </button>
        </div>
      )}
    </Accordion>
  )
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
      <SpreadsheetImport onImport={(next) => updateSpec(next)} />

      <Accordion title="그래프 설정" defaultOpen>
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
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
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
      </Accordion>

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
