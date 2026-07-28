import { useEffect, useRef } from 'react'
import { buildEmbedUrl, detectProvider, formatTime, parseTimeInput } from '../lib/videoEmbed'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { VideoBlock as VideoBlockData } from '../types/lesson'

function VideoPlayer({ block }: { block: VideoBlockData }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || block.provider !== 'file') return
    const onLoaded = () => {
      if (block.start) el.currentTime = block.start
    }
    // 유튜브/비메오는 start/end를 임베드 파라미터로 처리하지만, 직접 mp4는 여기서 수동으로 구간을 지킨다
    const onTimeUpdate = () => {
      if (block.end && el.currentTime >= block.end) el.pause()
    }
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('timeupdate', onTimeUpdate)
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [block.start, block.end, block.provider])

  if (!block.url) return <p className="py-6 text-center text-sm text-neutral-500">영상 URL을 입력하세요</p>

  if (block.provider === 'file') {
    return (
      <video
        ref={videoRef}
        src={block.url}
        controls
        loop={block.loop}
        autoPlay={block.autoplay}
        muted={block.autoplay}
        className="aspect-video w-full rounded-lg bg-black"
      />
    )
  }

  const embedUrl = buildEmbedUrl(block.url, block.provider, block)
  if (!embedUrl) return <p className="py-6 text-center text-sm text-danger">영상 주소를 인식하지 못했습니다</p>

  return (
    <iframe
      src={embedUrl}
      className="aspect-video w-full rounded-lg"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
      title="영상"
    />
  )
}

function Editor({ block, onChange }: BlockEditorProps<VideoBlockData>) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <input
        value={block.url}
        onChange={(e) => {
          const url = e.target.value
          onChange({ ...block, url, provider: detectProvider(url) })
        }}
        placeholder="YouTube · Vimeo · mp4 URL을 붙여넣으세요"
        className="tap-target w-full rounded border border-neutral-300 px-3 text-sm"
      />

      <div className="mt-2">
        <VideoPlayer block={block} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          시작
          <input
            key={`start-${block.id}`}
            defaultValue={formatTime(block.start)}
            onBlur={(e) => onChange({ ...block, start: parseTimeInput(e.target.value) })}
            placeholder="0:00"
            className="tap-target w-16 rounded border border-neutral-300 px-1 text-center"
          />
        </label>
        <label className="flex items-center gap-1">
          종료
          <input
            key={`end-${block.id}`}
            defaultValue={formatTime(block.end)}
            onBlur={(e) => onChange({ ...block, end: parseTimeInput(e.target.value) })}
            placeholder="끝까지"
            className="tap-target w-20 rounded border border-neutral-300 px-1 text-center"
          />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={block.loop} onChange={(e) => onChange({ ...block, loop: e.target.checked })} />
          반복
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={block.autoplay} onChange={(e) => onChange({ ...block, autoplay: e.target.checked })} />
          자동재생
        </label>
      </div>
      <input
        value={block.caption ?? ''}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="캡션 (선택)"
        className="tap-target mt-2 w-full rounded border border-neutral-200 px-2 text-sm text-neutral-500"
      />
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<VideoBlockData>) {
  return (
    <figure>
      <VideoPlayer block={block} />
      {block.caption && <figcaption className="mt-1 text-center text-sm text-neutral-500">{block.caption}</figcaption>}
    </figure>
  )
}

registerBlock<VideoBlockData>({
  type: 'video',
  label: '영상',
  category: '미디어',
  createDefault: (id) => ({ id, type: 'video', provider: 'file', url: '', loop: false, autoplay: false }),
  Editor,
  Viewer,
})
