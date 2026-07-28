import { migrateLesson } from './migrate'
import type { Lesson } from '../types/lesson'

/**
 * 수업 .json 내보내기·가져오기·복제 (docs/PLAN.md 「제품 자체의 유지보수성」 절 — 백엔드 사고나
 * 계정 문제에 대한 최후의 백업이자, 교사끼리 수업을 공유·재사용하는 수단).
 */

interface LessonExportFile {
  exportedAt: string
  lesson: Lesson
}

export function exportLessonJson(lesson: Lesson): string {
  const payload: LessonExportFile = { exportedAt: new Date().toISOString(), lesson }
  return JSON.stringify(payload, null, 2)
}

export class InvalidLessonFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidLessonFileError'
  }
}

/** 내보내기 파일(`{exportedAt, lesson}`)과 옛 버전의 순수 Lesson JSON 둘 다 받아들인다. */
export function importLessonJson(json: string): Lesson {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new InvalidLessonFileError('올바른 JSON 파일이 아니에요.')
  }

  const raw =
    parsed !== null && typeof parsed === 'object' && 'lesson' in (parsed as Record<string, unknown>)
      ? (parsed as Record<string, unknown>).lesson
      : parsed

  try {
    return migrateLesson(raw)
  } catch (e) {
    throw new InvalidLessonFileError(e instanceof Error ? e.message : '수업 파일을 읽을 수 없어요.')
  }
}

/**
 * 복제용 페이로드를 만든다. 새 code/editToken은 서버(`createLesson`)가 발급해야 하므로,
 * 여기서는 그 값을 뺀 나머지만 준비하고 호출부(EditorPage)가 새 code를 채워 넣는다.
 */
export function cloneLessonForDuplicate(lesson: Lesson): Omit<Lesson, 'code'> {
  const { code: _code, ...rest } = lesson
  return { ...rest, title: `${lesson.title} (사본)`, published: false, updatedAt: new Date().toISOString() }
}
