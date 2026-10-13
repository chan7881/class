import type { Lesson, Question } from '../types/lesson'

/**
 * 학생에게 내려줄 수업 JSON에서 정답·해설을 전부 제거한다.
 * `getLesson`(학생용 API)은 반드시 이 함수를 거쳐야 한다 (CLAUDE.md 규칙 3).
 */
export function stripAnswers(lesson: Lesson): Lesson {
  return {
    ...lesson,
    slides: lesson.slides.map((slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) => (block.type === 'question' ? { ...block, q: stripQuestionAnswer(block.q) } : block)),
    })),
  }
}

/**
 * 정답이 하나라도 실려 있는가 — `stripAnswers`를 거친 수업이면 false.
 *
 * 학생 기기 채점(2026-10-13)은 서버가 정답을 함께 내려줘야 성립한다. 서버를 아직 새로 배포하지
 * 않았거나 되돌렸는데 기기에서 채점하면 **전부 오답**이 된다. 그래서 플레이어는 이걸로 확인하고,
 * 정답이 없으면 예전처럼 서버에 채점을 맡긴다(`player/adapters.ts`).
 * 정답을 하나도 안 정한 수업도 false지만, 그때는 서버도 채점할 게 없어 결과가 같다.
 */
export function hasAnswerKey(lesson: Lesson): boolean {
  for (const slide of lesson.slides ?? []) {
    for (const block of slide?.blocks ?? []) {
      if (block?.type !== 'question' || !block.q) continue
      const q = block.q as Question & { answer?: unknown; keywordExpr?: unknown }
      if (q.answer != null || q.keywordExpr != null) return true
      if (q.kind === 'cloze' && (q.segments ?? []).some((seg) => seg?.t === 'blank' && seg.answer != null)) return true
    }
  }
  return false
}

function stripQuestionAnswer(q: Question): Question {
  const { explanation: _explanation, ...rest } = q

  if (rest.kind === 'cloze') {
    return {
      ...rest,
      segments: rest.segments.map((seg) => (seg.t === 'blank' ? { ...seg, answer: undefined } : seg)),
    }
  }

  // 서답형 키워드 채점의 `keywordExpr`("지진,(흔들림, 떨림), 땅")은 사실상 정답 그 자체다 —
  // `answer`만 지우면 이게 학생 응답에 그대로 실려 개발자도구로 채점 기준이 보인다(2026-08-06 발견).
  if (rest.kind === 'short') {
    const { answer: _answer, keywordExpr: _keywordExpr, ...withoutAnswer } = rest
    return withoutAnswer as Question
  }

  if ('answer' in rest) {
    const { answer: _answer, ...withoutAnswer } = rest
    return withoutAnswer as Question
  }

  return rest
}
