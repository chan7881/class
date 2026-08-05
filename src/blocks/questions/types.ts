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
  createDefault: (id: string) => Q
  Editor: ComponentType<QuestionEditorProps<Q>>
  Viewer: ComponentType<QuestionViewerProps<Q>>
  /** 생략하면 이 유형은 서버가 자동채점하지 않는다(예: 사진·그리기 — 정오답 개념이 없어 교사가 수기로 확인).
   *  함수가 있어도 특정 인스턴스에서 null을 돌려주면 그 문항만 채점 대상에서 빠진다
   *  (예: 서답형인데 교사가 정답을 하나도 안 정해둔 경우 — 자동채점 없이 자유 서술만 받는 의도적 설정). */
  grade?: (question: Q, value: unknown) => GradeResult | null
  isAnswered: (question: Q, value: unknown) => boolean
  /** 결과 표·엑셀 셀에 쓸 사람이 읽을 수 있는 문자열로 변환. 생략하면 문자열 값은 그대로, 그 외는 JSON으로 대체된다 */
  toCell?: (question: Q, value: unknown) => string
  /** 테스트 모드 "정답 보기"용 — 정답 자체를 사람이 읽을 수 있게 설명한다. 생략하면(사진·그리기 등) 정답 개념이 없다는 뜻 */
  describeAnswer?: (question: Q) => string | null
  /** 교사가 미리 정해둔 보기 중에서 고르는 유형인지(선택형·합답형). 결과 대시보드가 이 값으로
   *  "응답 분포 막대그래프가 의미 있는 문항"을 가른다 — 서답형·수치형처럼 학생이 자유롭게
   *  값을 쓰는 유형은 답이 거의 전부 달라서 막대가 1개씩 늘어설 뿐이라, 대신 답안 목록을 보여준다. */
  hasFixedOptions?: boolean
}
