import { evaluateFormulaString } from './formula'
import type { DataTableColumn } from '../types/lesson'

export function parseCell(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return NaN
  const n = Number(raw)
  return Number.isFinite(n) ? n : NaN
}

/**
 * cells[row][colIndex] 원본 입력에서 계산 열(type:'computed')까지 채운 열별 숫자 배열을 만든다.
 * 계산 열은 선언 순서대로 한 번만 평가한다 — 계산 열이 다른 계산 열을 참조하는 경우
 * 반드시 그 열보다 뒤에 선언돼야 한다(다단계 의존성 해석은 하지 않는 의도적 단순화).
 */
export function computeColumns(columns: DataTableColumn[], rowCount: number, cells: string[][]): Record<string, number[]> {
  const columnValues: Record<string, number[]> = {}
  columns.forEach((col) => {
    columnValues[col.key] = new Array(rowCount).fill(NaN)
  })

  columns.forEach((col, c) => {
    if (col.type === 'computed') return
    for (let r = 0; r < rowCount; r++) {
      columnValues[col.key][r] = parseCell(cells[r]?.[c])
    }
  })

  columns.forEach((col) => {
    if (col.type !== 'computed' || !col.formula) return
    for (let r = 0; r < rowCount; r++) {
      const row: Record<string, number> = {}
      columns.forEach((c2) => {
        row[c2.key] = columnValues[c2.key][r]
      })
      try {
        columnValues[col.key][r] = evaluateFormulaString(col.formula, { row, columns: columnValues })
      } catch {
        columnValues[col.key][r] = NaN
      }
    }
  })

  return columnValues
}
