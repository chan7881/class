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

  if ('answer' in rest) {
    const { answer: _answer, ...withoutAnswer } = rest
    return withoutAnswer as Question
  }

  return rest
}
