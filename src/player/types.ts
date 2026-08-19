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
  submitResponse: (record: ResponseRecord) => Promise<{ scores: ResponseRecord['scores'] }>
}
