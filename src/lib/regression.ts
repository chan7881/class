/** 데이터표(dataTable) 문항의 산점도에 그릴 최소제곱 선형회귀. */
export interface RegressionResult {
  slope: number
  intercept: number
  r2: number
}

export function linearRegression(xs: number[], ys: number[]): RegressionResult | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumXX += xs[i] * xs[i]
  }

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null // 모든 x가 같으면 기울기를 정의할 수 없다

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const meanY = sumY / n
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept
    ssRes += (ys[i] - predicted) ** 2
    ssTot += (ys[i] - meanY) ** 2
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot

  return { slope, intercept, r2 }
}
