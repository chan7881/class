import { describe, expect, it } from 'vitest'
import { isEmbedUrlAllowed } from './embedHosts'

describe('isEmbedUrlAllowed', () => {
  it('허용 목록 도메인은 통과시킨다', () => {
    expect(isEmbedUrlAllowed('https://phet.colorado.edu/sims/html/foo/latest/foo_en.html')).toBe(true)
    expect(isEmbedUrlAllowed('https://www.geogebra.org/material/iframe/id/abc123')).toBe(true)
    expect(isEmbedUrlAllowed('https://scratch.mit.edu/projects/123456/embed')).toBe(true)
  })

  it('서브도메인도 허용한다 (예: glitch.me 프로젝트별 서브도메인)', () => {
    expect(isEmbedUrlAllowed('https://my-sim.glitch.me/')).toBe(true)
  })

  it('목록에 없는 도메인은 거부한다', () => {
    expect(isEmbedUrlAllowed('https://evil.example.com/phishing')).toBe(false)
  })

  it('http(비-https)는 허용 도메인이라도 거부한다', () => {
    expect(isEmbedUrlAllowed('http://phet.colorado.edu/sims/html/foo/latest/foo_en.html')).toBe(false)
  })

  it('URL 형식이 아니면 거부한다', () => {
    expect(isEmbedUrlAllowed('not a url')).toBe(false)
    expect(isEmbedUrlAllowed('')).toBe(false)
  })

  it('비슷하지만 다른 도메인(접두어 트릭)은 거부한다', () => {
    expect(isEmbedUrlAllowed('https://phet.colorado.edu.evil.com/')).toBe(false)
    expect(isEmbedUrlAllowed('https://notphet.colorado.edu/')).toBe(false)
  })
})
