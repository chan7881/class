import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { PageShell } from '../components/PageShell'
import { Canvas } from '../editor/Canvas'
import { EditorAuthContext } from '../editor/EditorContext'
import { PreviewFrame } from '../editor/PreviewFrame'
import { SettingsPanel } from '../editor/SettingsPanel'
import { SlideList } from '../editor/SlideList'
import { buildRecoveryLink, loadEditToken, saveEditToken } from '../lib/editorAuth'
import { useEditorStore } from '../store/editorStore'

const AUTOSAVE_DELAY_MS = 3000

export default function EditorPage() {
  const { code = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [editToken, setEditToken] = useState<string | null>(null)
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const lesson = useEditorStore((s) => s.lesson)
  const currentSlideId = useEditorStore((s) => s.currentSlideId)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const loadLesson = useEditorStore((s) => s.loadLesson)
  const updateTitle = useEditorStore((s) => s.updateTitle)
  const updateDescription = useEditorStore((s) => s.updateDescription)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.canUndo())
  const canRedo = useEditorStore((s) => s.canRedo())

  // 발행/공유 화면에서 만든 복구 링크(?key=...)로 들어오면, localStorage로 옮기고 주소에서는 지운다.
  useEffect(() => {
    const key = searchParams.get('key')
    if (key && code) {
      saveEditToken(code, key)
      const next = new URLSearchParams(searchParams)
      next.delete('key')
      setSearchParams(next, { replace: true })
      setShowRecovery(true)
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
    api
      .getLessonForEdit(code, editToken)
      .then((loaded) => {
        if (!cancelled) loadLesson(loaded)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '수업을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, editToken])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!lesson || !editToken) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api
        .saveLesson(code, editToken, lesson)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, AUTOSAVE_DELAY_MS)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson])

  async function handlePublish() {
    if (!editToken) return
    await api.publishLesson(code, editToken)
    setSaveStatus('saved')
  }

  function handleManualKeySubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = manualKeyInput.trim()
    if (!trimmed) return
    saveEditToken(code, trimmed)
    setEditToken(trimmed)
  }

  if (!editToken) {
    return (
      <PageShell>
        <h1 className="text-xl font-semibold">편집 키가 필요합니다</h1>
        <p className="mt-2 text-sm text-neutral-500">
          이 수업을 처음 만들 때 받은 편집 키(복구 링크)가 이 브라우저에는 없어요. 복구 링크를 다시 열거나, 편집 키를 직접 붙여넣으세요.
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
        <h1 className="text-xl font-semibold text-danger">수업을 열 수 없습니다</h1>
        <p className="mt-2 text-sm text-neutral-500">{loadError}</p>
      </PageShell>
    )
  }

  if (!lesson) {
    return (
      <PageShell>
        <p className="text-neutral-500">불러오는 중…</p>
      </PageShell>
    )
  }

  const currentSlideIndex = Math.max(0, lesson.slides.findIndex((s) => s.id === currentSlideId))
  const currentSlide = lesson.slides[currentSlideIndex] ?? lesson.slides[0]
  const saveStatusLabel = { idle: '', saving: '저장 중…', saved: '저장됨', error: '저장 실패' }[saveStatus]
  const playLink = `${window.location.origin}${window.location.pathname}#/play/${code}`

  return (
    <EditorAuthContext.Provider value={{ code, editToken }}>
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
          <input
            value={lesson.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="tap-target min-w-0 flex-1 rounded border border-transparent px-2 text-lg font-semibold outline-none focus:border-neutral-300"
          />
          <span className="w-14 shrink-0 text-xs text-neutral-400">{saveStatusLabel}</span>
          <button type="button" onClick={undo} disabled={!canUndo} className="tap-target rounded px-2 text-sm text-neutral-500 disabled:opacity-30">
            ↶ 실행취소
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} className="tap-target rounded px-2 text-sm text-neutral-500 disabled:opacity-30">
            ↷ 다시실행
          </button>
          <button type="button" onClick={() => setShowRecovery((v) => !v)} className="tap-target rounded px-2 text-sm text-neutral-500">
            편집 키 보기
          </button>
          <button type="button" onClick={() => setShowSettings((v) => !v)} className="tap-target rounded px-2 text-sm text-neutral-500">
            ⚙️ 설정
          </button>
          <Button variant="secondary" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? '편집으로' : '미리보기'}
          </Button>
          <Button onClick={handlePublish}>{lesson.published ? '다시 발행' : '발행'}</Button>
        </header>

        {showRecovery && (
          <div className="border-b border-accent-100 bg-accent-50 px-3 py-2 text-sm">
            <p className="font-medium">교사용 편집 링크 — 잃어버리면 복구할 수 없어요. 지금 저장해두세요.</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{buildRecoveryLink(code, editToken)}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(buildRecoveryLink(code, editToken))}
                className="tap-target shrink-0 rounded border border-neutral-300 bg-white px-2 text-xs"
              >
                복사
              </button>
            </div>
            {lesson.published && (
              <div className="mt-1 flex items-center gap-2">
                <span className="shrink-0 text-neutral-500">학생 참여 링크</span>
                <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{playLink}</code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(playLink)}
                  className="tap-target shrink-0 rounded border border-neutral-300 bg-white px-2 text-xs"
                >
                  복사
                </button>
              </div>
            )}
          </div>
        )}

        {showSettings && (
          <SettingsPanel
            lesson={lesson}
            onUpdateSettings={updateSettings}
            onUpdateDescription={updateDescription}
            onClose={() => setShowSettings(false)}
          />
        )}

        <div className="flex flex-1 flex-col md:flex-row">
          <aside className="w-full border-b border-neutral-200 md:w-64 md:border-b-0 md:border-r">
            <SlideList />
          </aside>
          <main className="flex-1 p-4">
            {currentSlide &&
              (showPreview ? (
                <PreviewFrame lesson={lesson} code={code} initialSlideIndex={currentSlideIndex} />
              ) : (
                <Canvas slide={currentSlide} />
              ))}
          </main>
        </div>
      </div>
    </EditorAuthContext.Provider>
  )
}
