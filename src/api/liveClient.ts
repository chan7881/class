import type {
  AggregateResult,
  ApiClient,
  CreateLessonInput,
  CreateLessonResult,
  ResponseRecord,
  UploadResult,
} from './types'
import type { GradeResult } from '../lib/grade'
import type { Lesson } from '../types/lesson'

/**
 * apps-script/Code.gs에 대응하는 실제 백엔드 클라이언트.
 * Content-Type: text/plain으로 보내는 이유 — application/json으로 보내면 브라우저가
 * CORS preflight(OPTIONS)를 먼저 보내는데, Apps Script 웹앱은 OPTIONS 요청에
 * 응답하지 않아 그대로 막힌다. text/plain은 "simple request"라 preflight가 없다.
 * (docs/PLAN.md 아키텍처 절에 이미 적혀 있는 필수 사항 — 잊지 말 것)
 */

interface ActionEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
}

async function callAction<T>(baseUrl: string, action: string, payload: unknown): Promise<T> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
  })
  if (!res.ok) throw new Error(`서버 응답 오류 (HTTP ${res.status})`)
  const envelope = (await res.json()) as ActionEnvelope<T>
  if (!envelope.ok) throw new Error(envelope.error || '알 수 없는 오류가 발생했습니다')
  return envelope.data as T
}

/** Apps Script doPost는 텍스트만 받으므로, 업로드 파일은 base64 문자열로 바꿔 보낸다. */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function createLiveApiClient(baseUrl: string): ApiClient {
  return {
    createLesson: (input: CreateLessonInput) => callAction<CreateLessonResult>(baseUrl, 'createLesson', input),

    getLesson: (code) => callAction<Lesson>(baseUrl, 'getLesson', { code }),

    getLessonForEdit: (code, editToken) => callAction<Lesson>(baseUrl, 'getLessonForEdit', { code, editToken }),

    saveLesson: (code, editToken, lesson) => callAction<void>(baseUrl, 'saveLesson', { code, editToken, lesson }),

    publishLesson: (code, editToken) => callAction<void>(baseUrl, 'publishLesson', { code, editToken }),

    deleteLesson: (code, editToken) => callAction<void>(baseUrl, 'deleteLesson', { code, editToken }),

    uploadMedia: async (code, editToken, file, filename) => {
      const dataBase64 = await blobToBase64(file)
      return callAction<UploadResult>(baseUrl, 'uploadMedia', { code, editToken, dataBase64, filename, mimeType: file.type })
    },

    uploadStudentMedia: async (code, file, filename) => {
      const dataBase64 = await blobToBase64(file)
      return callAction<UploadResult>(baseUrl, 'uploadStudentMedia', { code, dataBase64, filename, mimeType: file.type })
    },

    saveProgress: (code, record, editToken) => callAction<void>(baseUrl, 'saveProgress', { code, record, editToken }),

    getProgress: (code, studentKey) => callAction<ResponseRecord | null>(baseUrl, 'getProgress', { code, studentKey }),

    gradeAnswer: (code, questionId, value) => callAction<GradeResult | null>(baseUrl, 'gradeAnswer', { code, questionId, value }),

    submitResponse: (code, record, editToken) => callAction<{ scores: ResponseRecord['scores'] }>(baseUrl, 'submitResponse', { code, record, editToken }),

    getResults: (code, editToken) => callAction<ResponseRecord[]>(baseUrl, 'getResults', { code, editToken }),

    getAggregate: (code, questionId) => callAction<AggregateResult>(baseUrl, 'getAggregate', { code, questionId }),
  }
}
