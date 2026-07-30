import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ChartRenderer } from '../components/ChartRenderer'
import { describeAnswerToken } from '../lib/answerPreview'
import { usePlayerCode } from './PlayerMediaContext'
import type { AggregateResult } from '../api/types'
import type { Question } from '../types/lesson'

const POLL_MS = 10_000

/**
 * 학급 전체 응답 분포를 익명 집계로 보여준다 (docs/PLAN.md 8번 항목). 화면에 보일 때만
 * IntersectionObserver로 폴링하고, 벗어나면 즉시 멈춘다 — 중앙 배포 서버 부하를 줄이기 위함.
 */
export function ClassAggregate({ question }: { question: Question }) {
  const questionId = question.id
  const code = usePlayerCode()
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<AggregateResult | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    async function poll() {
      const data = await api.getAggregate(code, questionId).catch(() => null)
      if (!cancelled && data) setResult(data)
    }
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [visible, code, questionId])

  const entries = result ? Object.entries(result.counts) : []
  const chartData = entries.map(([key, count]) => ({ 값: describeAnswerToken(question, key), 응답수: count }))

  return (
    <div ref={containerRef} className="mt-2 rounded-lg border border-neutral-200 p-2">
      <p className="text-xs font-medium text-neutral-500">학급 전체 응답 분포 {result ? `(${result.totalResponses}명 응답)` : ''}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-400">아직 집계할 응답이 없어요</p>
      ) : (
        <ChartRenderer type="bar" data={chartData} xKey="값" yKeys={['응답수']} height={140} />
      )}
    </div>
  )
}
