import { getQuestionDefinition } from '../blocks/questions/registry'
import { listQuestionsInLesson } from './findQuestion'
import type { Lesson, Question, QuestionKind } from '../types/lesson'

/**
 * "정답이 바뀌었는가"를 판정한다 — 수업을 다시 발행할 때 기존 응답을 재채점할지 묻기 위한 것.
 *
 * 지문·해설·순서처럼 **채점 결과를 바꾸지 않는 수정**에는 반응하면 안 된다. 발행할 때마다
 * 헛물어보면 교사가 확인창을 습관적으로 넘기게 되고, 정작 진짜 변경을 놓친다.
 * 그래서 **각 채점기가 실제로 읽는 필드만** 비교한다.
 */

/**
 * 채점기가 읽는 필드 목록. 각 문항의 `grade:` 구현과 짝이 맞아야 한다.
 *
 * ⚠️ 새 문항 유형을 추가하거나 채점기가 읽는 필드를 늘렸다면 **여기도 같이 고쳐야 한다.**
 *    빠뜨리면 정답을 바꿔도 재채점을 안 물어본다(조용한 실패). `answerKey.test.ts`가
 *    "채점기가 있는데 여기 없는 유형"을 찾아내 실패시키므로, 유형 추가는 테스트가 잡아 준다.
 *    다만 **기존 유형에 필드가 늘어난 것**까지는 테스트가 못 잡는다 — 채점기를 고칠 때 같이 볼 것.
 */
const GRADING_FIELDS: Partial<Record<QuestionKind, readonly string[]>> = {
  chem: ['answer', 'points'],
  choice: ['answer', 'points'],
  cloze: ['segments', 'points'],
  combo: ['answer', 'points'],
  match: ['answer', 'left', 'points'],
  math: ['answer', 'points'],
  numeric: ['answer', 'points', 'sigFigs', 'tolerance', 'unit', 'unitMode'],
  order: ['answer', 'items', 'points'],
  short: ['answer', 'keywordExpr', 'matchMode', 'points'],
}

/** 그 유형에 채점기가 있는가 (사진·그림·데이터표는 자동 채점을 하지 않는다) */
export function isGradedKind(kind: QuestionKind): boolean {
  return Boolean(getQuestionDefinition(kind)?.grade)
}

export function gradingFieldsOf(kind: QuestionKind): readonly string[] {
  return GRADING_FIELDS[kind] ?? []
}

/** 문항 하나의 "정답 지문" — 채점에 쓰이는 값만 모아 문자열로 굳힌다. */
function fingerprintQuestion(q: Question): string {
  const source = q as unknown as Record<string, unknown>
  const picked: Record<string, unknown> = { kind: q.kind }
  for (const field of gradingFieldsOf(q.kind)) picked[field] = source[field] ?? null
  return JSON.stringify(picked)
}

/** 수업 전체의 정답 지문. 문항 id → 지문. */
export function answerKeyOf(lesson: Lesson): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of listQuestionsInLesson(lesson)) {
    if (!isGradedKind(q.kind)) continue
    out[q.id] = fingerprintQuestion(q)
  }
  return out
}

/**
 * 두 수업 사이에서 **채점 결과가 달라질 수 있는** 문항 id를 찾는다.
 * 문항이 지워졌거나 새로 생긴 것도 포함한다 — 둘 다 기존 응답의 점수를 바꾼다.
 */
export function changedAnswerQuestionIds(before: Lesson, after: Lesson): string[] {
  const a = answerKeyOf(before)
  const b = answerKeyOf(after)
  const ids = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...ids].filter((id) => a[id] !== b[id]).sort()
}
