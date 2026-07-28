import type { ComponentType } from 'react'
import type { GradeResult } from '../../lib/grade'
import type { Question } from '../../types/lesson'

export interface QuestionEditorProps<Q extends Question> {
  question: Q
  onChange: (next: Q) => void
}

export interface QuestionViewerProps<Q extends Question> {
  question: Q
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

export interface QuestionDefinition<Q extends Question = Question> {
  kind: Q['kind']
  label: string
  icon: string
  createDefault: (id: string) => Q
  Editor: ComponentType<QuestionEditorProps<Q>>
  Viewer: ComponentType<QuestionViewerProps<Q>>
  /** 생략하면 이 유형은 서버가 자동채점하지 않는다(예: 사진·그리기 — 정오답 개념이 없어 교사가 수기로 확인) */
  grade?: (question: Q, value: unknown) => GradeResult
  isAnswered: (question: Q, value: unknown) => boolean
  /** 결과 표·엑셀 셀에 쓸 사람이 읽을 수 있는 문자열로 변환. 생략하면 문자열 값은 그대로, 그 외는 JSON으로 대체된다 */
  toCell?: (question: Q, value: unknown) => string
  /** 테스트 모드 "정답 보기"용 — 정답 자체를 사람이 읽을 수 있게 설명한다. 생략하면(사진·그리기 등) 정답 개념이 없다는 뜻 */
  describeAnswer?: (question: Q) => string | null
}
