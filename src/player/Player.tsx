import { useEffect, useMemo, useRef, useState } from 'react'
import { isQuestionAnswered } from '../blocks/questions/registry'
import { findQuestionInLesson } from '../lib/findQuestion'
import type { GradeResult } from '../lib/grade'
import { computeSlideNumbers } from '../lib/numbering'
import { resolveNextSlideId } from '../lib/navigate'
import { clearAllLocalProgress, clearLocalProgress, loadLocalProgress, saveLocalProgress } from '../lib/playerProgress'
import { shuffleLessonChoices } from '../lib/shuffleChoices'
import { cellForAnswer } from '../lib/resultsStats'
import { computeStudentKey } from '../lib/studentKey'
import { BusyOverlay } from '../components/BusyOverlay'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { Toast } from '../components/Toast'
import { EntryScreen } from './EntryScreen'
import { NavBar } from './NavBar'
import { PlayerMediaContext } from './PlayerMediaContext'
import { ProgressBar } from './ProgressBar'
import { SlideView } from './SlideView'
import { ReferenceDrawer } from '../reference/ReferenceDrawer'
import { SummaryView } from './SummaryView'
import { TestModeBar } from './TestModeBar'
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
  /** 교사 테스트 모드(`?test=<editToken>`) — 학생과 동일한 흐름이지만 배너·정답보기·잠금무시·경로표시가 추가된다 */
  isTest?: boolean
}

/*
 * 서버 자동저장 시점 (2026-08-18 변경).
 *
 * 예전에는 **답이 바뀔 때마다** 1.5초 디바운스로 보냈다. 문항 9개 수업이면 학생 한 명이
 * 14번쯤 보냈고, 그 요청들이 서버의 전역 락에서 줄을 서다 제출이 실패했다.
 * 이제는 **슬라이드를 넘길 때** 보내고, 한 슬라이드에 오래 머물면 **60초마다 한 번**만 보낸다.
 * 화면을 벗어날 때(탭 전환·닫기)도 한 번 보내 답을 잃지 않게 한다.
 *
 * 답이 바뀔 때마다 하던 **localStorage 저장은 그대로**다 — 같은 기기 새로고침 복구는 안 바뀐다.
 */
const SAVE_DELAY_MS = 800
const PERIODIC_SAVE_MS = 60_000
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

