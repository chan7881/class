import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Download, Lock, LockOpen, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { BusyOverlay } from '../components/BusyOverlay'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { loadEditToken, saveEditToken } from '../lib/editorAuth'
import { downloadResultsCsv } from '../lib/csv'
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
  const [togglingLock, setTogglingLock] = useState(false)
  const [savingRetention, setSavingRetention] = useState(false)
  const [deletingResponse, setDeletingResponse] = useState(false)
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

  async function handleToggleLock() {
    if (!editToken || !lesson) return
    const next = !lesson.settings.locked
    if (next && !window.confirm('제출을 마감할까요? 학생은 더 이상 답을 저장하거나 제출할 수 없게 됩니다.')) return
    setTogglingLock(true)
    try {
      await api.setLessonLocked(code, editToken, next)
      setLesson({ ...lesson, settings: { ...lesson.settings, locked: next } })
    } finally {
      setTogglingLock(false)
    }
  }

  async function handleRetentionChange(days: number) {
    if (!editToken || !lesson) return
    if (days > 0 && !window.confirm(`${days}일이 지난 응답은 이 화면을 열 때 자동으로 지워집니다. 계속할까요?`)) return
    // 보관기간은 수업 설정의 일부라 saveLesson으로 저장한다(전용 액션을 따로 두지 않는다).
    const next = { ...lesson, settings: { ...lesson.settings, retentionDays: days || undefined } }
    setSavingRetention(true)
    try {
      await api.saveLesson(code, editToken, next)
      setLesson(next)
    } finally {
      setSavingRetention(false)
    }
  }

  async function handleDeleteResponse(studentKey: string) {
    if (!editToken) return
    setDeletingResponse(true)
    try {
      await api.deleteResponse(code, editToken, studentKey)
      setRecords((prev) => (prev ? prev.filter((r) => r.studentKey !== studentKey) : prev))
    } finally {
      setDeletingResponse(false)
    }
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
        <PageTitle>편집 키가 필요합니다</PageTitle>
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
        <PageTitle tone="danger">결과를 불러올 수 없습니다</PageTitle>
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
          <PageTitle>{lesson.title} · 결과</PageTitle>
          <p className="text-sm text-neutral-500">수업 코드: {code}</p>
          {lastUpdated && (
            <p className="text-xs text-neutral-400">
              마지막 갱신: {lastUpdated.toLocaleTimeString()} (수업이 진행 중이면 이 화면을 열어두는 동안 자동으로 갱신돼요)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadResultsXlsx(lesson, records)}>
            <Icon icon={Download} />
            .xlsx 내려받기
          </Button>
          {/* 성적 처리 프로그램·구글 스프레드시트로 옮길 땐 CSV만 받는 곳이 있다. 내용은 xlsx와 같다 */}
          <Button variant="secondary" onClick={() => downloadResultsCsv(lesson, records)}>
            <Icon icon={Download} />
            .csv 내려받기
          </Button>
          {/* 페이지 수준의 되돌릴 수 없는 액션이라 꽉 찬 danger를 유지한다 — 표 행 안의 삭제는
              같은 danger를 size="sm"으로 쓴다(맥락 밀도만 다르고 색·아이콘은 통일, 항목 3) */}
          <Button variant="secondary" onClick={() => void handleToggleLock()} disabled={togglingLock}>
            <Icon icon={lesson.settings.locked ? LockOpen : Lock} />
            {togglingLock ? '적용 중…' : lesson.settings.locked ? '제출 다시 열기' : '제출 마감하기'}
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
            <Icon icon={Trash2} />
            {deleting ? '삭제 중…' : '수업 데이터 완전 삭제'}
          </Button>
        </div>
      </div>

      {lesson.settings.locked && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          제출이 마감된 상태예요. 학생이 참여 링크로 들어와도 시작할 수 없습니다.
        </p>
      )}

      {/* 응답 보관기간 — 학생 이름·학번과 답안을 필요 이상으로 오래 들고 있지 않기 위한 설정.
          정리는 이 결과 화면을 열 때 함께 이뤄진다(서버가 별도 트리거 없이 처리). */}
      <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
        응답 보관기간
        <select
          value={lesson.settings.retentionDays ?? 0}
          onChange={(e) => void handleRetentionChange(Number(e.target.value))}
          disabled={savingRetention}
          className="tap-target rounded border border-neutral-300 px-2"
        >
          <option value={0}>무기한</option>
          <option value={30}>30일</option>
          <option value={90}>90일</option>
          <option value={180}>180일</option>
          <option value={365}>1년</option>
        </select>
        <span className="text-xs text-neutral-400">
          기간이 지난 응답은 이 화면을 열 때 자동으로 지워집니다. 되돌릴 수 없으니 필요하면 먼저 내려받으세요.
        </span>
      </label>

      <div className="mt-6">
        <Dashboard lesson={lesson} records={records} onDeleteResponse={handleDeleteResponse} />
      </div>

      {deleting && <BusyOverlay message="수업 데이터를 삭제하는 중입니다…" />}
      {togglingLock && <BusyOverlay message={lesson.settings.locked ? '제출을 다시 여는 중입니다…' : '제출을 마감하는 중입니다…'} />}
      {savingRetention && <BusyOverlay message="보관기간을 저장하는 중입니다…" />}
      {deletingResponse && <BusyOverlay message="응답을 삭제하는 중입니다…" />}
    </PageShell>
  )
}
