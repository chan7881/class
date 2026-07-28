import type { Lesson, Question } from '../types/lesson'

/** 수업 안에서 questionId로 문항을 찾는다. mock.ts와 player/adapters.ts가 공유한다. */
export function findQuestionInLesson(lesson: Lesson, questionId: string): Question | undefined {
  for (const slide of lesson.slides) {
    for (const block of slide.blocks) {
      if (block.type === 'question' && block.q.id === questionId) return block.q
    }
  }
  return undefined
}

/** 수업 안의 모든 문항을 슬라이드 순서대로 모은다. 결과 대시보드·엑셀 내보내기가 공유한다. */
export function listQuestionsInLesson(lesson: Lesson): Question[] {
  const questions: Question[] = []
  for (const slide of lesson.slides) {
    for (const block of slide.blocks) {
      if (block.type === 'question') questions.push(block.q)
    }
  }
  return questions
}
