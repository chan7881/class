import { describe, expect, it } from 'vitest'
import { linearRegression } from './regression'

describe('linearRegression', () => {
  it('완전한 직선 데이터는 기울기·절편·R²을 정확히 구한다', () => {
    const result = linearRegression([1, 2, 3, 4], [3, 5, 7, 9]) // y = 2x + 1
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(2)
    expect(result!.intercept).toBeCloseTo(1)
    expect(result!.r2).toBeCloseTo(1)
  })

  it('점이 2개 미만이면 null', () => {
    expect(linearRegression([1], [1])).toBeNull()
    expect(linearRegression([], [])).toBeNull()
  })

  it('x가 전부 같으면(수직선) null', () => {
    expect(linearRegression([5, 5, 5], [1, 2, 3])).toBeNull()
  })

  it('흩어진 데이터는 R²이 1보다 작다', () => {
    const result = linearRegression([1, 2, 3, 4], [3, 4, 7, 8])
    expect(result).not.toBeNull()
    expect(result!.r2).toBeLessThan(1)
    expect(result!.r2).toBeGreaterThan(0)
  })
})
