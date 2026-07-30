import type { Question, QuestionKind } from '../types/lesson'

/**
 * 문항 유형별 채점을 레지스트리로 관리한다 — src/blocks/registry.ts와 같은 철학이다
 * (CLAUDE.md 규칙 1, 4). 각 문항 블록(src/blocks/questions/*, 3~4단계·7~8단계에서 구현)이
 * 자기 채점 로직을 `registerGrader`로 등록한다. 이 파일 자체는 어떤 문항 유형도 모른다.
 *
 * 지금은 문항 유형이 하나도 구현되지 않아 레지스트리가 비어 있다 — 정상이다.
 */

export interface GradeResult {
  correct: boolean
  points: number
  /** 서답형 키워드 채점처럼 일부만 맞아 절반 점수를 받았을 때 — correct는 false로 두고("오답" 문구
   *  그대로), UI가 빨간색 대신 노란색으로 구분해 보여줄 때만 이 플래그를 본다. */
  partial?: boolean
}

export type Grader<Q extends Question = Question> = (question: Q, value: unknown) => GradeResult | null

const graders = new Map<QuestionKind, Grader>()

export function registerGrader<K extends QuestionKind>(
  kind: K,
  grader: Grader<Extract<Question, { kind: K }>>,
): void {
  graders.set(kind, grader as Grader)
}

/**
 * 채점기가 없으면 null을 반환한다(예: 서답형처럼 원래 자동채점이 없는 유형, 혹은 아직
 * 구현 안 된 유형). null과 "채점했지만 틀림"을 헷갈리지 않도록 별도 반환값을 쓴다.
 */
export function gradeQuestion(question: Question, value: unknown): GradeResult | null {
  const grader = graders.get(question.kind)
  return grader ? grader(question, value) : null
}

export function hasGrader(kind: QuestionKind): boolean {
  return graders.has(kind)
}
