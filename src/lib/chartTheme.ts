import { useEffect, useState } from 'react'

/**
 * 차트 전용 팔레트. dataviz 스킬로 검증됨 — 라이트: 우리 accent-500(#2563eb)을 1번 슬롯으로 넣고
 * validate_palette.js를 통과, 다크: 레퍼런스 다크 8색(같은 계열) 사용. 순서를 바꾸면 인접 색상의
 * 색각이상 구분성이 깨질 수 있으니 재검증 없이 바꾸지 않는다.
 */
export const CATEGORICAL_LIGHT = ['#2563eb', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
export const CATEGORICAL_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export const CHART_CHROME_LIGHT = {
  surface: '#fafafa',
  ink: '#18181b',
  mutedText: '#71717a',
  gridline: '#e4e4e7',
  axis: '#a1a1aa',
}
export const CHART_CHROME_DARK = {
  surface: '#18181b',
  ink: '#fafafa',
  mutedText: '#a1a1aa',
  gridline: '#3f3f46',
  axis: '#71717a',
}

function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches))

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return dark
}

export function useChartTheme() {
  const dark = useIsDarkMode()
  return {
    categorical: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    chrome: dark ? CHART_CHROME_DARK : CHART_CHROME_LIGHT,
  }
}