export function Player({ lesson: sourceLesson, code, adapter, mode, initialSlideId, isTest = false }: PlayerProps) {
  const [identity, setIdentity] = useState<Identity | null>(mode === 'preview' ? {} : null)
  const [studentKey, setStudentKey] = useState<string | null>(mode === 'preview' ? 'preview' : null)

  // settings.shuffleChoices가 켜져 있으면 이 학생 전용으로 보기 순서를 한 번 섞어두고, 아래
  // 코드는 전부 이 `lesson`만 본다. studentKey로 씨앗을 만들어 새로고침해도 순서가 유지된다.
  // 답은 보기 id로 저장되므로 채점·통계·엑셀은 원래 순서 기준 그대로다.
  const lesson = useMemo(() => (studentKey ? shuffleLessonChoices(sourceLesson, studentKey) : sourceLesson), [sourceLesson, studentKey])
  const [startedAt, setStartedAt] = useState<string | null>(mode === 'preview' ? new Date().toISOString() : null)
  const [restoredFromLocal, setRestoredFromLocal] = useState(false)

  const [path, setPath] = useState<string[]>([initialSlideId ?? lesson.slides[0]?.id])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [feedback, setFeedback] = useState<Record<string, GradeResult | null>>({})
  const [invalidQuestionIds, setInvalidQuestionIds] = useState<Set<string>>(new Set())
  const [lockedQuestionIds, setLockedQuestionIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [finalScores, setFinalScores] = useState<Record<string, GradeResult> | null>(null)
  const [showAnswers, setShowAnswers] = useState(false)

  const gradeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // live 모드(테스트 모드 제외): 같은 기기에서 새로고침한 경우 -- 식별 입력 없이 바로 이어서 진행.
  // 테스트 모드는 실제 학생의 로컬 캐시(같은 code 키)와 충돌하지 않도록 로컬 저장을 아예 안 쓴다.
  useEffect(() => {
    if (mode !== 'live' || isTest) {
      setRestoredFromLocal(true)
      return
    }
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
  }, [code, mode, isTest])

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
    let resumedStartedAt: string | null = null

    if (mode === 'live') {
      // ★ identity 를 함께 넘긴다 — 기기를 바꿔 열쇠가 달라도 학년·반·번호·이름이 같으면
      //   서버가 그 행을 찾아 준다(2026-08-19, Code.gs findRowIndexForRecord).
      const remote = await adapter.getProgress(key, enteredIdentity).catch(() => null)
      if (remote) {
        resumedAnswers = remote.answers
        resumedLocked = remote.lockedQuestionIds ?? []
        if (remote.path.length > 0) resumedPath = remote.path
        // ★ 시작 시각은 **서버에 남은 것을 그대로 쓴다.** 새로 찍으면 이어서 푸는 학생마다
        //   시작 시각이 밀려, 같은 학생인지 대조할 단서가 사라진다.
        if (remote.startedAt) resumedStartedAt = remote.startedAt
      }
    }

    const now = resumedStartedAt ?? new Date().toISOString()
    setIdentity(enteredIdentity)
    setStudentKey(key)
    setStartedAt(now)
    setAnswers(resumedAnswers)
    setLockedQuestionIds(new Set(resumedLocked))
    setPath(resumedPath)
    // ★ **디바운스를 기다리지 않고 이 자리에서** 기기에 남긴다.
    //   예전에는 800ms 디바운스 뒤에야 저장돼서, 그 사이에 새로고침·앱 전환이 일어나면
    //   진입 화면이 다시 떠 학생이 식별정보를 또 입력했다. 그 두 번째 진입이 아직 행이
    //   없는 상태로 저장을 또 보내 **같은 학생의 행이 두 개** 생겼다(마찰전기 수업 실제 사고).
    if (mode === 'live' && !isTest) {
      saveLocalProgress(code, {
        studentKey: key,
        identity: enteredIdentity,
        startedAt: now,
        path: resumedPath,
        answers: resumedAnswers,
        lockedQuestionIds: resumedLocked,
        submitted: false,
      })
    }
  }

  // 자동저장 (디바운스) — 식별 정보가 있고 아직 제출 전일 때만.
  // 타이머를 ref에 담아두는 이유: "제출하기"를 누르는 순간(buildAndSubmit) 아직 안 터진
  // 예약된 자동저장을 명시적으로 취소하기 위해서다 — 안 그러면 뒤늦게 도착한 자동저장이
  // submittedAt 없는 레코드로 방금 제출된 응답을 덮어써 "미제출"로 되돌릴 수 있다(서버 쪽에도
  // 같은 상황을 막는 방어를 추가했지만, 애초에 안 보내는 게 낫다).
  /** 지금 상태를 레코드로 굳힌다. 저장 경로들이 모두 이걸 쓴다. */
  const buildRecord = (): Omit<ResponseRecord, 'submittedAt'> => ({
    studentKey: studentKey!,
    identity: identity!,
    startedAt: startedAt!,
    path,
    answers,
    scores: {},
    isTest,
    lockedQuestionIds: [...lockedQuestionIds],
  })
  // 최신 값을 타이머·이벤트 안에서 읽기 위한 창구 (의존성 때문에 타이머를 다시 걸지 않으려고)
  const latest = useRef(buildRecord)
  latest.current = buildRecord
  const canSave = Boolean(identity && studentKey && startedAt && !submitted && mode === 'live')
  const canSaveRef = useRef(canSave)
  canSaveRef.current = canSave

  /** 서버로 한 번 보낸다. 실패는 조용히 넘긴다 — 다음 저장이나 제출에서 다시 올라간다. */
  const pushToServer = () => {
    if (!canSaveRef.current) return
    void adapter.saveProgress(latest.current()).catch(() => {})
  }

  // ① 답이 바뀌면 **기기에만** 저장한다 (서버는 안 부른다)
  useEffect(() => {
    if (!canSave || isTest) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      const r = latest.current()
      saveLocalProgress(code, { studentKey: r.studentKey, identity: r.identity, startedAt: r.startedAt, path: r.path, answers: r.answers, lockedQuestionIds: r.lockedQuestionIds ?? [], submitted: false })
    }, SAVE_DELAY_MS)
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, path, lockedQuestionIds, canSave, isTest])

  // ② 슬라이드를 넘기면 서버로 보낸다
  useEffect(() => {
    if (!canSave) return
    pushToServer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.length, path[path.length - 1], canSave])

  // ③ 한 슬라이드에 오래 머물러도 60초마다 한 번은 올린다 (긴 서술형에서 답을 잃지 않게)
  useEffect(() => {
    if (!canSave) return
    const timer = setInterval(pushToServer, PERIODIC_SAVE_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave])

  // ④ 탭을 가리거나 닫을 때 한 번 더 — 가장 흔한 유실 지점이다
  useEffect(() => {
    if (!canSave) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') pushToServer()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', pushToServer)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', pushToServer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave])

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
    // 예약된 자동저장이 있다면 취소한다 — 안 그러면 늦게 도착한 자동저장이 방금 제출한 응답을
    // submittedAt 없는 값으로 덮어써 "미제출"로 되돌릴 수 있다.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const record: ResponseRecord = {
      studentKey,
      identity,
      startedAt,
      submittedAt: new Date().toISOString(),
      path: finalPath,
      answers,
      scores: {},
      isTest,
      lockedQuestionIds: [...lockedQuestionIds],
    }
    setIsSubmitting(true)
    try {
      const { scores } = await adapter.submitResponse(record)
      setFinalScores(scores)
      setSubmitted(true)
      if (mode === 'live' && !isTest) {
        saveLocalProgress(code, { studentKey, identity, startedAt, path: finalPath, answers, lockedQuestionIds: [...lockedQuestionIds], submitted: true })
        clearLocalProgress(code) // 제출 완료 후에는 로컬 진행 캐시를 남겨둘 필요가 없다
      }
    } catch {
      // 제출 실패 시 "제출 중" 화면에 갇히지 않도록 풀어주고, 다시 시도할 수 있게 안내한다.
      showToast('제출에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** feedbackMode가 'onSlideLeave'인, 이미 답했지만 아직 채점 결과를 안 보여준 문항들 */
  function findUnrevealedSlideLeaveQuestions(): QuestionBlock[] {
    return currentSlide.blocks.filter(isQuestionBlock).filter((b) => {
      const mode = b.q.feedbackOverride ?? lesson.settings.feedbackMode
      return mode === 'onSlideLeave' && isQuestionAnswered(b.q, answers[b.q.id]) && feedback[b.q.id] == null
    })
  }

  async function handleNext(bypassLock = false) {
    if (!bypassLock && liveInvalidIds.size > 0) {
      setInvalidQuestionIds(liveInvalidIds)
      showToast('답을 입력해야 다음으로 넘어갈 수 있어요')
      scrollToFirstInvalid(liveInvalidIds)
      return
    }
    setInvalidQuestionIds(new Set())

    // "슬라이드를 넘길 때 그 슬라이드 문항만 공개" 모드 — 첫 클릭은 정오답만 보여주고 멈춘다.
    // feedback이 채워지면(=공개됨) 두 번째 클릭부터는 더 이상 안 걸리고 정상적으로 다음으로 넘어간다.
    const unrevealed = findUnrevealedSlideLeaveQuestions()
    if (!bypassLock && unrevealed.length > 0) {
      const entries = await Promise.all(
        unrevealed.map(async (b) => [b.q.id, await adapter.gradeAnswer(b.q.id, answers[b.q.id]).catch(() => null)] as const),
      )
      setFeedback((prev) => {
        const next = { ...prev }
        for (const [id, result] of entries) if (result) next[id] = result
        return next
      })
      return
    }

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

  /** 테스트 모드 전용 — 처음부터 다시 풀어볼 수 있게 로컬 상태를 전부 되돌린다. */
  function handleRestart() {
    setIdentity(null)
    setStudentKey(null)
    setStartedAt(null)
    setPath([lesson.slides[0]?.id])
    setAnswers({})
    setFeedback({})
    setInvalidQuestionIds(new Set())
    setLockedQuestionIds(new Set())
    setSubmitted(false)
    setFinalScores(null)
  }

  if (mode === 'live' && !restoredFromLocal) return null // localStorage 확인 전 깜빡임 방지

  const testModeBar = isTest ? (
    <TestModeBar showAnswers={showAnswers} onToggleShowAnswers={() => setShowAnswers((v) => !v)} onRestart={handleRestart} />
  ) : null

  // 마감된 수업은 아예 시작하지 못하게 막는다. 서버도 saveProgress/submitResponse를 거부하므로
  // 여기서 통과시켜 봐야 다 푼 뒤에 제출이 실패하는 최악의 순서가 된다. 교사 테스트 모드는 예외.
  if (lesson.settings.locked && !isTest) {
    return (
      <PageShell>
        <PageTitle>제출이 마감되었습니다</PageTitle>
        <p className="mt-2 text-neutral-500">{lesson.title}</p>
        <p className="mt-1 text-sm text-neutral-400">선생님이 이 수업의 제출을 마감했어요. 다시 열어야 한다면 선생님께 문의하세요.</p>
      </PageShell>
    )
  }

  if (identity === null) {
    return (
      <>
        {testModeBar}
        {/* 교사용 「수업 현황 보기」는 실제 수업 화면에서만 — 편집기 미리보기(preview)와
            교사 테스트 모드(isTest)에는 이미 다른 진입로가 있어 띄우지 않는다. */}
        <EntryScreen
          lesson={lesson}
          onSubmit={(v) => handleEntrySubmit(v)}
          liveCode={mode === 'live' && !isTest ? code : undefined}
        />
      </>
    )
  }

  if (submitted && finalScores) {
    const results: SummaryQuestionResult[] = []
    let totalPoints = 0
    let maxPoints = 0
    let anyVisible = false

    // 채점 결과가 있는 문항(finalScores) + 서답형 '채점 안함'처럼 채점기가 없어서
    // finalScores에는 아예 안 잡히지만 결과 화면에 답안만 보여줘야 하는 문항을 합친다.
    const scoredIds = new Set(Object.keys(finalScores))
    const ungradedIds = Object.keys(answers).filter((id) => {
      if (scoredIds.has(id)) return false
      const q = findQuestionInLesson(lesson, id)
      return q?.kind === 'short' && q.matchMode === 'none'
    })

    for (const questionId of [...scoredIds, ...ungradedIds]) {
      const question = findQuestionInLesson(lesson, questionId)
      if (!question) continue
      const effectiveMode = question.feedbackOverride ?? lesson.settings.feedbackMode
      if (effectiveMode === 'never') continue

      const result = finalScores[questionId] ?? null
      if (result) {
        anyVisible = true
        maxPoints += question.points
        totalPoints += result.points
      }

      if (effectiveMode === 'onFinish') {
        results.push({
          questionId,
          prompt: question.prompt,
          result,
          explanation: question.explanation,
          answerText: cellForAnswer(question, answers[questionId]),
        })
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
          predictAnswer: cellForAnswer(predictQ, answers[predictQ.id]) || '(응답 없음)',
          explainPrompt: explainQ.prompt,
          explainAnswer: cellForAnswer(explainQ, answers[explainQ.id]) || '(응답 없음)',
        })
      }
    }

    return (
      <>
        {testModeBar}
        <SummaryView
          lesson={lesson}
          totalPoints={anyVisible ? totalPoints : null}
          maxPoints={maxPoints}
          results={results}
          poePairs={poePairs}
          // 미리보기/테스트 모드는 애초에 이 기기에 아무것도 저장하지 않으므로 지울 것도 없다
          onClearDevice={mode === 'live' && !isTest ? clearAllLocalProgress : undefined}
        />
      </>
    )
  }

  const slideNumbers = computeSlideNumbers(lesson.slides)
  const visitedPathLabel = path.map((id) => slideNumbers[lesson.slides.findIndex((s) => s.id === id)]).join(' → ')

  return (
    <PlayerMediaContext.Provider value={{ code }}>
      {/* min-h-dvh: 모바일 주소창이 나타났다 사라지며 실제 보이는 높이가 바뀌는 걸 100vh는 반영
          못 해, 문항이 늘어 스크롤이 필요해질 때 아래 flex-1 영역 높이 계산이 어긋나 스크롤이
          어색해지는 원인이 될 수 있다 — dvh는 실제 표시 영역 기준이라 이 문제가 없다. */}
      <div className={`flex flex-col ${mode === 'live' ? 'min-h-dvh' : 'h-full'}`}>
        {testModeBar}
        <ProgressBar slides={lesson.slides} currentIndex={currentIndex} />
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {/* 넓은 화면(데스크톱 브라우저)에서 텍스트·문항이 화면 끝까지 늘어나 답답해 보이는 문제
              — 다른 화면들(PageShell 기준 max-w-3xl)과 맞춰 가운데로 정렬한다. 모바일 폭에서는
              max-w-3xl보다 화면이 항상 좁아 지금과 똑같이 보인다(레이아웃 변화 없음). */}
          <div className="mx-auto w-full max-w-3xl">
            <SlideView
              slide={currentSlide}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              feedback={feedback}
              defaultFeedbackMode={lesson.settings.feedbackMode}
              invalidQuestionIds={invalidQuestionIds}
              lockedQuestionIds={lockedQuestionIds}
              onLockQuestion={handleLockQuestion}
              showAnswers={isTest && showAnswers}
            />
          </div>
        </div>
        {isTest && liveInvalidIds.size > 0 && (
          <div className="border-t border-neutral-100 px-4 py-1 text-center">
            <button type="button" onClick={() => void handleNext(true)} className="tap-target text-xs text-neutral-500 underline">
              잠금 무시하고 다음 (테스트 전용)
            </button>
          </div>
        )}
        {isTest && <p className="border-t border-neutral-100 px-4 py-1 text-center text-xs text-neutral-400">지나온 경로: {visitedPathLabel}</p>}
        <NavBar
          canGoBack={lesson.settings.allowBackNavigation && path.length > 1}
          isLast={isLast}
          nextLocked={liveInvalidIds.size > 0}
          pendingReveal={liveInvalidIds.size === 0 && findUnrevealedSlideLeaveQuestions().length > 0}
          onBack={handleBack}
          onNext={() => void handleNext()}
        />
        <Toast message={toast} />
        <ReferenceDrawer settings={lesson.settings.referencePanel} />
        {isSubmitting && <BusyOverlay message="제출 중입니다…" />}
      </div>
    </PlayerMediaContext.Provider>
  )
}
