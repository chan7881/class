import { create } from 'zustand'
import type { Block, Lesson } from '../types/lesson'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const MAX_HISTORY = 50

interface EditorState {
  lesson: Lesson | null
  currentSlideId: string | null
  saveStatus: SaveStatus
  past: Lesson[]
  future: Lesson[]

  loadLesson: (lesson: Lesson) => void
  setSaveStatus: (status: SaveStatus) => void
  setCurrentSlide: (id: string) => void

  updateTitle: (title: string) => void
  updateSettings: (updater: (settings: Lesson['settings']) => Lesson['settings']) => void

  addSlide: (afterSlideId?: string) => string
  removeSlide: (slideId: string) => void
  duplicateSlide: (slideId: string) => void
  reorderSlides: (fromIndex: number, toIndex: number) => void
  toggleSubSlide: (slideId: string) => void

  addBlock: (slideId: string, block: Block, atIndex?: number) => void
  updateBlock: (slideId: string, blockId: string, updater: (block: Block) => Block) => void
  removeBlock: (slideId: string, blockId: string) => void
  reorderBlocks: (slideId: string, fromIndex: number, toIndex: number) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  /** 내부용 — 구조적 변경 액션들이 공통으로 쓰는 되돌리기 스냅샷 헬퍼 */
  commitStructural: (nextLesson: Lesson) => void
}

function newId(): string {
  return crypto.randomUUID()
}

export const useEditorStore = create<EditorState>((set, get) => ({
  lesson: null,
  currentSlideId: null,
  saveStatus: 'idle',
  past: [],
  future: [],

  loadLesson: (lesson) => set({ lesson, currentSlideId: lesson.slides[0]?.id ?? null, past: [], future: [] }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setCurrentSlide: (id) => set({ currentSlideId: id }),

  /**
   * 구조적 변경(슬라이드·블록 추가/삭제/재정렬)만 되돌리기 대상으로 삼는다.
   * 리치텍스트 타이핑 같은 세세한 변경까지 스냅샷하면 되돌리기 한 번에 지워지는 범위가
   * 너무 커지고 스택도 금방 찬다 — 타이핑 되돌리기는 TipTap/ProseMirror가 필드별로 이미 해준다.
   * (docs/DECISIONS.md 참고)
   */
  commitStructural(nextLesson: Lesson) {
    const { lesson, past } = get()
    if (!lesson) return
    set({
      lesson: nextLesson,
      past: [...past, lesson].slice(-MAX_HISTORY),
      future: [],
    })
  },

  updateTitle: (title) => {
    const { lesson } = get()
    if (!lesson) return
    set({ lesson: { ...lesson, title, updatedAt: new Date().toISOString() } })
  },

  updateSettings: (updater) => {
    const { lesson } = get()
    if (!lesson) return
    set({ lesson: { ...lesson, settings: updater(lesson.settings), updatedAt: new Date().toISOString() } })
  },

  addSlide: (afterSlideId) => {
    const { lesson } = get()
    if (!lesson) return ''
    const id = newId()
    const newSlide = { id, isSub: false, blocks: [] as Block[] }
    const index = afterSlideId ? lesson.slides.findIndex((s) => s.id === afterSlideId) : lesson.slides.length - 1
    const slides = [...lesson.slides]
    slides.splice(index + 1, 0, newSlide)
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
    set({ currentSlideId: id })
    return id
  },

  removeSlide: (slideId) => {
    const { lesson } = get()
    if (!lesson || lesson.slides.length <= 1) return
    const index = lesson.slides.findIndex((s) => s.id === slideId)
    const slides = lesson.slides.filter((s) => s.id !== slideId)
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
    const { currentSlideId } = get()
    if (currentSlideId === slideId) {
      const fallback = slides[Math.max(0, index - 1)]
      set({ currentSlideId: fallback?.id ?? null })
    }
  },

  duplicateSlide: (slideId) => {
    const { lesson } = get()
    if (!lesson) return
    const index = lesson.slides.findIndex((s) => s.id === slideId)
    if (index === -1) return
    const original = lesson.slides[index]
    const copy = {
      ...original,
      id: newId(),
      blocks: original.blocks.map((b) => ({ ...b, id: newId() })),
    }
    const slides = [...lesson.slides]
    slides.splice(index + 1, 0, copy)
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
    set({ currentSlideId: copy.id })
  },

  reorderSlides: (fromIndex, toIndex) => {
    const { lesson } = get()
    if (!lesson) return
    const slides = [...lesson.slides]
    const [moved] = slides.splice(fromIndex, 1)
    slides.splice(toIndex, 0, moved)
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
  },

  toggleSubSlide: (slideId) => {
    const { lesson } = get()
    if (!lesson) return
    const slides = lesson.slides.map((s) => (s.id === slideId ? { ...s, isSub: !s.isSub } : s))
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
  },

  addBlock: (slideId, block, atIndex) => {
    const { lesson } = get()
    if (!lesson) return
    const slides = lesson.slides.map((s) => {
      if (s.id !== slideId) return s
      const blocks = [...s.blocks]
      blocks.splice(atIndex ?? blocks.length, 0, block)
      return { ...s, blocks }
    })
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
  },

  updateBlock: (slideId, blockId, updater) => {
    const { lesson } = get()
    if (!lesson) return
    const slides = lesson.slides.map((s) =>
      s.id !== slideId ? s : { ...s, blocks: s.blocks.map((b) => (b.id === blockId ? updater(b) : b)) },
    )
    // 내용 편집은 되돌리기 스택에 안 남긴다(위 commitStructural 설명 참고) — lesson만 바로 교체
    set({ lesson: { ...lesson, slides, updatedAt: new Date().toISOString() } })
  },

  removeBlock: (slideId, blockId) => {
    const { lesson } = get()
    if (!lesson) return
    const slides = lesson.slides.map((s) => (s.id !== slideId ? s : { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }))
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
  },

  reorderBlocks: (slideId, fromIndex, toIndex) => {
    const { lesson } = get()
    if (!lesson) return
    const slides = lesson.slides.map((s) => {
      if (s.id !== slideId) return s
      const blocks = [...s.blocks]
      const [moved] = blocks.splice(fromIndex, 1)
      blocks.splice(toIndex, 0, moved)
      return { ...s, blocks }
    })
    get().commitStructural({ ...lesson, slides, updatedAt: new Date().toISOString() })
  },

  undo: () => {
    const { past, lesson, future } = get()
    if (past.length === 0 || !lesson) return
    const previous = past[past.length - 1]
    set({ lesson: previous, past: past.slice(0, -1), future: [lesson, ...future] })
  },

  redo: () => {
    const { future, lesson, past } = get()
    if (future.length === 0 || !lesson) return
    const next = future[0]
    set({ lesson: next, future: future.slice(1), past: [...past, lesson] })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}))
