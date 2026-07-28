import { getQuestionDefinition } from '../blocks/questions/registry'
import type { Question } from '../types/lesson'

/**
 * 테스트 모드 "정답 보기"용 — registry의 describeAnswer를 호출한다. 정답 개념이 없는
 * 유형(사진·그리기)이나 아직 정답을 안 정한 문항은 null을 반환한다.
 */
export function describeCorrectAnswer(question: Question): string | null {
  const def = getQuestionDefinition(question.kind)
  return def?.describeAnswer ? def.describeAnswer(question) : null
}
