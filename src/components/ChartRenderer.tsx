import { Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Legend, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartTheme } from '../lib/chartTheme'

export interface ChartRendererProps {
  type: 'line' | 'bar' | 'scatter'
  data: Record<string, string | number>[]
  xKey: string
  yKeys: string[]
  height?: number
  /** scatter 전용: 추세선(기울기·절편)을 함께 그린다 (8단계 dataTable 문항) */
  trendline?: { slope: number; intercept: number } | null
  /** scatter 전용: data의 각 행에 있는 오차 필드 이름 (예: 'error') */
  errorBarKey?: string
}

/** ChartBlock(교사 데이터)과 8단계 dataTable(학생 입력) 그래프가 함께 쓰는 렌더러. dataviz 스킬로 검증한 팔레트만 쓴다. */
export function ChartRenderer({ type, data, xKey, yKeys, height = 260, trendline, errorBarKey }: ChartRendererProps) {
  const { categorical, chrome } = useChartTheme()

  if (data.length === 0 || yKeys.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-neutral-500">표시할 데이터가 없어요</div>
  }

  const axisProps = { stroke: chrome.axis, tick: { fill: chrome.mutedText, fontSize: 12 } }
  const tooltipStyle = { background: chrome.surface, border: `1px solid ${chrome.gridline}`, fontSize: 13 }

  const xValues = data.map((d) => Number(d[xKey])).filter((v) => Number.isFinite(v))
  const trendData =
    trendline && xValues.length > 0
      ? [
          { [xKey]: Math.min(...xValues), __trend: trendline.slope * Math.min(...xValues) + trendline.intercept },
          { [xKey]: Math.max(...xValues), __trend: trendline.slope * Math.max(...xValues) + trendline.intercept },
        ]
      : null

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === 'bar' ? (
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={chrome.gridline} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={categorical[i % categorical.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      ) : type === 'scatter' ? (
        <ComposedChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={chrome.gridline} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} {...axisProps} type="number" name={xKey} />
          <YAxis {...axisProps} type="number" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
          {yKeys.map((key, i) => (
            <Scatter key={key} name={key} data={data} dataKey={key} fill={categorical[i % categorical.length]}>
              {errorBarKey && <ErrorBar dataKey={errorBarKey} stroke={chrome.axis} width={4} strokeWidth={1} />}
            </Scatter>
          ))}
          {trendData && (
            <Line data={trendData} type="linear" dataKey="__trend" name="추세선" stroke={chrome.mutedText} strokeWidth={2} strokeDasharray="5 4" dot={false} legendType="none" />
          )}
        </ComposedChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={chrome.gridline} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={categorical[i % categorical.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}
