import type { Lesson } from '../types/lesson'

/**
 * 저장된 수업 JSON을 현재 스키마(Lesson.version)까지 올려서 반환한다.
 *
 * 스키마를 바꿀 때마다 지킬 규칙 (CLAUDE.md 「반드시 지킬 코드 규칙」 5번):
 *   1. `migrations` 객체에 `{이전 버전 번호: 변환 함수}`를 추가한다.
 *   2. 기존 변환 함수는 절대 지우거나 고치지 않는다 — 몇 년 전에 만든 수업도 계속 열려야 한다.
 *   3. 새 변환 함수마다 migrate.test.ts에 픽스처(고정된 옛 버전 JSON 샘플)를 추가해 테스트한다.
 *
 * 예) v2를 추가할 때:
 *   const CURRENT_VERSION = 2
 *   const migrations: Record<number, (lesson: any) => any> = {
 *     1: (l) => ({ ...l, version: 2, settings: { ...l.settings, shuffleChoices: false } }),
 *   }
 */

const CURRENT_VERSION = 1 as const

export class UnknownLessonVersionError extends Error {
  constructor(version: unknown) {
    super(`알 수 없는 수업 스키마 버전입니다: ${JSON.stringify(version)}`)
    this.name = 'UnknownLessonVersionError'
  }
}

// version → 그 다음 버전으로 올리는 변환 함수. 지금은 v1이 전부라 비어 있다.
const migrations: Record<number, (lesson: Record<string, unknown>) => Record<string, unknown>> = {}

/** 버전 번호가 있는 평범한 객체인지만 확인한다 — 그 외 구조 검증은 하지 않는다 */
function hasVersion(raw: unknown): raw is { version: number } {
  return typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).version === 'number'
}

export function migrateLesson(raw: unknown): Lesson {
  if (!hasVersion(raw)) {
    throw new UnknownLessonVersionError(raw)
  }

  let lesson = raw as Record<string, unknown>
  let version = lesson.version as number

  if (version > CURRENT_VERSION) {
    // 미래 버전 — 이 코드가 아직 모르는 스키마이므로 임의로 다루지 않는다
    throw new UnknownLessonVersionError(version)
  }

  while (version < CURRENT_VERSION) {
    const step = migrations[version]
    if (!step) throw new UnknownLessonVersionError(version)
    lesson = step(lesson)
    version = lesson.version as number
  }

  return lesson as unknown as Lesson
}
