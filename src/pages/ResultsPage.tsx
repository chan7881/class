import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { PageShell } from '../components/PageShell'
import { loadEditToken, saveEditToken } from '../lib/editorAuth'
import { downloadResultsXlsx } from '../lib/xlsx'
import { Dashboard } from '../results/Dashboard'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

const RESULTS_POLL_MS = 8_000

export default function ResultsPage() {
  const { code = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [editToken, setEditToken] = useState<string | null>(null)
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [records, setRecords] = useState<ResponseRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 발행/공유 화면 복구 링크(?key=...)로 들어오면 localStorage로 옮기고 주소에서는 지운다.
  useEffect(() => {
    const key = searchParams.get('key')
    if (key && code) {
      saveEditToken(code, key)
      const next = new URLSearchParams(searchParams)
      next.delete('key')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    if (!code) return
    const stored = loadEditToken(code)
    if (stored) setEditToken(stored)
  }, [code])

  useEffect(() => {
    if (!code || !editToken) return
    let cancelled = false
    setLoadError(null)
    Promise.all([api.getLessonForEdit(code, editToken), api.getResults(code, editToken)])
      .then(([l, r]) => {
        if (!cancelled) {
          setLesson(l)
          setRecords(r)
          setLastUpdated(new Date())
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '결과를 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [code, editToken])

  // 수업이 진행 중일 때도 교사가 이 페이지를 열어두면 응답이 실시간에 가깝게 갱신되도록 짧게
  // 폴링한다(Formative류 실시간 모니터링 벤치마크, docs/ROADMAP.md 참고). 탭이 백그라운드로
  // 가면 즉시 멈춰 중앙 배포 서버 부하를 줄인다(ClassAggregate.tsx와 같은 철학).
  useEffect(() => {
    if (!code || !editToken || !lesson) return
    const token = editToken
    let cancelled = false

    async function poll() {
      if (document.hidden) return
      try {
        const r = await api.getResults(code, token)
        if (!cancelled) {
          setRecords(r)
          setLastUpdated(new Date())
        }
      } catch {
        // 폴링 실패는 조용히 넘어간다 — 다음 폴링에서 다시 시도, 화면에 에러를 띄우지 않는다.
      }
    }

    const timer = setInterval(() => void poll(), RESULTS_POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, editToken, !!lesson])

  function handleManualKeySubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = manualKeyInput.trim()
    if (!trimmed) return
    saveEditToken(code, trimmed)
    setEditToken(trimmed)
  }

  async function handleDelete() {
    if (!editToken) return
    const ok = window.confirm('정말 이 수업과 모든 응답·미디어를 완전히 삭제할까요? 되돌릴 수 없어요.')
    if (!ok) return
    setDeleting(true)
    try {
      await api.deleteLesson(code, editToken)
      navigate('/')
    } finally {
      setDeleting(false)
    }
  }

  if (!editToken) {
    return (
      <PageShell>
        <h1 className="text-xl font-semibold">편집 키가 필요합니다</h1>
        <p className="mt-2 text-sm text-neutral-500">
          이 수업의 결과를 보려면 편집 키가 필요해요. 복구 링크를 다시 열거나, 편집 키를 직접 붙여넣으세요.
        </p>
        <form onSubmit={handleManualKeySubmit} className="mt-4 flex gap-2">
          <input
            value={manualKeyInput}
            onChange={(e) => setManualKeyInput(e.target.value)}
            placeholder="편집 키 붙여넣기"
            className="tap-target flex-1 rounded border border-neutral-300 px-3 text-sm outline-none focus:border-accent-500"
          />
          <Button type="submit">확인</Button>
        </form>
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell>
        <h1 className="text-xl font-semibold text-danger">결과를 불러올 수 없습니다</h1>
        <p className="mt-2 text-sm text-neutral-500">{loadError}</p>
      </PageShell>
    )
  }

  if (!lesson || !records) {
    return (
      <PageShell>
        <p className="text-neutral-500">불러오는 중…</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{lesson.title} · 결과</h1>
          <p className="text-sm text-neutral-500">수업 코드: {code}</p>
          {lastUpdated && (
            <p className="text-xs text-neutral-400">
              마지막 갱신: {lastUpdated.toLocaleTimeString()} (수업이 진행 중이면 이 화면을 열어두는 동안 자동으로 갱신돼요)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadResultsXlsx(lesson, records)}>
            .xlsx 내려받기
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? '삭제 중…' : '수업 데이터 완전 삭제'}
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Dashboard lesson={lesson} records={records} />
      </div>
    </PageShell>
  )
}
