import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ChartColumn,
  Copy,
  Ellipsis,
  Eye,
  FileDown,
  FlaskConical,
  KeyRound,
  Pencil,
  Redo2,
  Send,
  Settings,
  Undo2,
} from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { MenuButton, MenuItem } from '../components/MenuButton'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { Toast } from '../components/Toast'
import { BranchEditor } from '../editor/BranchEditor'
import { Canvas } from '../editor/Canvas'
import { EditorAuthContext } from '../editor/EditorContext'
import { PreviewFrame } from '../editor/PreviewFrame'
import { SettingsPanel } from '../editor/SettingsPanel'
import { SlideList } from '../editor/SlideList'
import { QrCodeButton } from '../components/QrCode'
import { buildPlayLink, buildRecoveryLink, buildTestModeLink, loadEditToken, saveEditToken } from '../lib/editorAuth'
import { computeSlideNumbers } from '../lib/numbering'
import { validateBranchGraph } from '../lib/navigate'
import { cloneLessonForDuplicate, exportLessonJson } from '../lib/portable'
import { useEditorStore } from '../store/editorStore'

const AUTOSAVE_DELAY_MS = 3000

export default function EditorPage() {
  const { code = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [editToken, setEditToken] = useState<string | null>(null)
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [rememberManualKey, setRememberManualKey] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const lesson = useEditorStore((s) => s.lesson)
  const currentSlideId = useEditorStore((s) => s.currentSlideId)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const loadLesson = useEditorStore((s) => s.loadLesson)
  const updateTitle = useEditorStore((s) => s.updateTitle)
  const updateDescription = useEditorStore((s) => s.updateDescription)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const markPublished = useEditorStore((s) => s.markPublished)
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
    markPublished()
    setSaveStatus('saved')
  }

  function handleManualKeySubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = manualKeyInput.trim()
    if (!trimmed) return
    saveEditToken(code, trimmed, rememberManualKey)
    setEditToken(trimmed)
  }

  function handleExport() {
    if (!lesson) return
    const blob = new Blob([exportLessonJson(lesson)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lesson.title}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDuplicate() {
    if (!lesson) return
    setDuplicating(true)
    try {
      // 복제는 API를 두 번 호출해 몇 초 걸린다. 예전엔 헤더 버튼 라벨이 "복제 중…"으로 바뀌어
      // 진행을 알렸지만 이제 이 액션은 더보기 메뉴 안에 있고 메뉴는 클릭 즉시 닫히므로,
      // 진행 상황을 토스트로 대신 보여준다(안 그러면 눌러도 아무 반응이 없는 것처럼 보인다).
      const clone = cloneLessonForDuplicate(lesson)
      const { code: newCode, editToken: newEditToken } = await api.createLesson({
        title: clone.title,
        identityFields: clone.settings.identityFields,
      })
      saveEditToken(newCode, newEditToken)
      await api.saveLesson(newCode, newEditToken, { ...clone, code: newCode })
      navigate(`/editor/${newCode}`)
    } finally {
      setDuplicating(false)
    }
  }

  if (!editToken) {
    return (
      <PageShell>
        <PageTitle>편집 키가 필요합니다</PageTitle>
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
        <label className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
          <input type="checkbox" checked={rememberManualKey} onChange={(e) => setRememberManualKey(e.target.checked)} />
          이 브라우저에 편집 키 저장(기본값 — 공용 PC라면 꺼두세요, 탭을 닫으면 편집 권한이 사라져요)
        </label>
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell>
        <PageTitle tone="danger">수업을 열 수 없습니다</PageTitle>
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
  const playLink = buildPlayLink(code)
  const branchValidation = validateBranchGraph(lesson.slides)
  const numbers = computeSlideNumbers(lesson.slides)

  return (
    <EditorAuthContext.Provider value={{ code, editToken }}>
      <div className="flex min-h-dvh flex-col">
        {/*
          액션이 10개 전부 한 줄에 늘어서 있어 위계가 없던 것을 상시 4개 + 더보기 메뉴 6개로 나눴다.
          ⚠️ 여기에 overflow-hidden을 추가하면 더보기 드롭다운(absolute)이 잘린다.
        */}
        <header className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-0 px-3 py-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              value={lesson.title}
              onChange={(e) => updateTitle(e.target.value)}
              aria-label="수업 제목"
              className="tap-target min-w-0 flex-1 rounded border border-transparent px-2 text-2xl font-bold outline-none focus:border-neutral-300"
            />
            {/* 저장 상태는 좁아져도 절대 숨기지 않는다 — "저장 실패"를 놓치면 작업이 날아간다 */}
            <span className="w-14 shrink-0 text-xs text-neutral-400">{saveStatusLabel}</span>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              aria-label="실행취소"
              className="disabled:opacity-30"
            >
              <Icon icon={Undo2} />
              <span className="hidden sm:inline">실행취소</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              aria-label="다시실행"
              className="disabled:opacity-30"
            >
              <Icon icon={Redo2} />
              <span className="hidden sm:inline">다시실행</span>
            </Button>

            <MenuButton
              ariaLabel="더보기"
              label={
                <>
                  <Icon icon={Ellipsis} />
                  <span className="hidden sm:inline">더보기</span>
                </>
              }
            >
              <MenuItem checked={showRecovery} onClick={() => setShowRecovery((v) => !v)}>
                <Icon icon={KeyRound} />
                편집 키 보기
              </MenuItem>
              <MenuItem checked={showSettings} onClick={() => setShowSettings((v) => !v)}>
                <Icon icon={Settings} />
                설정
              </MenuItem>
              <MenuItem onClick={handleExport}>
                <Icon icon={FileDown} />
                내보내기(.json)
              </MenuItem>
              <MenuItem onClick={() => void handleDuplicate()} disabled={duplicating}>
                <Icon icon={Copy} />
                {duplicating ? '복제 중…' : '복제'}
              </MenuItem>
              <MenuItem onClick={() => navigate(`/results/${code}`)}>
                <Icon icon={ChartColumn} />
                결과 보기
              </MenuItem>
              {/*
                경고를 title 툴팁이 아니라 라벨 자체에 넣는다 — 모바일에는 hover가 없어
                툴팁만으로는 이 경고가 전달되지 않았다.
              */}
              <MenuItem onClick={() => window.open(buildTestModeLink(code, editToken), '_blank', 'noopener')}>
                <Icon icon={FlaskConical} />
                <span className="min-w-0">
                  테스트 모드
                  <span className="block text-xs text-neutral-400">편집 키 포함 — 학생에게 공유 금지</span>
                </span>
              </MenuItem>
            </MenuButton>

            <Button variant="secondary" size="sm" onClick={() => setShowPreview((v) => !v)}>
              <Icon icon={showPreview ? Pencil : Eye} />
              {showPreview ? '편집으로' : '미리보기'}
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <Icon icon={Send} />
              {lesson.published ? '다시 발행' : '발행'}
            </Button>
          </div>
        </header>

        {showRecovery && (
          <div className="border-b border-accent-100 bg-accent-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-neutral-500">수업 코드 (학생이 홈 화면에서 직접 입력하는 코드)</span>
              <code className="rounded bg-neutral-0 px-2 py-1 text-xs font-semibold tracking-widest">{code}</code>
            </div>
            <p className="mt-2 font-medium">교사용 편집 링크 — 잃어버리면 복구할 수 없어요. 지금 저장해두세요.</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-neutral-0 px-2 py-1 text-xs">{buildRecoveryLink(code, editToken)}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(buildRecoveryLink(code, editToken))}
                className="tap-target shrink-0 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs"
              >
                복사
              </button>
            </div>
            {lesson.published && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-neutral-500">학생 참여 링크</span>
                <code className="min-w-0 flex-1 truncate rounded bg-neutral-0 px-2 py-1 text-xs">{playLink}</code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(playLink)}
                  className="tap-target shrink-0 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs"
                >
                  복사
                </button>
                <QrCodeButton value={playLink} label={`${lesson.title} 참여 QR코드`} />
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

        {!showPreview && (branchValidation.unreachableSlideIds.length > 0 || branchValidation.cyclicSlideIds.length > 0) && (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {branchValidation.unreachableSlideIds.length > 0 && (
              <p>
                도달 불가 슬라이드: {branchValidation.unreachableSlideIds.map((id) => numbers[lesson.slides.findIndex((s) => s.id === id)]).join(', ')} — 이 슬라이드로
                가는 분기 규칙이 없어요.
              </p>
            )}
            {branchValidation.cyclicSlideIds.length > 0 && (
              <p>
                순환 분기 주의: {branchValidation.cyclicSlideIds.map((id) => numbers[lesson.slides.findIndex((s) => s.id === id)]).join(', ')} — 탈출 규칙이 있는지
                확인하세요.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-1 flex-col md:flex-row">
          <aside className="w-full border-b border-neutral-200 md:w-64 md:border-b-0 md:border-r">
            <SlideList />
          </aside>
          <main className="flex-1 p-4">
            {currentSlide &&
              (showPreview ? (
                <PreviewFrame lesson={lesson} code={code} initialSlideId={currentSlide.id} />
              ) : (
                <>
                  <Canvas slide={currentSlide} />
                  <BranchEditor slide={currentSlide} allSlides={lesson.slides} />
                </>
              ))}
          </main>
        </div>
        <Toast message={duplicating ? '복제 중…' : null} />
      </div>
    </EditorAuthContext.Provider>
  )
}
