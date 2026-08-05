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
