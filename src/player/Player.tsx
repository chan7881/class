import { useEffect, useRef, useState } from 'react'
import { isQuestionAnswered } from '../blocks/questions/registry'
import { findQuestionInLesson } from '../lib/findQuestion'
import type { GradeResult } from '../lib/grade'
import { resolveNextSlideId } from '../lib/navigate'
import { clearLocalProgress, loadLocalProgress, saveLocalProgress } from '../lib/playerProgress'
import { computeStudentKey } from '../lib/studentKey'
import { Toast } from '../components/Toast'
import { EntryScreen } from './EntryScreen'
import { NavBar } from './NavBar'
import { PlayerMediaContext } from './PlayerMediaContext'
import { ProgressBar } from './ProgressBar'
import { SlideView } from './SlideView'
import { ReferenceDrawer } from '../reference/ReferenceDrawer'
import { SummaryView } from './SummaryView'
import type { PoePair, SummaryQuestionResult } from './SummaryView'
import type { Identity, ResponseRecord } from '../api/types'
import type { Block, Lesson, QuestionBlock, Slide } from '../types/lesson'
import type { PlayerAdapter } from './types'

function isQuestionBlock(block: Block): block is QuestionBlock {
  return block.type === 'question'
}

interface PlayerProps {
  lesson: Lesson
  code: string
  adapter: PlayerAdapter
  /** 'preview'는 교사 미리보기 — 식별 입력을 건너뛰고, 진행상황을 어디에도 저장하지 않는다 */
  mode: 'live' | 'preview'
  /** 미리보기에서 "지금 편집 중인 슬라이드부터" 보여주고 싶을 때 */
  initialSlideId?: string
}

const SAVE_DELAY_MS = 1500
const DEBOUNCE_GRADE_MS = 600

function findInvalidQuestionIds(slide: Slide, answers: Record<string, unknown>, requireAnswerToAdvance: boolean): Set<string> {
  const invalid = new Set<string>()
  if (!requireAnswerToAdvance) return invalid
  for (const block of slide.blocks) {
    if (block.type === 'question' && block.q.required && !isQuestionAnswered(block.q, answers[block.q.id])) {
      invalid.add(block.q.id)
    }
  }
  return invalid
}

function formatAnswerForDisplay(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(응답 없음)'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => formatAnswerForDisplay(v)).join(', ')
  return JSON.stringify(value)
}

