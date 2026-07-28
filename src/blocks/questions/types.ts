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
  grade: (question: Q, value: unknown) => GradeResult
  isAnswered: (question: Q, value: unknown) => boolean
}
