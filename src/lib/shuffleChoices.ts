import type { Lesson, Question } from '../types/lesson'

/**
 * `settings.shuffleChoices`가 켜져 있을 때, 선택형 문항의 보기 순서를 학생마다 다르게 섞는다.
 *
 * 왜 학생별 고정 순서인가: 매번 새로 섞으면 새로고침이나 앞뒤 이동 때마다 보기가 튀어
 * "내가 아까 고른 게 두 번째였는데" 하는 혼란이 생긴다. studentKey와 문항 id로 씨앗을 만들어
 * 같은 학생·같은 문항이면 항상 같은 순서가 나오게 한다(저장할 필요도 없다).
 *
 * 답은 보기 id로 저장·채점하므로 순서를 바꿔도 채점 결과는 달라지지 않는다.
 * 합답형(combo)은 섞지 않는다 — 보기가 "① ㄱ ② ㄱㄴ"처럼 누적 구조라 순서 자체가 의미를 갖는다.
 * 순서맞추기(order)도 섞지 않는다 — 그 문항은 자기 뷰어가 이미 순서를 흐트러뜨려 낸다.
 */

/** 문자열 → 32비트 정수 해시(FNV-1a). 암호용이 아니라 순서 섞기용 씨앗이다. */
function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 — 씨앗 하나로 재현 가능한 난수열을 만든다 */
function makeRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates. 원본 배열은 건드리지 않는다 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = makeRandom(hashSeed(seed))
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function shuffleQuestion(question: Question, studentKey: string): Question {
  if (question.kind !== 'choice') return question
  return { ...question, options: seededShuffle(question.options, `${studentKey}:${question.id}`) }
}

export function shuffleLessonChoices(lesson: Lesson, studentKey: string): Lesson {
  if (!lesson.settings.shuffleChoices) return lesson
  return {
    ...lesson,
    slides: lesson.slides.map((slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) => (block.type === 'question' ? { ...block, q: shuffleQuestion(block.q, studentKey) } : block)),
    })),
  }
}
