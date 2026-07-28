import type { Identity } from '../api/types'

export interface StoredProgress {
  studentKey: string
  identity: Identity
  startedAt: string
  path: string[]
  answers: Record<string, unknown>
  currentSlideIndex: number
  submitted: boolean
}

const KEY_PREFIX = 'class:playerProgress:'

/** 새로고침·네트워크 끊김에 대비해 학생 진행상황을 이 기기에도 남겨둔다 (서버 saveProgress와 별개). */
export function saveLocalProgress(code: string, progress: StoredProgress): void {
  localStorage.setItem(KEY_PREFIX + code, JSON.stringify(progress))
}

export function loadLocalProgress(code: string): StoredProgress | null {
  const raw = localStorage.getItem(KEY_PREFIX + code)
  return raw ? (JSON.parse(raw) as StoredProgress) : null
}

export function clearLocalProgress(code: string): void {
  localStorage.removeItem(KEY_PREFIX + code)
}
