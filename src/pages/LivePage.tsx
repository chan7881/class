import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { PageTitle } from '../components/PageTitle'
import { clearViewPassword, loadEditToken, loadViewPassword, saveLiveSecret } from '../lib/editorAuth'
import { buildLiveView, STALL_THRESHOLD_MINUTES, type StallThresholdMinutes } from '../lib/liveStatus'
import { LiveGrid } from '../live/LiveGrid'
import type { LiveSnapshot } from '../api/types'

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

  /**
   * 들어오는 길이 둘이다 — **편집 키**(수업을 만든 기기에 저장돼 있다)와 **현황 암호**(교사가
   * 직접 정한 값). 둘 중 하나만 있으면 되고, 서버가 어느 쪽이든 맞으면 통과시킨다.
   */
  const [editToken, setEditToken] = useState<string | null>(null)
  const [viewPassword, setViewPassword] = useState<string | null>(null)
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
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
    setEditToken(loadEditToken(code))
    setViewPassword(loadViewPassword(code))
  }, [code])

  const auth = useMemo(
    () => ({ editToken: editToken ?? undefined, viewPassword: viewPassword ?? undefined }),
    [editToken, viewPassword],
  )
  const hasAuth = Boolean(editToken || viewPassword)

  useEffect(() => {
    if (!code || !hasAuth) return
    let cancelled = false
    setLoadError(null)
    // 수업은 getLive가 같이 실어 보낸다 — 현황 암호로 들어온 교사는 getLessonForEdit을
    // 부를 수 없기 때문이다(그건 편집 키 전용).
    api
      .getLive(code, auth)
      .then((s) => {
        if (cancelled) return
        setSnapshot(s)
        setStaleSince(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '진행 상황을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [code, auth, hasAuth])

  // 탭이 백그라운드면 멈춘다(ResultsPage와 같은 철학) — 교사가 수업 자료 탭으로 옮겨간 동안
  // 중앙 배포 백엔드를 계속 두드릴 이유가 없다. 다시 돌아오면 즉시 한 번 받아온다.
  useEffect(() => {
    if (!code || !hasAuth || !snapshot) return
    let cancelled = false

    async function poll() {
      if (document.hidden) return
      try {
        const s = await api.getLive(code, auth)
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
  }, [code, auth, hasAuth, !!snapshot])

  const lesson = snapshot?.lesson ?? null
  const view = useMemo(() => {
    if (!snapshot) return null
    return buildLiveView(snapshot.lesson, snapshot.records, snapshot.lastSeen, snapshot.serverNow, stallMinutes)
  }, [snapshot, stallMinutes])

  /**
   * 입력값이 현황 암호인지 편집 키인지 **묻지 않는다.** 서버가 둘 다 대조해 하나만 맞으면
   * 통과시키므로, 교사는 그냥 아는 값을 넣으면 된다. 통과한 뒤에야 기기에 저장한다 —
   * 틀린 값을 저장해 두면 다음에 열 때 조용히 실패한다.
   */
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault()
    const value = manualKeyInput.trim()
    if (!value || checking) return
    setChecking(true)
    setAuthError(null)
    try {
      const s = await api.getLive(code, { editToken: value, viewPassword: value })
      // 생김새를 보고 맞는 자리에 저장한다 — 판단 규칙은 editorAuth 한 곳에만 있다.
      if (saveLiveSecret(code, value) === 'editToken') setEditToken(value)
      else setViewPassword(value)
      setSnapshot(s)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '들어갈 수 없습니다')
    } finally {
      setChecking(false)
    }
  }

  if (!hasAuth) {
    return (
      <Shell>
        <PageTitle>수업 진행 상황</PageTitle>
        <p className="mt-2 text-neutral-600">
          <strong>현황 암호</strong>를 넣어 주세요. 선생님이 정해 둔 암호가 없다면 편집 키로도 들어갈 수 있습니다.
        </p>
        <form onSubmit={handleAuthSubmit} className="mt-4 flex gap-2">
          <input
            type="password"
            value={manualKeyInput}
            onChange={(e) => setManualKeyInput(e.target.value)}
            placeholder="현황 암호 또는 편집 키"
            aria-label="현황 암호 또는 편집 키"
            autoComplete="current-password"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-0 px-3 py-2"
          />
          <Button type="submit" disabled={checking}>
            {checking ? '확인 중…' : '열기'}
          </Button>
        </form>
        {authError && <p className="mt-2 text-sm text-danger">{authError}</p>}
      </Shell>
    )
  }

  if (loadError) {
    return (
      <Shell>
        <PageTitle tone="danger">불러오지 못했습니다</PageTitle>
        <p className="mt-2 text-neutral-600">{loadError}</p>
        {/*
          저장해 둔 암호가 더 이상 안 맞는 경우가 흔하다(선생님이 암호를 바꿨다) — 지우고 다시
          넣을 길을 주지 않으면 이 화면에 갇힌다.
        */}
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            clearViewPassword(code)
            setViewPassword(null)
            setEditToken(null)
            setManualKeyInput('')
            setLoadError(null)
          }}
        >
          다시 입력하기
        </Button>
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
            수업 진행 상황
            {/* 결과 화면은 편집 키가 있어야 열린다 — 현황 암호로 들어온 교사에게 링크를
                보여주면 눌러 놓고 "편집 키가 필요합니다"만 만나게 된다. */}
            {editToken && (
              <>
                {' · '}
                <Link to={`/results/${code}`} className="underline hover:text-neutral-900">
                  전체 결과 보기
                </Link>
              </>
            )}
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
