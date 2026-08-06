import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Lock, Pencil, Plus, RefreshCw, Table2, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { BusyOverlay } from '../components/BusyOverlay'
import { Button, buttonClasses } from '../components/Button'
import { Icon } from '../components/Icon'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { saveEditToken } from '../lib/editorAuth'
import { exportLessonJson } from '../lib/portable'
import type { LessonSummary } from '../api/types'

const SESSION_KEY = 'class:adminPassword'

function formatGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1)
}

function downloadJsonText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 수업 하나에 딸린 액션 4개. 넓은 화면의 표와 좁은 화면의 카드 목록이 **같은 컴포넌트를**
 * 쓰도록 뽑아뒀다 — 두 벌로 나눠 쓰면 한쪽만 고치는 사고가 난다.
 */
function LessonActions({
  lesson,
  busy,
  onDownload,
  onEdit,
  onDelete,
}: {
  lesson: LessonSummary
  busy: boolean
  onDownload: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {lesson.responseSpreadsheetId ? (
        <a
          href={`https://docs.google.com/spreadsheets/d/${lesson.responseSpreadsheetId}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('secondary', 'sm')}
        >
          <Icon icon={Table2} />
          응답 시트
        </a>
      ) : (
        <span
          title="발행 후 생성됩니다"
          className={`${buttonClasses('secondary', 'sm')} cursor-default text-neutral-300`}
        >
          <Icon icon={Table2} />
          응답 시트
        </span>
      )}
      <Button variant="secondary" size="sm" iconOnly aria-label="다운로드" title="다운로드 (.json)" onClick={onDownload} disabled={busy}>
        <Icon icon={Download} />
      </Button>
      <Button variant="secondary" size="sm" onClick={onEdit} disabled={busy}>
        <Icon icon={Pencil} />
        수정
      </Button>
      <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>
        <Icon icon={Trash2} />
        삭제
      </Button>
    </div>
  )
}

/**
 * 전체 수업 컨텐츠 관리 화면 — 운영자 비밀번호로만 접근한다(editToken과 무관, docs/DECISIONS.md 참고).
 * 이 프로젝트는 로그인 체계가 없는 게 확정 아키텍처라, 별도 계정 시스템 대신 비밀번호 하나로 게이트한다.
 */
export default function AdminPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const [lessons, setLessons] = useState<LessonSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newLessonInfo, setNewLessonInfo] = useState<{ code: string; editToken: string } | null>(null)
  const [storageUsage, setStorageUsage] = useState<{ usageBytes: number; limitBytes: number } | null>(null)
  /** 여러 수업을 한 번에 지우기 위한 선택 상태 */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** null이 아니면 전체 화면 안내창을 띄운다 — 문구가 곧 "지금 무슨 작업 중인지"다 */
  const [busyMessage, setBusyMessage] = useState<string | null>(null)

  async function tryPassword(pw: string) {
    setChecking(true)
    setAuthError(null)
    try {
      const list = await api.listLessons(pw)
      setLessons(list)
      setAuthed(true)
      sessionStorage.setItem(SESSION_KEY, pw)
      // Drive 사용량 조회는 부가 정보라 실패해도 화면 진입 자체를 막지 않는다.
      api
        .adminGetStorageUsage(pw)
        .then(setStorageUsage)
        .catch(() => setStorageUsage(null))
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '인증에 실패했습니다')
      sessionStorage.removeItem(SESSION_KEY)
    } finally {
      setChecking(false)
    }
  }

  // 같은 탭 세션 동안은 다시 안 물어본다(닫으면 사라짐 — localStorage 대신 sessionStorage).
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) void tryPassword(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reload() {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw) return
    setLoadError(null)
    setBusyMessage('목록을 불러오는 중입니다…')
    try {
      setLessons(await api.listLessons(pw))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다')
    } finally {
      setBusyMessage(null)
    }
  }

  // ── 여러 수업 한 번에 삭제 ───────────────────────────────────────────
  //
  // 학기가 끝나면 수업이 수십 개씩 쌓이는데 한 줄씩 지우려면 확인 대화상자를 그만큼 눌러야
  // 했다. 체크해서 한 번에 지운다.

  function toggleSelected(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === (lessons?.length ?? 0) ? new Set() : new Set((lessons ?? []).map((l) => l.code))))
  }

  async function handleDeleteSelected() {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw || selected.size === 0) return
    const targets = (lessons ?? []).filter((l) => selected.has(l.code))
    // 무엇을 지우는지 이름까지 보여준다 — 개수만 보고 확인을 누르면 엉뚱한 걸 지우기 쉽다
    const preview = targets
      .slice(0, 5)
      .map((l) => `· ${l.title} (${l.code})`)
      .join('\n')
    const more = targets.length > 5 ? `\n… 외 ${targets.length - 5}개` : ''
    const ok = window.confirm(
      `선택한 ${targets.length}개 수업을 완전히 삭제합니다.\n\n${preview}${more}\n\n응답·미디어까지 전부 지워지고 되돌릴 수 없어요. 계속할까요?`,
    )
    if (!ok) return

    setLoadError(null)
    const failed: string[] = []
    // 한 건씩 순서대로 지운다 — 백엔드가 스크립트 잠금(withLock)으로 직렬화되어 있어 동시에
    // 보내봐야 서로 기다리기만 하고, 몇 번째에서 실패했는지도 알 수 없게 된다.
    for (let i = 0; i < targets.length; i++) {
      setBusyMessage(`수업을 삭제하는 중입니다… (${i + 1}/${targets.length})`)
      try {
        await api.adminDeleteLesson(targets[i].code, pw)
        const done = targets[i].code
        setLessons((prev) => prev?.filter((l) => l.code !== done) ?? null)
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(done)
          return next
        })
      } catch (e) {
        // 하나가 실패해도 나머지는 계속 지운다 — 중간에 멈추면 어디까지 됐는지 더 헷갈린다
        failed.push(`${targets[i].title}(${targets[i].code}): ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
      }
    }
    setBusyMessage(null)
    if (failed.length > 0) setLoadError(`${failed.length}개를 지우지 못했습니다 — ${failed.join(' / ')}`)
  }

  async function handleDownload(code: string) {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw) return
    setBusyCode(code)
    setBusyMessage('수업을 내려받는 중입니다…')
    try {
      const lesson = await api.adminGetLesson(code, pw)
      downloadJsonText(exportLessonJson(lesson), `${lesson.title}.json`)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '다운로드에 실패했습니다')
    } finally {
      setBusyCode(null)
      setBusyMessage(null)
    }
  }

  async function handleEdit(code: string) {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw) return
    if (
      !window.confirm(
        `"${code}" 수업을 편집기로 엽니다. 편집 키가 새로 발급되어, 그 교사가 갖고 있던 기존 편집 링크는 더 이상 동작하지 않게 돼요. 계속할까요?`,
      )
    )
      return
    setBusyCode(code)
    setBusyMessage('편집 키를 새로 발급하는 중입니다…')
    try {
      const { editToken } = await api.adminResetEditToken(code, pw)
      saveEditToken(code, editToken)
      navigate(`/editor/${code}?key=${editToken}`)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '편집기를 열지 못했습니다')
    } finally {
      setBusyCode(null)
      setBusyMessage(null)
    }
  }

  async function handleDelete(code: string, title: string) {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw) return
    if (!window.confirm(`"${title}" (${code}) 수업을 완전히 삭제합니다. 응답·미디어까지 전부 지워지고 되돌릴 수 없어요. 계속할까요?`)) return
    setBusyCode(code)
    setBusyMessage('수업을 삭제하는 중입니다…')
    try {
      await api.adminDeleteLesson(code, pw)
      setLessons((prev) => prev?.filter((l) => l.code !== code) ?? null)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(code)
        return next
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '삭제에 실패했습니다')
    } finally {
      setBusyCode(null)
      setBusyMessage(null)
    }
  }

  async function handleCreate() {
    setCreating(true)
    setNewLessonInfo(null)
    setBusyMessage('새 수업을 만드는 중입니다…')
    try {
      const { code: newCode, editToken } = await api.createLesson({ title: '새 수업', identityFields: ['name'] })
      saveEditToken(newCode, editToken)
      setNewLessonInfo({ code: newCode, editToken })
      void reload()
    } finally {
      setCreating(false)
      setBusyMessage(null)
    }
  }

  if (!authed) {
    return (
      <PageShell>
        <PageTitle>관리자 화면</PageTitle>
        <p className="mt-2 text-sm text-neutral-500">전체 수업 컨텐츠를 관리하려면 관리자 비밀번호가 필요해요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void tryPassword(password)
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="관리자 비밀번호"
            className="tap-target flex-1 rounded border border-neutral-300 px-3 text-sm outline-none focus:border-accent-500"
          />
          <Button type="submit" disabled={checking || password.length === 0}>
            {checking ? '확인 중…' : '확인'}
          </Button>
        </form>
        {authError && <p className="mt-2 text-sm text-danger">{authError}</p>}
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle>전체 수업 관리</PageTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY)
            setAuthed(false)
            setPassword('')
          }}
        >
          <Icon icon={Lock} />
          잠그기
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void handleCreate()} disabled={creating}>
          <Icon icon={Plus} />
          {creating ? '만드는 중…' : '새 수업 만들기'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void reload()}>
          <Icon icon={RefreshCw} />
          새로고침
        </Button>
        {/* 선택한 게 있을 때만 나타난다 — 평소엔 위험한 버튼이 눈앞에 없는 편이 안전하다 */}
        {selected.size > 0 && (
          <>
            <span className="text-sm text-neutral-500">{selected.size}개 선택됨</span>
            <Button variant="danger" size="sm" onClick={() => void handleDeleteSelected()}>
              <Icon icon={Trash2} />
              선택 삭제
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              선택 해제
            </Button>
          </>
        )}
      </div>

      {storageUsage && (
        <p className={`mt-2 text-xs ${storageUsage.usageBytes / storageUsage.limitBytes > 0.9 ? 'font-semibold text-danger' : 'text-neutral-400'}`}>
          Drive 사용량: {formatGB(storageUsage.usageBytes)}GB / {formatGB(storageUsage.limitBytes)}GB
        </p>
      )}

      {newLessonInfo && (
        <div className="mt-3 rounded border border-accent-100 bg-accent-50 p-2 text-sm">
          <p className="font-medium">수업 {newLessonInfo.code} 생성됨 — 편집 키(이번만 표시됩니다, 저장해두세요)</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-neutral-0 px-2 py-1 text-xs">{newLessonInfo.editToken}</code>
            <button
              type="button"
              onClick={() => navigate(`/editor/${newLessonInfo.code}?key=${newLessonInfo.editToken}`)}
              className="tap-target shrink-0 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs"
            >
              편집기 열기
            </button>
          </div>
        </div>
      )}

      {loadError && <p className="mt-3 text-sm text-danger">{loadError}</p>}

      {lessons === null ? (
        <p className="mt-4 text-sm text-neutral-500">불러오는 중…</p>
      ) : lessons.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">아직 만들어진 수업이 없어요.</p>
      ) : (
        <>
          {/*
            좁은 화면(sm 미만)은 카드 목록. 예전엔 6컬럼 표를 overflow-x-auto에만 맡겨서
            모바일에서 컬럼이 눌려 찌그러지고 액션 버튼을 보려면 끝까지 밀어야 했다.
          */}
          <label className="mt-4 flex items-center gap-2 text-sm text-neutral-600 sm:hidden">
            <input type="checkbox" checked={selected.size === lessons.length} onChange={toggleSelectAll} />
            전체 선택
          </label>
          <ul className="mt-2 flex flex-col gap-2 sm:hidden">
            {lessons.map((l) => (
              <li key={l.code} className="rounded-lg border border-neutral-200 p-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(l.code)}
                    onChange={() => toggleSelected(l.code)}
                    className="mt-1"
                    aria-label={`${l.title} 선택`}
                  />
                  <span className="font-medium">{l.title}</span>
                </label>
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-mono">{l.code}</span> · {l.published ? '발행됨' : '미발행'} · 슬라이드 {l.slideCount}
                </p>
                <p className="text-xs text-neutral-400">{new Date(l.updatedAt).toLocaleString()}</p>
                <div className="mt-2">
                  <LessonActions
                    lesson={l}
                    busy={busyCode === l.code}
                    onDownload={() => void handleDownload(l.code)}
                    onEdit={() => void handleEdit(l.code)}
                    onDelete={() => void handleDelete(l.code, l.title)}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.size === lessons.length}
                      onChange={toggleSelectAll}
                      aria-label="전체 선택"
                    />
                  </th>
                  <th className="p-2">제목</th>
                  <th className="p-2">코드</th>
                  <th className="p-2">상태</th>
                  <th className="p-2">슬라이드</th>
                  <th className="p-2">마지막 수정</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.code} className="border-b border-neutral-100">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selected.has(l.code)}
                        onChange={() => toggleSelected(l.code)}
                        aria-label={`${l.title} 선택`}
                      />
                    </td>
                    <td className="p-2">{l.title}</td>
                    <td className="p-2 font-mono">{l.code}</td>
                    <td className="p-2">{l.published ? '발행됨' : '미발행'}</td>
                    <td className="p-2">{l.slideCount}</td>
                    <td className="p-2 text-neutral-500">{new Date(l.updatedAt).toLocaleString()}</td>
                    <td className="p-2">
                      <LessonActions
                        lesson={l}
                        busy={busyCode === l.code}
                        onDownload={() => void handleDownload(l.code)}
                        onEdit={() => void handleEdit(l.code)}
                        onDelete={() => void handleDelete(l.code, l.title)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {busyMessage && <BusyOverlay message={busyMessage} />}
    </PageShell>
  )
}
