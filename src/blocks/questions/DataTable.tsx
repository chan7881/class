import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { Accordion } from '../../components/Accordion'
import { ChartRenderer } from '../../components/ChartRenderer'
import { computeColumns } from '../../lib/dataTableCompute'
import { linearRegression } from '../../lib/regression'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { DataTableColumn, DataTableQuestion } from '../../types/lesson'

interface DataTableAnswerValue {
  cells: string[][] // [row][columnIndex] 원본 입력 (계산 열은 매번 재계산하므로 여기 저장 안 함)
}

function emptyCells(rowCount: number, columnCount: number): string[][] {
  return Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''))
}

// ── 교사 편집 화면 ────────────────────────────────────────────────────

function Editor({ question, onChange }: QuestionEditorProps<DataTableQuestion>) {
  function updateColumn(i: number, patch: Partial<DataTableColumn>) {
    onChange({ ...question, columns: question.columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
  }
  function addColumn() {
    const key = String.fromCharCode(65 + question.columns.length) // A, B, C…
    onChange({ ...question, columns: [...question.columns, { key, label: `열 ${question.columns.length + 1}`, type: 'number' }] })
  }
  function removeColumn(i: number) {
    if (question.columns.length <= 1) return
    onChange({ ...question, columns: question.columns.filter((_, idx) => idx !== i) })
  }

  const numericColumns = question.columns.filter((c) => c.type !== 'text')

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <p className="text-sm font-medium text-neutral-600">열 구성</p>
      <div className="mt-1 flex flex-col gap-2">
        {question.columns.map((col, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1 rounded border border-neutral-200 p-2 text-sm">
            <input
              value={col.key}
              onChange={(e) => updateColumn(i, { key: e.target.value })}
              placeholder="열 키(예: A)"
              className="tap-target w-16 rounded border border-neutral-300 px-1"
            />
            <input
              value={col.label}
              onChange={(e) => updateColumn(i, { label: e.target.value })}
              placeholder="라벨"
              className="tap-target w-28 flex-1 rounded border border-neutral-300 px-1"
            />
            <select
              value={col.type}
              onChange={(e) => updateColumn(i, { type: e.target.value as DataTableColumn['type'] })}
              className="tap-target rounded border border-neutral-300 px-1"
            >
              <option value="number">숫자(학생 입력)</option>
              <option value="text">텍스트(학생 입력)</option>
              <option value="computed">계산(자동)</option>
            </select>
            {col.type === 'computed' && (
              <input
                value={col.formula ?? ''}
                onChange={(e) => updateColumn(i, { formula: e.target.value })}
                placeholder="수식 (예: A / B, avg(A))"
                className="tap-target w-36 rounded border border-neutral-300 px-1"
              />
            )}
            <input
              value={col.unit ?? ''}
              onChange={(e) => updateColumn(i, { unit: e.target.value || undefined })}
              placeholder="단위"
              className="tap-target w-16 rounded border border-neutral-300 px-1"
            />
            {question.columns.length > 1 && (
              <button type="button" onClick={() => removeColumn(i)} className="tap-target text-neutral-400 hover:text-danger" aria-label="열 삭제">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addColumn} className="tap-target self-start px-2 text-sm text-accent-500">
          + 열 추가
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
        학생이 입력할 행 수
        <input
          type="number"
          min={1}
          max={30}
          value={question.rowCount}
          onChange={(e) => onChange({ ...question, rowCount: Math.max(1, Number(e.target.value) || 1) })}
          className="tap-target w-20 rounded border border-neutral-300 px-2"
        />
      </label>

      <Accordion title="그래프 표시 설정 (학생에게는 그래프만 보이고 이 설정은 안 보여요)">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-600">
          <input
            type="checkbox"
            checked={!!question.chart}
            onChange={(e) =>
              onChange({
                ...question,
                chart: e.target.checked ? { type: 'scatter', x: question.columns[0]?.key ?? '', y: [question.columns[1]?.key ?? ''], trendline: false } : undefined,
              })
            }
          />
          그래프 표시
        </label>
        {question.chart && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <select
              value={question.chart.type}
              onChange={(e) => onChange({ ...question, chart: { ...question.chart!, type: e.target.value as 'scatter' | 'line' | 'bar' } })}
              className="tap-target rounded border border-neutral-300 px-1"
            >
              <option value="scatter">산점도</option>
              <option value="line">꺾은선</option>
              <option value="bar">막대</option>
            </select>
            <label className="flex items-center gap-1">
              X축
              <select value={question.chart.x} onChange={(e) => onChange({ ...question, chart: { ...question.chart!, x: e.target.value } })} className="tap-target rounded border border-neutral-300 px-1">
                {numericColumns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <span>Y축</span>
            {numericColumns.map((c) => (
              <label key={c.key} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={question.chart!.y.includes(c.key)}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      chart: { ...question.chart!, y: e.target.checked ? [...question.chart!.y, c.key] : question.chart!.y.filter((k) => k !== c.key) },
                    })
                  }
                />
                {c.label}
              </label>
            ))}
            {question.chart.type === 'scatter' && (
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!question.chart.trendline}
                  onChange={(e) => onChange({ ...question, chart: { ...question.chart!, trendline: e.target.checked } })}
                />
                추세선(회귀직선)
              </label>
            )}
          </div>
        )}
      </Accordion>
    </QuestionEditorShell>
  )
}

// ── 학생 화면 ─────────────────────────────────────────────────────────

function DataTableGrid({ question, value, onChange, disabled }: QuestionViewerProps<DataTableQuestion>) {
  const current = (value as DataTableAnswerValue | undefined) ?? { cells: emptyCells(question.rowCount, question.columns.length) }
  const columnValues = computeColumns(question.columns, question.rowCount, current.cells)

  function updateCell(r: number, c: number, raw: string) {
    const cells = current.cells.map((row) => [...row])
    while (cells.length < question.rowCount) cells.push(new Array(question.columns.length).fill(''))
    cells[r][c] = raw
    onChange({ cells })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {question.columns.map((col) => (
              <th key={col.key} className="border border-neutral-200 bg-neutral-50 p-1 text-center">
                {col.label}
                {col.unit && <span className="text-neutral-400"> ({col.unit})</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: question.rowCount }, (_, r) => (
            <tr key={r}>
              {question.columns.map((col, c) => (
                <td key={col.key} className="border border-neutral-200 p-1">
                  {col.type === 'computed' ? (
                    <div className="px-1 text-center text-neutral-500">{Number.isFinite(columnValues[col.key][r]) ? Number(columnValues[col.key][r].toFixed(4)) : '—'}</div>
                  ) : (
                    <input
                      value={current.cells[r]?.[c] ?? ''}
                      disabled={disabled}
                      inputMode={col.type === 'number' ? 'decimal' : undefined}
                      onChange={(e) => updateCell(r, c, e.target.value)}
                      className="tap-target w-full min-w-16 rounded border border-transparent px-1 text-center focus:border-neutral-300 disabled:bg-neutral-50"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Viewer(props: QuestionViewerProps<DataTableQuestion>) {
  const { question, value } = props
  const current = (value as DataTableAnswerValue | undefined) ?? { cells: emptyCells(question.rowCount, question.columns.length) }
  const columnValues = computeColumns(question.columns, question.rowCount, current.cells)

  let trendline: { slope: number; intercept: number } | null = null
  let regressionSummary: string | null = null
  if (question.chart?.trendline) {
    const xs = columnValues[question.chart.x] ?? []
    const ys = columnValues[question.chart.y[0]] ?? []
    const pairs: [number, number][] = []
    for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
      if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]])
    }
    const reg = linearRegression(
      pairs.map((p) => p[0]),
      pairs.map((p) => p[1]),
    )
    if (reg) {
      trendline = reg
      regressionSummary = `기울기 ${reg.slope.toFixed(3)} · 절편 ${reg.intercept.toFixed(3)} · R² ${reg.r2.toFixed(3)}`
    }
  }

  const chartData = Array.from({ length: question.rowCount }, (_, r) => {
    const record: Record<string, string | number> = {}
    question.columns.forEach((col) => {
      record[col.key] = columnValues[col.key][r]
    })
    return record
  }).filter((row) => question.chart && Number.isFinite(row[question.chart.x]))

  return (
    <div>
      <DataTableGrid {...props} />
      {question.chart && question.chart.y.length > 0 && (
        <div className="mt-3">
          <ChartRenderer type={question.chart.type} data={chartData} xKey={question.chart.x} yKeys={question.chart.y} trendline={trendline} errorBarKey={question.chart.errorBar} />
          {regressionSummary && <p className="mt-1 text-center text-sm text-neutral-500">{regressionSummary}</p>}
        </div>
      )}
    </div>
  )
}

registerQuestion<DataTableQuestion>({
  kind: 'dataTable',
  label: '데이터표',
  createDefault: (id) => ({
    id,
    kind: 'dataTable',
    prompt: '',
    required: true,
    points: 10,
    columns: [
      { key: 'A', label: '거리(m)', type: 'number' },
      { key: 'B', label: '시간(s)', type: 'number' },
    ],
    rowCount: 5,
  }),
  Editor,
  Viewer,
  // grade 없음 — 데이터표는 탐구 활동 기록용이라 정오답 개념이 없다. 교사가 결과 화면에서
  // 표·그래프를 직접 보고 확인한다(그리기·사진과 같은 방식, docs/PLAN.md).
  isAnswered: (question, value) => {
    const input = value as DataTableAnswerValue | undefined
    if (!input) return false
    return question.columns.every((col, c) => {
      if (col.type === 'computed') return true
      return Array.from({ length: question.rowCount }, (_, r) => input.cells[r]?.[c] ?? '').every((v) => v.trim() !== '')
    })
  },
  toCell: (question, value) => {
    const input = value as DataTableAnswerValue | undefined
    if (!input) return ''
    const header = question.columns.map((c) => c.label).join(',')
    const rows = input.cells.map((row) => row.join(','))
    return [header, ...rows].join('\n')
  },
})
