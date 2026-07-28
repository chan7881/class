import { mockApi } from './mock'
import type { ApiClient } from './types'

/**
 * 앱 전체가 이 파일 하나만 import 한다 — mock/live 전환이 여기 한 곳에서만 일어나야
 * 에디터·플레이어·결과 대시보드 코드가 6단계(실제 Apps Script 연동) 이후에도 안 바뀐다.
 */

class NotImplementedLiveClient implements ApiClient {
  private fail(): never {
    throw new Error(
      'VITE_API_MODE=live 인데 아직 실제 Apps Script 클라이언트가 구현되지 않았습니다. ' +
        '6단계(docs/PLAN.md 구현 단계)에서 이 클래스를 채운다. 그 전까지는 .env.local에서 ' +
        'VITE_API_MODE=mock 을 쓸 것.',
    )
  }

  createLesson = (): never => this.fail()
  getLesson = (): never => this.fail()
  getLessonForEdit = (): never => this.fail()
  saveLesson = (): never => this.fail()
  publishLesson = (): never => this.fail()
  deleteLesson = (): never => this.fail()
  uploadMedia = (): never => this.fail()
  uploadStudentMedia = (): never => this.fail()
  saveProgress = (): never => this.fail()
  getProgress = (): never => this.fail()
  gradeAnswer = (): never => this.fail()
  submitResponse = (): never => this.fail()
  getResults = (): never => this.fail()
  getAggregate = (): never => this.fail()
}

const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'

export const api: ApiClient = apiMode === 'live' ? new NotImplementedLiveClient() : mockApi
