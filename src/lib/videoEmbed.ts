import type { VideoBlock } from '../types/lesson'

export type VideoProvider = VideoBlock['provider']

export function detectProvider(url: string): VideoProvider {
  try {
    const { hostname } = new URL(url)
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    if (hostname.includes('vimeo.com')) return 'vimeo'
  } catch {
    // 파싱 실패 시 파일(mp4 등 직접 URL)로 취급
  }
  return 'file'
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null
    if (u.pathname === '/watch') return u.searchParams.get('v')
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] ?? null
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] ?? null
  } catch {
    // ignore
  }
  return null
}

function parseVimeoId(url: string): string | null {
  try {
    const u = new URL(url)
    const match = u.pathname.match(/(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export interface VideoPlaybackOptions {
  start?: number
  end?: number
  loop: boolean
  autoplay: boolean
}

/** youtube/vimeo만 iframe URL을 만든다. 'file'은 <video> 태그를 직접 쓰므로 null. */
export function buildEmbedUrl(url: string, provider: VideoProvider, opts: VideoPlaybackOptions): string | null {
  if (provider === 'youtube') {
    const id = parseYouTubeId(url)
    if (!id) return null
    const params = new URLSearchParams({ rel: '0' })
    if (opts.start) params.set('start', String(Math.floor(opts.start)))
    if (opts.end) params.set('end', String(Math.floor(opts.end)))
    if (opts.autoplay) {
      params.set('autoplay', '1')
      params.set('mute', '1') // 대부분의 브라우저는 음소거 상태가 아니면 자동재생을 막는다
    }
    if (opts.loop) {
      params.set('loop', '1')
      params.set('playlist', id) // 유튜브 임베드는 단일 영상 반복에 playlist=자기id가 필요하다
    }
    return `https://www.youtube.com/embed/${id}?${params.toString()}`
  }

  if (provider === 'vimeo') {
    const id = parseVimeoId(url)
    if (!id) return null
    const params = new URLSearchParams()
    if (opts.autoplay) {
      params.set('autoplay', '1')
      params.set('muted', '1')
    }
    if (opts.loop) params.set('loop', '1')
    const hash = opts.start ? `#t=${Math.floor(opts.start)}s` : ''
    return `https://player.vimeo.com/video/${id}?${params.toString()}${hash}`
  }

  return null
}

/** "1:30" 또는 "90" 형식의 입력을 초 단위 숫자로 바꾼다. 빈 문자열은 undefined(=지정 안 함). */
export function parseTimeInput(input: string): number | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const parts = trimmed.split(':').map(Number)
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return undefined
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export function formatTime(seconds: number | undefined): string {
  if (seconds === undefined) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
