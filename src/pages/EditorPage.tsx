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
import { changedAnswerQuestionIds } from '../lib/answerKey'
import type { Lesson } from '../types/lesson'
import { BusyOverlay } from '../components/BusyOverlay'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { MenuButton, MenuItem } from '../components/MenuButton'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { BranchEditor } from '../editor/BranchEditor'
import { Canvas } from '../editor/Canvas'
import { EditorAuthContext } from '../editor/EditorContext'
import { PreflightDialog } from '../editor/PreflightDialog'
import { PreviewFrame } from '../editor/PreviewFrame'
import { SettingsPanel } from '../editor/SettingsPanel'
import { SlideList } from '../editor/SlideList'
import { QrCodeButton } from '../components/QrCode'
import { buildPlayLink, buildRecoveryLink, buildTestModeLink, loadEditToken, saveEditToken } from '../lib/editorAuth'
import { computeSlideNumbers } from '../lib/numbering'
import { validateBranchGraph } from '../lib/navigate'
import { cloneLessonForDuplicate, exportLessonJson } from '../lib/portable'
import { preflightLesson } from '../lib/preflight'
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
  const [showPreflight, setShowPreflight] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)
  const [slugMessage, setSlugMessage] = useState<string | null>(null)
  const [slugError, setSlugError] = useState(false)
  // 현황 암호 — 원문은 화면에 담아두지 않는다. 서버도 설정 여부(hasViewPassword)만 알려준다.
  const [viewPasswordInput, setViewPasswordInput] = useState('')
  const [hasViewPassword, setHasViewPassword] = useState(false)
  const [savingViewPassword, setSavingViewPassword] = useState(false)
  const [viewPasswordMessage, setViewPasswordMessage] = useState<string | null>(null)
  const [viewPasswordError, setViewPasswordError] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [regrading, setRegrading] = useState(false)
  /** 마지막으로 발행된(=학생이 그 정답으로 채점된) 수업. 정답 변경 감지의 기준점. */
  const publishedAnswerKey = useRef<Lesson | null>(null)

  const lesson = useEditorStore((s) => s.lesson)
  const currentSlideId = useEditorStore((s) => s.currentSlideId)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const loadLesson = useEditorStore((s) => s.loadLesson)
  const updateTitle = useEditorStore((s) => s.updateTitle)
  const updateDescription = useEditorStore((s) => s.updateDescription)
  const updateMeta = useEditorStore((s) => s.updateMeta)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const setCurrentSlide = useEditorStore((s) => s.setCurrentSlide)
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
        if (cancelled) return
        // slug는 수업 JSON이 아니라 서버 인덱스에 있는 값이라 스토어에 넣지 않고 이 화면에서만 쓴다
        setSlugInput(loaded.slug ?? '')
        setHasViewPassword(Boolean(loaded.hasViewPassword))
        // 발행할 때 "정답이 바뀌었나"를 판정하려면 **고치기 전** 정답이 필요하다.
        // 에디터는 자동저장을 하므로 서버에 물어보면 이미 새 정답이라 소용없다 —
        // 불러온 순간의 것을 여기에 잡아 둔다.
        publishedAnswerKey.current = loaded
        loadLesson(loaded)
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

  async function handleSaveSlug() {
    if (!editToken) return
    setSavingSlug(true)
    setSlugMessage(null)
    try {
      const { slug } = await api.setLessonSlug(code, editToken, slugInput)
      setSlugInput(slug)
      setSlugError(false)
      setSlugMessage(slug ? `이제 ${buildPlayLink(slug)} 로도 들어올 수 있어요` : '짧은 주소를 해제했어요')
    } catch (e: unknown) {
      setSlugError(true)
      setSlugMessage(e instanceof Error ? e.message : '짧은 주소를 저장하지 못했어요')
    } finally {
      setSavingSlug(false)
    }
  }

  /** 인자를 주면 그 값으로(빈 문자열 = 해제), 안 주면 입력칸 값으로 저장한다. */
  async function handleSaveViewPassword(explicit?: string) {
    if (!editToken) return
    const value = explicit ?? viewPasswordInput.trim()
    setSavingViewPassword(true)
    setViewPasswordMessage(null)
    try {
      const { hasViewPassword: next } = await api.setViewPassword(code, editToken, value)
      setHasViewPassword(next)
      setViewPasswordInput('') // 암호를 화면에 남겨두지 않는다
      setViewPasswordError(false)
      setViewPasswordMessage(next ? '현황 암호를 저장했어요' : '현황 암호를 해제했어요 (이제 편집 키로만 들어갈 수 있어요)')
    } catch (e: unknown) {
      setViewPasswordError(true)
      setViewPasswordMessage(e instanceof Error ? e.message : '현황 암호를 저장하지 못했어요')
    } finally {
      setSavingViewPassword(false)
    }
  }

  async function handlePublish() {
    if (!editToken || !lesson) return
    setPublishing(true)
    try {
      await api.publishLesson(code, editToken)
      markPublished()
      setSaveStatus('saved')
      setShowPreflight(false)
    } finally {
      setPublishing(false)
    }

    /*
     * 정답을 고쳐 다시 발행했다면, **이미 제출된 응답의 점수는 옛 정답으로 매겨진 채**다.
     * 여기서 묻지 않으면 교사는 결과 화면에서 틀린 점수를 보게 된다.
     * 지문·해설만 고친 경우에는 묻지 않는다 — 매번 물으면 확인창을 습관적으로 넘기게 된다.
     */
    const before = publishedAnswerKey.current
    /*
     * ⚠️ 여기는 **발행이 이미 성공한 뒤**다. 비교가 예외를 던지면 발행이 실패한 것처럼 보인다.
     *    옛 스키마로 저장된 수업 등 예상 못 한 모양이 들어올 수 있으므로 감싸 둔다.
     *    다만 **조용히 넘기지는 않는다** — 판정을 못 했으면 교사에게 물어보는 쪽으로 기운다.
     *    재채점은 점수만 다시 계산하는 안전한 작업이라, 헛물어보는 편이 놓치는 것보다 낫다.
     */
    let changed: string[]
    try {
      changed = before ? changedAnswerQuestionIds(before, lesson) : []
    } catch (e) {
      console.error('정답 변경 판정 실패 — 재채점 여부를 그냥 물어본다', e)
      changed = ['(판정 실패)']
    }
    publishedAnswerKey.current = lesson
    if (changed.length === 0) return

    const list = changed.slice(0, 5).join(', ') + (changed.length > 5 ? ` 외 ${changed.length - 5}개` : '')
    if (!window.confirm(`정답이 바뀐 문항이 ${changed.length}개 있습니다 (${list}).

이미 제출된 응답을 새 정답으로 다시 채점할까요?
점수만 다시 계산하며 학생이 쓴 답은 그대로 둡니다.`)) return

    setRegrading(true)
    try {
      const r = await api.regradeResponses(code, editToken)
      const tail = r.failed > 0 ? `

${r.failed}건은 다시 채점하지 못했습니다. 결과 화면에서 확인해 주세요.` : ''
      window.alert((r.regraded === 0 ? '다시 채점할 제출 응답이 없었습니다.' : `제출된 응답 ${r.regraded}건을 다시 채점했습니다.`) + tail)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '다시 채점하지 못했습니다')
    } finally {
      setRegrading(false)
    }
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
      // 복제는 API를 두 번 호출해 몇 초 걸린다. 이 액션은 더보기 메뉴 안에 있고 메뉴는 클릭
      // 즉시 닫히므로, 버튼 라벨로는 진행을 알릴 수가 없다 — 다른 느린 조작과 마찬가지로
      // 전체 화면 안내창(BusyOverlay)으로 알린다.
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
            <Button size="sm" onClick={() => setShowPreflight(true)}>
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

            {/* 짧은 주소 — 칠판에 적어주거나 말로 불러주기 좋게. 코드는 그대로 살아 있고 별칭만 하나 더 생긴다 */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSaveSlug()
              }}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <span className="shrink-0 text-neutral-500">짧은 주소 (선택)</span>
              <input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="예: 2-3전기"
                className="tap-target min-w-32 flex-1 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs outline-none focus:border-accent-500"
              />
              <button type="submit" disabled={savingSlug} className="tap-target shrink-0 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs">
                {savingSlug ? '저장 중…' : '적용'}
              </button>
              {slugMessage && <span className={`w-full text-xs ${slugError ? 'text-danger' : 'text-neutral-500'}`}>{slugMessage}</span>}
            </form>

            {/*
              현황 암호 — 진행 상황 화면(/live)에만 쓰는 낮은 권한의 열쇠.
              편집 키를 짧게 만드는 대신 이걸 따로 두었다(docs/DECISIONS.md 참고).
            */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSaveViewPassword()
              }}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <span className="shrink-0 text-neutral-500">현황 암호 (선택)</span>
              <input
                type="password"
                value={viewPasswordInput}
                onChange={(e) => setViewPasswordInput(e.target.value)}
                placeholder={hasViewPassword ? '설정됨 — 바꾸려면 새 암호 입력' : '수업 현황 화면에서 쓸 암호'}
                autoComplete="new-password"
                className="tap-target min-w-32 flex-1 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs outline-none focus:border-accent-500"
              />
              <button
                type="submit"
                disabled={savingViewPassword || !viewPasswordInput.trim()}
                className="tap-target shrink-0 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs disabled:text-neutral-400"
              >
                {savingViewPassword ? '저장 중…' : '적용'}
              </button>
              {hasViewPassword && (
                <button
                  type="button"
                  disabled={savingViewPassword}
                  onClick={() => void handleSaveViewPassword('')}
                  className="tap-target shrink-0 rounded border border-neutral-300 bg-neutral-0 px-2 text-xs"
                >
                  해제
                </button>
              )}
              <span className="w-full text-xs text-neutral-500">
                이 암호로는 <strong>진행 상황 보기만</strong> 됩니다 — 수업 수정·발행·삭제·결과 내려받기는 편집 키가 있어야 합니다.
              </span>
              {viewPasswordMessage && (
                <span className={`w-full text-xs ${viewPasswordError ? 'text-danger' : 'text-neutral-500'}`}>{viewPasswordMessage}</span>
              )}
            </form>
          </div>
        )}

        {showSettings && (
          <SettingsPanel
            lesson={lesson}
            onUpdateSettings={updateSettings}
            onUpdateDescription={updateDescription}
            onUpdateMeta={updateMeta}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showPreflight && (
          <PreflightDialog
            issues={preflightLesson(lesson)}
            published={lesson.published}
            publishing={publishing}
            onGoToSlide={(slideId) => {
              setCurrentSlide(slideId)
              setShowPreview(false)
              setShowPreflight(false)
            }}
            onPublish={handlePublish}
            onClose={() => setShowPreflight(false)}
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
        {/* 시간이 걸리는 조작은 전부 같은 안내창으로 알린다 — 반응이 없으면 학생·교사 모두
            버튼을 다시 누르게 되고, 발행·복제가 두 번 실행되는 사고로 이어진다. */}
        {publishing && <BusyOverlay message="발행하는 중입니다…" />}
        {/* 규칙 11 — 응답 수만큼 서버가 도는 작업이라 표시가 없으면 멈춘 줄 안다 */}
        {regrading && <BusyOverlay message="제출된 응답을 다시 채점하는 중입니다…" />}
        {duplicating && <BusyOverlay message="수업을 복제하는 중입니다…" />}
        {savingSlug && <BusyOverlay message="짧은 주소를 저장하는 중입니다…" />}
      </div>
    </EditorAuthContext.Provider>
  )
}
