import { describe, expect, it } from 'vitest'
import { buildEmbedUrl, detectProvider, formatTime, parseTimeInput } from './videoEmbed'

describe('detectProvider', () => {
  it('유튜브 도메인을 인식한다', () => {
    expect(detectProvider('https://www.youtube.com/watch?v=abc123')).toBe('youtube')
    expect(detectProvider('https://youtu.be/abc123')).toBe('youtube')
  })
  it('비메오 도메인을 인식한다', () => {
    expect(detectProvider('https://vimeo.com/123456789')).toBe('vimeo')
  })
  it('그 외는 file로 취급한다', () => {
    expect(detectProvider('https://example.com/video.mp4')).toBe('file')
    expect(detectProvider('not a url')).toBe('file')
  })
})

describe('parseTimeInput / formatTime', () => {
  it('mm:ss를 초로 바꾼다', () => {
    expect(parseTimeInput('1:30')).toBe(90)
    expect(parseTimeInput('0:05')).toBe(5)
  })
  it('순수 초 입력도 받는다', () => {
    expect(parseTimeInput('90')).toBe(90)
  })
  it('빈 문자열은 undefined', () => {
    expect(parseTimeInput('')).toBeUndefined()
    expect(parseTimeInput('   ')).toBeUndefined()
  })
  it('formatTime은 그 반대다', () => {
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(undefined)).toBe('')
  })
})

describe('buildEmbedUrl', () => {
  it('유튜브 watch URL에서 구간·반복 파라미터를 만든다', () => {
    const url = buildEmbedUrl('https://www.youtube.com/watch?v=abc123', 'youtube', { start: 90, end: 120, loop: true, autoplay: false })
    expect(url).toContain('https://www.youtube.com/embed/abc123?')
    expect(url).toContain('start=90')
    expect(url).toContain('end=120')
    expect(url).toContain('loop=1')
    expect(url).toContain('playlist=abc123')
  })

  it('유튜브 shorts/embed 링크도 id를 뽑아낸다', () => {
    expect(buildEmbedUrl('https://youtu.be/xyz789', 'youtube', { loop: false, autoplay: false })).toContain('/embed/xyz789')
  })

  it('비메오는 시작시간을 #t= 프래그먼트로 만든다', () => {
    const url = buildEmbedUrl('https://vimeo.com/123456789', 'vimeo', { start: 30, loop: false, autoplay: false })
    expect(url).toContain('https://player.vimeo.com/video/123456789?')
    expect(url).toContain('#t=30s')
  })

  it('file 제공자는 iframe URL을 만들지 않는다', () => {
    expect(buildEmbedUrl('https://example.com/video.mp4', 'file', { loop: false, autoplay: false })).toBeNull()
  })

  it('id를 못 찾으면 null', () => {
    expect(buildEmbedUrl('https://www.youtube.com/', 'youtube', { loop: false, autoplay: false })).toBeNull()
  })
})
