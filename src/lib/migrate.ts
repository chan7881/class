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

const CURRENT_VERSION = 3 as const

export class UnknownLessonVersionError extends Error {
  constructor(version: unknown) {
    super(`알 수 없는 수업 스키마 버전입니다: ${JSON.stringify(version)}`)
    this.name = 'UnknownLessonVersionError'
  }
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

// version → 그 다음 버전으로 올리는 변환 함수.
const migrations: Record<number, (lesson: Record<string, unknown>) => Record<string, unknown>> = {
  // v2: 제목(heading) 블록이 평문 `text`에서 텍스트 블록과 같은 리치텍스트 `html`로 바뀌었다
  // (2026-07-30, 제목도 텍스트처럼 굵게·기울임 등 서식을 지정할 수 있어야 한다는 요청).
  // 옛 평문은 HTML 특수문자만 이스케이프해 그대로 옮긴다 — 서식은 없지만 내용은 그대로 보인다.
  1: (lesson) => ({
    ...lesson,
    version: 2,
    slides: Array.isArray(lesson.slides)
      ? (lesson.slides as Record<string, unknown>[]).map((slide) => ({
          ...slide,
          blocks: Array.isArray(slide.blocks)
            ? (slide.blocks as Record<string, unknown>[]).map((block) =>
                block.type === 'heading' && typeof block.text === 'string' ? { ...block, html: `<p>${escapeHtml(block.text)}</p>` } : block,
              )
            : slide.blocks,
        }))
      : lesson.slides,
  }),

  // v3: 과목·학년·단원 분류 필드와 응답 보관기간을 추가했다(2026-08-06).
  // 셋 다 선택 입력이라 옛 수업은 값이 비어 있는 채로 그대로 열리면 된다 — 굳이 채워 넣지 않는다.
  // 보관기간도 지정하지 않은 수업은 '무기한'으로 두어, 기존 수업의 응답이 갑자기 지워지는 일이 없게 한다.
  2: (lesson) => ({ ...lesson, version: 3 }),
}

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
