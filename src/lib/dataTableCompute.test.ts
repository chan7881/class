import { describe, expect, it } from 'vitest'
import { computeColumns } from './dataTableCompute'
import type { DataTableColumn } from '../types/lesson'

describe('computeColumns', () => {
  const columns: DataTableColumn[] = [
    { key: 'A', label: '거리(m)', type: 'number' },
    { key: 'B', label: '시간(s)', type: 'number' },
    { key: 'C', label: '속력(m/s)', type: 'computed', formula: 'A / B' },
  ]

  it('숫자 열을 그대로 읽고 계산 열은 수식으로 채운다', () => {
    const cells = [
      ['10', '2'],
      ['20', '4'],
    ]
    const result = computeColumns(columns, 2, cells)
    expect(result.A).toEqual([10, 20])
    expect(result.B).toEqual([2, 4])
    expect(result.C).toEqual([5, 5])
  })

  it('빈 칸은 NaN으로 처리하고 그 행의 계산 열도 NaN이 된다', () => {
    const cells = [['', '2']]
    const result = computeColumns(columns, 1, cells)
    expect(Number.isNaN(result.A[0])).toBe(true)
    expect(Number.isNaN(result.C[0])).toBe(true)
  })

  it('집계 함수로 열 전체를 참조하는 계산 열도 계산한다', () => {
    const withAvg: DataTableColumn[] = [
      { key: 'A', label: 'A', type: 'number' },
      { key: 'D', label: '편차', type: 'computed', formula: 'A - avg(A)' },
    ]
    const cells = [['1'], ['2'], ['3']]
    const result = computeColumns(withAvg, 3, cells)
    expect(result.D).toEqual([-1, 0, 1])
  })
})
