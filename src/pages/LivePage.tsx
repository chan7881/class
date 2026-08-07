import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { PageTitle } from '../components/PageTitle'
import { loadEditToken, saveEditToken } from '../lib/editorAuth'
import { buildLiveView, STALL_THRESHOLD_MINUTES, type StallThresholdMinutes } from '../lib/liveStatus'
import { LiveGrid } from '../live/LiveGrid'
import type { LiveSnapshot } from '../api/types'
import type { Lesson } from '../types/lesson'

/** 결과 화면과 같은 주기. 수업 중 화면이라 더 짧게 하고 싶어지지만 중앙 배포 백엔드가 하나뿐이다. */
const LIVE_POLL_MS = 8_000

const MASK_KEY = 'class:live:maskNames'
const THRESHOLD_KEY = 'class:live:stallMinutes'

/**
 * 수업 중 실시간 진행 모니터링 (교사용).
 *
 * 결과 화면(/results/:code)과 목적이 다르다 — 채점 결과를 훑는 게 아니라 **지금 개입이 필요한
 * 학생을 찾는 것**이라, 진행 중인 학생만 크게 보여주고 제출한 학생은 아래로 접어 둔다.
 */
export default function LivePage() {
  const { code = '' } = useParams()

  const [editToken, setEditToken] = useState<string | null>(null)
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [staleSince, setStaleSince] = useState<Date | null>(null)

  // 교실 앞 화면에 띄우는 설정은 매 수업 다시 켜기 번거로우니 기기에 남긴다.
  const [maskNames, setMaskNames] = useState(() => localStorage.getItem(MASK_KEY) === '1')
  const [stallMinutes, setStallMinutes] = useState<StallThresholdMinutes>(() => {
    const saved = Number(localStorage.getItem(THRESHOLD_KEY))
    return (STALL_THRESHOLD_MINUTES as readonly number[]).includes(saved) ? (saved as StallThresholdMinutes) : 5
  })

  useEffect(() => {
    localStorage.setItem(MASK_KEY, maskNames ? '1' : '0')
  }, [maskNames])
  useEffect(() => {
    localStorage.setItem(THRESHOLD_KEY, String(stallMinutes))
  }, [stallMinutes])

  useEffect(() => {
    if (!code) return
    const stored = loadEditToken(code)
    if (stored) setEditToken(stored)
  }, [code])

  useEffect(() => {
    if (!code || !editToken) return
    let cancelled = false
    setLoadError(null)
    Promise.all([api.getLessonForEdit(code, editToken), api.getLive(code, editToken)])
      .then(([l, s]) => {
        if (cancelled) return
        setLesson(l)
        setSnapshot(s)
        setStaleSince(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '진행 상황을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [code, editToken])

  // 탭이 백그라운드면 멈춘다(ResultsPage와 같은 철학) — 교사가 수업 자료 탭으로 옮겨간 동안
  // 중앙 배포 백엔드를 계속 두드릴 이유가 없다. 다시 돌아오면 즉시 한 번 받아온다.
  useEffect(() => {
    if (!code || !editToken || !lesson) return
    const token = editToken
    let cancelled = false

    async function poll() {
      if (document.hidden) return
      try {
        const s = await api.getLive(code, token)
        if (!cancelled) {
          setSnapshot(s)
          setStaleSince(null)
        }
      } catch {
        // 폴링 실패는 화면을 지우지 않고 "갱신 멈춤"만 알린다 — 수업 중에 에러 화면이
        // 명단을 덮어버리면 그 순간 아무것도 못 보게 된다.
        if (!cancelled) setStaleSince((prev) => prev ?? new Date())
      }
    }

    const timer = setInterval(() => void poll(), LIVE_POLL_MS)
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

  const view = useMemo(() => {
    if (!lesson || !snapshot) return null
    return buildLiveView(lesson, snapshot.records, snapshot.lastSeen, snapshot.serverNow, stallMinutes)
  }, [lesson, snapshot, stallMinutes])

  function handleManualKeySubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = manualKeyInput.trim()
    if (!trimmed) return
    saveEditToken(code, trimmed)
    setEditToken(trimmed)
  }

  if (!editToken) {
    return (
      <Shell>
        <PageTitle>수업 진행 상황</PageTitle>
        <p className="mt-2 text-neutral-600">이 기기에 편집 키가 없습니다. 편집 키를 넣어 주세요.</p>
        <form onSubmit={handleManualKeySubmit} className="mt-4 flex gap-2">
          <input
            value={manualKeyInput}
            onChange={(e) => setManualKeyInput(e.target.value)}
            placeholder="편집 키"
            aria-label="편집 키"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-0 px-3 py-2"
          />
          <Button type="submit">열기</Button>
        </form>
      </Shell>
    )
  }

  if (loadError) {
    return (
      <Shell>
        <PageTitle tone="danger">불러오지 못했습니다</PageTitle>
        <p className="mt-2 text-neutral-600">{loadError}</p>
      </Shell>
    )
  }

  if (!lesson || !view) {
    return (
      <Shell>
        <p className="text-neutral-500">불러오는 중…</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <PageTitle>{lesson.title}</PageTitle>
          <p className="mt-1 text-sm text-neutral-500">
            수업 진행 상황 ·{' '}
            <Link to={`/results/${code}`} className="underline hover:text-neutral-900">
              전체 결과 보기
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            멈춤 기준
            <select
              value={stallMinutes}
              onChange={(e) => setStallMinutes(Number(e.target.value) as StallThresholdMinutes)}
              aria-label="멈춤으로 볼 기준 시간"
              className="tap-target rounded-lg border border-neutral-300 bg-neutral-0 px-2 text-sm"
            >
              {STALL_THRESHOLD_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" size="sm" onClick={() => setMaskNames((v) => !v)}>
            <Icon icon={maskNames ? EyeOff : Eye} />
            {maskNames ? '이름 가림' : '이름 보임'}
          </Button>
        </div>
      </header>

      <Summary
        inProgress={view.inProgress.length}
        submitted={view.submitted.length}
        stalled={view.stalledCount}
      />

      {staleSince && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon icon={TriangleAlert} />
          {staleSince.toLocaleTimeString()}부터 갱신되지 않고 있습니다. 아래 내용은 그때 기준입니다.
        </p>
      )}

      <div className="mt-4">
        <LiveGrid lesson={lesson} view={view} maskNames={maskNames} />
      </div>
    </Shell>
  )
}

/**
 * 결과 화면의 `PageShell`(max-w-3xl)을 쓰지 않는다 — 이 화면은 교실 TV에 띄워 학급 전체를
 * 한눈에 보는 게 목적이라 폭을 좁히면 카드가 몇 장 안 들어간다.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="safe-bottom mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6">{children}</div>
}

function Summary({ inProgress, submitted, stalled }: { inProgress: number; submitted: number; stalled: number }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Stat label="진행 중" value={inProgress} />
      <Stat label="제출 완료" value={submitted} />
      {/* 0명일 때도 자리를 지킨다 — 숫자가 나타났다 사라지면 위치가 밀려서 눈이 다시 찾아야 한다 */}
      <Stat label="멈춤" value={stalled} tone={stalled > 0 ? 'warn' : 'default'} />
    </div>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warn' }) {
  const toneClass = tone === 'warn' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-neutral-200 bg-neutral-0 text-neutral-900'
  return (
    <div className={`flex items-baseline gap-2 rounded-xl border px-4 py-2 ${toneClass}`}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}
