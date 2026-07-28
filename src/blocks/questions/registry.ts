import { registerGrader } from '../../lib/grade'
import type { GradeResult } from '../../lib/grade'
import type { Question, QuestionKind } from '../../types/lesson'
import type { QuestionDefinition } from './types'

/**
 * 문항 kind → {label, icon, createDefault, Editor, Viewer, grade, isAnswered} 매핑.
 * src/blocks/registry.ts(콘텐츠 블록)와 같은 철학의 별도 레지스트리 — 문항은 kind가
 * 12종이라 따로 관리한다. 등록하는 순간 lib/grade.ts에도 채점기가 자동으로 연결된다.
 *
 * 새 문항 유형 추가 = 파일 하나 만들고 `registerQuestion(definition)` 호출.
 */
const registry = new Map<QuestionKind, QuestionDefinition<any>>()

export function registerQuestion<Q extends Question>(definition: QuestionDefinition<Q>): void {
  registry.set(definition.kind, definition)
  if (definition.grade) {
    registerGrader(definition.kind, definition.grade as (q: Question, value: unknown) => GradeResult)
  }
}

export function getQuestionDefinition(kind: QuestionKind): QuestionDefinition | undefined {
  return registry.get(kind)
}

export function listQuestionDefinitions(): QuestionDefinition[] {
  return [...registry.values()]
}

export function isQuestionAnswered(question: Question, value: unknown): boolean {
  const def = registry.get(question.kind)
  return def ? def.isAnswered(question, value) : false
}