export function Player({ lesson, code, adapter, mode, initialSlideId }: PlayerProps) {
  const [identity, setIdentity] = useState<Identity | null>(mode === 'preview' ? {} : null)
  const [studentKey, setStudentKey] = useState<string | null>(mode === 'preview' ? 'preview' : null)
  const [startedAt, setStartedAt] = useState<string | null>(mode === 'preview' ? new Date().toISOString() : null)
  const [restoredFromLocal, setRestoredFromLocal] = useState(false)

  const [path, setPath] = useState<string[]>([initialSlideId ?? lesson.slides[0]?.id])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [feedback, setFeedback] = useState<Record<string, GradeResult | null>>({})
  const [invalidQuestionIds, setInvalidQuestionIds] = useState<Set<string>>(new Set())
  const [lockedQuestionIds, setLockedQuestionIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [finalScores, setFinalScores] = useState<Record<string, GradeResult> | null>(null)

  const gradeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // live 모드: 같은 기기에서 새로고침한 경우 -- 식별 입력 없이 바로 이어서 진행
  useEffect(() => {
    if (mode !== 'live') return
    const stored = loadLocalProgress(code)
    if (stored && !stored.submitted) {
      setIdentity(stored.identity)
      setStudentKey(stored.studentKey)
      setStartedAt(stored.startedAt)
      setAnswers(stored.answers)
      setLockedQuestionIds(new Set(stored.lockedQuestionIds))
      setPath(stored.path.length > 0 ? stored.path : [lesson.slides[0]?.id])
    }
    setRestoredFromLocal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  async function handleEntrySubmit(enteredIdentity: Identity) {
    const key = await computeStudentKey(code, enteredIdentity)
    let resumedAnswers: Record<string, unknown> = {}
    let resumedPath = [lesson.slides[0]?.id]
    let resumedLocked: string[] = []

    if (mode === 'live') {
      const remote = await adapter.getProgress(key).catch(() => null)
      if (remote) {
        resumedAnswers = remote.answers
        resumedLocked = remote.lockedQuestionIds ?? []
        if (remote.path.length > 0) resumedPath = remote.path
      }
    }

    const now = new Date().toISOString()
    setIdentity(enteredIdentity)
    setStudentKey(key)
    setStartedAt(now)
    setAnswers(resumedAnswers)
    setLockedQuestionIds(new Set(resumedLocked))
    setPath(resumedPath)
  }

  // 자동저장 (디바운스) — 식별 정보가 있고 아직 제출 전일 때만
  useEffect(() => {
    if (!identity || !studentKey || !startedAt || submitted) return
    const timer = setTimeout(() => {
      const record: Omit<ResponseRecord, 'submittedAt'> = {
        studentKey,
        identity,
        startedAt,
        path,
        answers,
        scores: {},
        isTest: false,
        lockedQuestionIds: [...lockedQuestionIds],
      }
      if (mode === 'live') {
        saveLocalProgress(code, { studentKey, identity, startedAt, path, answers, lockedQuestionIds: [...lockedQuestionIds], submitted: false })
        void adapter.saveProgress(record)
      }
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, path, identity, studentKey, startedAt, submitted, lockedQuestionIds])

  function handleAnswerChange(questionId: string, value: unknown) {
    if (lockedQuestionIds.has(questionId)) return // 서버와 마찬가지로 클라이언트도 잠긴 답은 수정 거부
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setInvalidQuestionIds((prev) => {
      if (!prev.has(questionId)) return prev
      const next = new Set(prev)
      next.delete(questionId)
      return next
    })

    const question = findQuestionInLesson(lesson, questionId)
    if (!question) return
    const mode2 = question.feedbackOverride ?? lesson.settings.feedbackMode
    if (mode2 !== 'immediate') return

    if (gradeTimers.current[questionId]) clearTimeout(gradeTimers.current[questionId])
    gradeTimers.current[questionId] = setTimeout(() => {
      if (!isQuestionAnswered(question, value)) return
      void adapter.gradeAnswer(questionId, value).then((result) => {
        setFeedback((prev) => ({ ...prev, [questionId]: result }))
      })
    }, DEBOUNCE_GRADE_MS)
  }

  function handleLockQuestion(questionId: string) {
    setLockedQuestionIds((prev) => new Set(prev).add(questionId))
  }

  const currentSlideId = path[path.length - 1]
  const currentSlide = lesson.slides.find((s) => s.id === currentSlideId) ?? lesson.slides[0]
  const currentIndex = lesson.slides.findIndex((s) => s.id === currentSlide.id)
  // 분기가 없는 슬라이드에서만 미리 "마지막"으로 확정한다 — 분기가 있으면 채점 결과에 따라 갈리므로 다음 클릭 때 실제로 판단한다
  const isLast = !currentSlide.branch && resolveNextSlideId(lesson.slides, currentSlide.id) === null
  // 버튼이 흐려 보이는 건 매 렌더마다 실시간으로 판단한다 — 링 표시(공격적으로 느껴질 수 있음)와는 분리
  const liveInvalidIds = findInvalidQuestionIds(currentSlide, answers, lesson.settings.requireAnswerToAdvance)

  function scrollToFirstInvalid(ids: Set<string>) {
    const firstBlock = currentSlide.blocks.filter(isQuestionBlock).find((b) => ids.has(b.q.id))
    if (firstBlock) document.getElementById(`question-${firstBlock.q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function buildAndSubmit(finalPath: string[]) {
    if (!identity || !studentKey || !startedAt) return
    const record: ResponseRecord = {
      studentKey,
      identity,
      startedAt,
      submittedAt: new Date().toISOString(),
      path: finalPath,
      answers,
      scores: {},
      isTest: false,
      lockedQuestionIds: [...lockedQuestionIds],
    }
    const { scores } = await adapter.submitResponse(record)
    setFinalScores(scores)
    setSubmitted(true)
    if (mode === 'live') {
      saveLocalProgress(code, { studentKey, identity, startedAt, path: finalPath, answers, lockedQuestionIds: [...lockedQuestionIds], submitted: true })
      clearLocalProgress(code) // 제출 완료 후에는 로컬 진행 캐시를 남겨둘 필요가 없다
    }
  }

  async function handleNext() {
    if (liveInvalidIds.size > 0) {
      setInvalidQuestionIds(liveInvalidIds)
      showToast('답을 입력해야 다음으로 넘어갈 수 있어요')
      scrollToFirstInvalid(liveInvalidIds)
      return
    }
    setInvalidQuestionIds(new Set())

    let branchContext: { grade: GradeResult | null; value: unknown } | undefined
    if (currentSlide.branch) {
      const value = answers[currentSlide.branch.questionId]
      const grade = await adapter.gradeAnswer(currentSlide.branch.questionId, value).catch(() => null)
      branchContext = { grade, value }
    }
    const nextId = resolveNextSlideId(lesson.slides, currentSlide.id, branchContext)
    if (nextId === null) {
      void buildAndSubmit(path)
    } else {
      setPath((prev) => [...prev, nextId])
    }
  }

  function handleBack() {
    if (!lesson.settings.allowBackNavigation || path.length <= 1) return
    setPath((prev) => prev.slice(0, -1))
  }

  if (mode === 'live' && !restoredFromLocal) return null // localStorage 확인 전 깜빡임 방지
  if (identity === null) return <EntryScreen lesson={lesson} onSubmit={(v) => void handleEntrySubmit(v)} />

  if (submitted && finalScores) {
    const results: SummaryQuestionResult[] = []
    let totalPoints = 0
    let maxPoints = 0
    let anyVisible = false

    for (const [questionId, result] of Object.entries(finalScores)) {
      const question = findQuestionInLesson(lesson, questionId)
      if (!question) continue
      const effectiveMode = question.feedbackOverride ?? lesson.settings.feedbackMode
      if (effectiveMode === 'never') continue

      anyVisible = true
      maxPoints += question.points
      if (result.correct) totalPoints += question.points

      if (effectiveMode === 'onFinish') {
        results.push({ questionId, prompt: question.prompt, result, explanation: question.explanation })
      }
    }

    const poePairs: PoePair[] = []
    for (const slide of lesson.slides) {
      for (const block of slide.blocks) {
        if (block.type !== 'poeGroup') continue
        const predictQ = findQuestionInLesson(lesson, block.predictId)
        const explainQ = findQuestionInLesson(lesson, block.explainId)
        if (!predictQ || !explainQ) continue
        poePairs.push({
          predictPrompt: predictQ.prompt,
          predictAnswer: formatAnswerForDisplay(answers[predictQ.id]),
          explainPrompt: explainQ.prompt,
          explainAnswer: formatAnswerForDisplay(answers[explainQ.id]),
        })
      }
    }

    return <SummaryView lesson={lesson} totalPoints={anyVisible ? totalPoints : null} maxPoints={maxPoints} results={results} poePairs={poePairs} />
  }

  return (
    <PlayerMediaContext.Provider value={{ code }}>
      <div className={`flex flex-col ${mode === 'live' ? 'min-h-screen' : 'h-full'}`}>
        <ProgressBar slides={lesson.slides} currentIndex={currentIndex} />
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <SlideView
            slide={currentSlide}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            feedback={feedback}
            defaultFeedbackMode={lesson.settings.feedbackMode}
            invalidQuestionIds={invalidQuestionIds}
            lockedQuestionIds={lockedQuestionIds}
            onLockQuestion={handleLockQuestion}
          />
        </div>
        <NavBar canGoBack={lesson.settings.allowBackNavigation && path.length > 1} isLast={isLast} nextLocked={liveInvalidIds.size > 0} onBack={handleBack} onNext={() => void handleNext()} />
        <Toast message={toast} />
        <ReferenceDrawer settings={lesson.settings.referencePanel} />
      </div>
    </PlayerMediaContext.Provider>
  )
}
