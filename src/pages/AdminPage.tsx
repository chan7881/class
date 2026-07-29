import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { PageShell } from '../components/PageShell'
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
    try {
      setLessons(await api.listLessons(pw))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다')
    }
  }

  async function handleDownload(code: string) {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw) return
    setBusyCode(code)
    try {
      const lesson = await api.adminGetLesson(code, pw)
      downloadJsonText(exportLessonJson(lesson), `${lesson.title}.json`)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '다운로드에 실패했습니다')
    } finally {
      setBusyCode(null)
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
    try {
      const { editToken } = await api.adminResetEditToken(code, pw)
      saveEditToken(code, editToken)
      navigate(`/editor/${code}?key=${editToken}`)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '편집기를 열지 못했습니다')
    } finally {
      setBusyCode(null)
    }
  }

  async function handleDelete(code: string, title: string) {
    const pw = sessionStorage.getItem(SESSION_KEY)
    if (!pw) return
    if (!window.confirm(`"${title}" (${code}) 수업을 완전히 삭제합니다. 응답·미디어까지 전부 지워지고 되돌릴 수 없어요. 계속할까요?`)) return
    setBusyCode(code)
    try {
      await api.adminDeleteLesson(code, pw)
      setLessons((prev) => prev?.filter((l) => l.code !== code) ?? null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '삭제에 실패했습니다')
    } finally {
      setBusyCode(null)
    }
  }

  async function handleCreate() {
    setCreating(true)
    setNewLessonInfo(null)
    try {
      const { code: newCode, editToken } = await api.createLesson({ title: '새 수업', identityFields: ['name'] })
      saveEditToken(newCode, editToken)
      setNewLessonInfo({ code: newCode, editToken })
      void reload()
    } finally {
      setCreating(false)
    }
  }

  if (!authed) {
    return (
      <PageShell>
        <h1 className="text-xl font-semibold">관리자 화면</h1>
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
        <h1 className="text-xl font-semibold">전체 수업 관리</h1>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY)
            setAuthed(false)
            setPassword('')
          }}
          className="tap-target rounded px-2 text-sm text-neutral-500"
        >
          잠그기
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void handleCreate()} disabled={creating}>
          {creating ? '만드는 중…' : '새 수업 만들기'}
        </Button>
        <button type="button" onClick={() => void reload()} className="tap-target rounded px-2 text-sm text-neutral-500">
          새로고침
        </button>
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
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{newLessonInfo.editToken}</code>
            <button
              type="button"
              onClick={() => navigate(`/editor/${newLessonInfo.code}?key=${newLessonInfo.editToken}`)}
              className="tap-target shrink-0 rounded border border-neutral-300 bg-white px-2 text-xs"
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
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
                  <td className="p-2">{l.title}</td>
                  <td className="p-2 font-mono">{l.code}</td>
                  <td className="p-2">{l.published ? '발행됨' : '미발행'}</td>
                  <td className="p-2">{l.slideCount}</td>
                  <td className="p-2 text-neutral-500">{new Date(l.updatedAt).toLocaleString()}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      {l.responseSpreadsheetId ? (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${l.responseSpreadsheetId}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tap-target flex items-center rounded border border-neutral-300 px-2 text-xs"
                        >
                          응답 시트
                        </a>
                      ) : (
                        <span
                          title="발행 후 생성됩니다"
                          className="tap-target flex items-center rounded border border-neutral-200 px-2 text-xs text-neutral-300"
                        >
                          응답 시트
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDownload(l.code)}
                        disabled={busyCode === l.code}
                        aria-label="다운로드"
                        title="다운로드 (.json)"
                        className="tap-target flex w-8 items-center justify-center rounded border border-neutral-300 text-sm leading-none disabled:opacity-50"
                      >
                        ⬇
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleEdit(l.code)}
                        disabled={busyCode === l.code}
                        className="tap-target rounded border border-neutral-300 px-2 text-xs disabled:opacity-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(l.code, l.title)}
                        disabled={busyCode === l.code}
                        className="tap-target rounded border border-neutral-300 px-2 text-xs text-danger disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  )
}
