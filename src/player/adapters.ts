import { api } from '../api/client'
import { findQuestionInLesson } from '../lib/findQuestion'
import { gradeQuestion, type GradeResult } from '../lib/grade'
import type { Lesson } from '../types/lesson'
import type { PlayerAdapter } from './types'

/**
 * `testEditToken`을 주면 saveProgress/submitResponse가 그 값을 함께 보낸다 — 서버가
 * `record.isTest`를 이 editToken과 대조해 검증한다(11단계, docs/DECISIONS.md 참고).
 */
export function createLiveAdapter(code: string, testEditToken?: string): PlayerAdapter {
  return {
    gradeAnswer: (questionId, value) => api.gradeAnswer(code, questionId, value),
    saveProgress: (record) => api.saveProgress(code, record, testEditToken),
    getProgress: (studentKey, identity) => api.getProgress(code, studentKey, identity),
    submitResponse: (record) => api.submitResponse(code, record, testEditToken),
  }
}

/** 미리보기(교사 자신)는 서버 왕복 없이 그 자리에서 채점한다 — 교사는 어차피 정답을 볼 수 있다. */
export function createPreviewAdapter(lesson: Lesson): PlayerAdapter {
  return {
    gradeAnswer: async (questionId, value) => {
      const question = findQuestionInLesson(lesson, questionId)
      return question ? gradeQuestion(question, value) : null
    },
    saveProgress: async () => {},
    getProgress: async () => null,
    submitResponse: async (record) => {
      const scores: Record<string, GradeResult> = {}
      for (const [questionId, value] of Object.entries(record.answers)) {
        const question = findQuestionInLesson(lesson, questionId)
        if (!question) continue
        const result = gradeQuestion(question, value)
        if (result) scores[questionId] = result
      }
      return { scores }
    },
  } satisfies PlayerAdapter
}
