import { api } from '../api/client'
import { findQuestionInLesson } from '../lib/findQuestion'
import { gradeQuestion, type GradeResult } from '../lib/grade'
import type { Lesson } from '../types/lesson'
import type { PlayerAdapter } from './types'

/**
 * 수업 중 채점은 **이 기기에서** 한다 (2026-10-13 사용자 결정, docs/DECISIONS.md).
 *
 * 예전에는 정답을 서버에만 두고 문항마다 Apps Script 를 왕복했다 — 한 번에 최소 1.2초라
 * 「넘길 때 공개」·분기 슬라이드에서 「다음」이 그만큼 멈췄다. 성적에 반영하는 평가가 아니라서
 * 정답을 학생 기기로 내려보내고 그 자리에서 채점한다. 제출 점수는 서버가 다시 채점해 남긴다.
 */
function createLocalGrader(lesson: Lesson): Pick<PlayerAdapter, 'gradeAnswer' | 'gradeAnswers'> {
  return {
    gradeAnswer: async (questionId, value) => {
      const question = findQuestionInLesson(lesson, questionId)
      return question ? gradeQuestion(question, value) : null
    },
    gradeAnswers: async (items) => {
      const out: Record<string, GradeResult> = {}
      for (const item of items) {
        const question = findQuestionInLesson(lesson, item.questionId)
        if (!question) continue
        const result = gradeQuestion(question, item.value)
        if (result) out[item.questionId] = result
      }
      return out
    },
  }
}

/**
 * `testEditToken`을 주면 saveProgress/submitResponse가 그 값을 함께 보낸다 — 서버가
 * `record.isTest`를 이 editToken과 대조해 검증한다(11단계, docs/DECISIONS.md 참고).
 */
export function createLiveAdapter(lesson: Lesson, testEditToken?: string): PlayerAdapter {
  const code = lesson.code
  return {
    ...createLocalGrader(lesson),
    saveProgress: (record) => api.saveProgress(code, record, testEditToken),
    getProgress: (studentKey, identity) => api.getProgress(code, studentKey, identity),
    enterLesson: (input) => api.enterLesson(code, { ...input, isTest: Boolean(testEditToken) }, testEditToken),
    submitResponse: (record) => api.submitResponse(code, record, testEditToken),
  }
}

/** 미리보기(교사 자신)는 서버에 아무것도 남기지 않는다. 채점은 실전과 똑같이 이 기기에서. */
export function createPreviewAdapter(lesson: Lesson): PlayerAdapter {
  const local = createLocalGrader(lesson)
  return {
    ...local,
    saveProgress: async () => {},
    getProgress: async () => null,
    enterLesson: async () => null,
    submitResponse: async (record) => ({
      scores: await local.gradeAnswers(Object.entries(record.answers).map(([questionId, value]) => ({ questionId, value }))),
    }),
  } satisfies PlayerAdapter
}
