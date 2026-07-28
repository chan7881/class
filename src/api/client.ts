import { createLiveApiClient } from './liveClient'
import { mockApi } from './mock'
import type { ApiClient } from './types'

/**
 * 앱 전체가 이 파일 하나만 import 한다 — mock/live 전환이 여기 한 곳에서만 일어나야
 * 에디터·플레이어·결과 대시보드 코드가 6단계(실제 Apps Script 연동) 이후에도 안 바뀐다.
 */

const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'
const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL

function createApi(): ApiClient {
  if (apiMode !== 'live') return mockApi
  if (!appsScriptUrl) {
    throw new Error(
      'VITE_API_MODE=live인데 VITE_APPS_SCRIPT_URL이 비어 있습니다. ' +
        '.env.local에 apps-script/SETUP.md로 배포한 웹앱 URL을 넣으세요.',
    )
  }
  return createLiveApiClient(appsScriptUrl)
}

export const api: ApiClient = createApi()
