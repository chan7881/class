import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiveApiClient } from './liveClient'

/**
 * 여기서 가장 중요한 건 Content-Type: text/plain이다 — application/json으로 보내면
 * 브라우저가 CORS preflight(OPTIONS)를 먼저 보내고, Apps Script 웹앱은 OPTIONS에
 * 응답하지 않아 그대로 막힌다(docs/PLAN.md). 이 테스트가 지키는 건 바로 그 지점이다.
 */
describe('liveClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('요청을 text/plain으로 보내고, action+payload를 JSON으로 감싼다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { code: 'ABC123', editToken: 'x'.repeat(64) } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = createLiveApiClient('https://script.google.com/macros/s/FAKE/exec')
    const result = await client.createLesson({ title: '새 수업', identityFields: ['name'] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://script.google.com/macros/s/FAKE/exec')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('text/plain;charset=utf-8')

    const sentBody = JSON.parse(init.body)
    expect(sentBody.action).toBe('createLesson')
    expect(sentBody.payload).toEqual({ title: '새 수업', identityFields: ['name'] })
    expect(result).toEqual({ code: 'ABC123', editToken: 'x'.repeat(64) })
  })

  it('서버가 ok:false를 주면 error 메시지로 던진다 (정답 유출 없음)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: '편집 권한이 없습니다' }) }),
    )
    const client = createLiveApiClient('https://example.com/exec')
    await expect(client.getLessonForEdit('ABC123', 'wrong-token')).rejects.toThrow('편집 권한이 없습니다')
  })

  it('HTTP 상태 자체가 실패면 상태코드를 담아 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const client = createLiveApiClient('https://example.com/exec')
    await expect(client.getLesson('ABC123')).rejects.toThrow('500')
  })
})
