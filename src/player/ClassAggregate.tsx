import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ChartRenderer } from '../components/ChartRenderer'
import { describeAnswerToken } from '../lib/answerPreview'
import { usePlayerCode } from './PlayerMediaContext'
import type { AggregateResult } from '../api/types'
import type { Question } from '../types/lesson'

/**
 * 학급 분포를 다시 받아오는 간격.
 *
 * ★ 이 폴링은 **학생 수만큼 곱해진다** — 30명이 이 문항을 보고 있으면 10초마다 30번이다.
 *   같은 줄에 학생의 저장·제출이 서 있으므로 짧게 잡을수록 수업이 느려진다.
 *   분포는 몇 초 늦어도 수업에 지장이 없어 30초로 둔다(2026-08-20).
 */
const POLL_MS = 30_000

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
      // ⚠️ 탭이 가려져 있으면 부르지 않는다. 예전에는 화면 안에 있기만 하면 **다른 앱을 보는
      //    동안에도** 10초마다 요청이 나갔다 — 학생이 폰을 주머니에 넣어도 계속 돌았다.
      if (document.hidden) return
      const data = await api.getAggregate(code, questionId).catch(() => null)
      if (!cancelled && data) setResult(data)
    }
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
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
