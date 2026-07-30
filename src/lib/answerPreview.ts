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

/**
 * getAggregate가 돌려주는 집계는 저장된 원시 답을 "낱개 토큰"으로 평탄화한 것이라(선택형은
 * 옵션 id, 합답형은 조합 id 등) `toCell`처럼 값 전체가 아니라 토큰 하나만 사람이 읽는
 * 라벨로 바꿔야 한다 — 학급 응답 분포 차트에서 원시 id가 그대로 보이던 문제(2026-07-30) 수정용.
 * 매핑을 모르는 유형(서답형·수치형 등)은 토큰 자체가 이미 사람이 읽을 수 있는 값이라 그대로 둔다.
 */
export function describeAnswerToken(question: Question, token: string): string {
  switch (question.kind) {
    case 'choice':
      return question.options.find((o) => o.id === token)?.label ?? token
    case 'combo':
      return question.options.find((o) => o.id === token)?.label ?? token
    case 'order':
      return question.items.find((i) => i.id === token)?.label ?? token
    case 'match':
      return question.left.find((i) => i.id === token)?.label ?? question.right.find((i) => i.id === token)?.label ?? token
    default:
      return token
  }
}
