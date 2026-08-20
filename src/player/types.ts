import type { GradeResult } from '../lib/grade'
import type { Identity, ResponseRecord } from '../api/types'

/**
 * 플레이어가 실제로 하는 일(채점·저장·제출)을 분리해, 학생 실전 화면(live)과
 * 교사 미리보기(preview)가 같은 UI 컴포넌트를 공유하게 한다.
 */
export interface PlayerAdapter {
  gradeAnswer: (questionId: string, value: unknown) => Promise<GradeResult | null>
  saveProgress: (record: Omit<ResponseRecord, 'submittedAt'>) => Promise<void>
  /** 기기를 바꿔도 이어할 수 있게 서버에 남아있는 진행상황을 가져온다. 미리보기는 항상 null. */
  getProgress: (studentKey: string, identity?: Identity) => Promise<ResponseRecord | null>
  /** 진입: 이어받기 + 자리 잡기를 한 번의 왕복으로. 미리보기는 항상 null. */
  enterLesson: (input: { studentKey: string; identity: Identity; startedAt: string; path: string[] }) => Promise<ResponseRecord | null>
  /** 여러 문항 일괄 채점 — 슬라이드를 넘길 때 공개하는 모드에서 왕복을 N→1 로 줄인다 */
  gradeAnswers: (items: { questionId: string; value: unknown }[]) => Promise<Record<string, GradeResult>>
  submitResponse: (record: ResponseRecord) => Promise<{ scores: ResponseRecord['scores'] }>
}
