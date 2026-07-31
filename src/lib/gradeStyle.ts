import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GradeResult } from './grade'

export type GradeTone = 'correct' | 'partial' | 'wrong'

export interface GradeToneStyle {
  tone: GradeTone
  /** 배너/카드 테두리·배경·글자색 (index.css의 다크모드에서 함께 뒤집히는 토큰만 쓴다) */
  className: string
  icon: LucideIcon
  /** "✓ 정답" 같은 짧은 라벨 */
  label: string
  /** 부분정답처럼 왜 이 판정인지 덧붙일 말이 있을 때만 채워진다 */
  note?: string
}

/**
 * 채점 결과 하나를 화면 표현(색·아이콘·라벨)으로 바꾼다.
 *
 * 왜 순수 함수로 뽑았나: 진행 중 배너(`player/SlideView.tsx`)는 부분정답을 노란색으로
 * 구분해 보여주는데 제출 요약(`player/SummaryView.tsx`)은 같은 정보를 안 읽고 빨간 "오답"으로만
 * 표시하고 있었다 — 총점에는 절반 점수가 들어가 있는데 카드에는 오답으로 보여서 학생이 보기에
 * 점수와 표시가 어긋났다. 두 화면이 이 함수 하나를 같이 쓰게 해서 한쪽만 고치는 사고를 막는다.
 *
 * 색만으로 상태를 전달하지 않는다는 게 이 프로젝트 규칙이라(CLAUDE.md 규칙 9) 아이콘과
 * 텍스트 라벨을 항상 함께 돌려준다 — 색약 사용자와 흑백 인쇄에서도 구분돼야 한다.
 */
export function gradeTone(result: GradeResult): GradeToneStyle {
  if (result.correct) {
    return {
      tone: 'correct',
      className: 'border-success bg-green-50 text-green-800',
      icon: CircleCheck,
      label: '정답',
    }
  }
  if (result.partial) {
    return {
      tone: 'partial',
      className: 'border-warn bg-amber-50 text-amber-800',
      icon: TriangleAlert,
      label: '부분 정답',
      note: '일부 키워드만 포함됨 — 절반 점수',
    }
  }
  return {
    tone: 'wrong',
    className: 'border-danger bg-red-50 text-red-800',
    icon: CircleX,
    label: '오답',
  }
}
