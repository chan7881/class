import { useRef, useState } from 'react'
import { Accordion } from '../components/Accordion'
import { EMBED_SITE_HINTS, isEmbedUrlAllowed } from '../lib/embedHosts'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { EmbedBlock as EmbedBlockData } from '../types/lesson'

// 업로드 HTML을 수업 JSON 안에 그대로 저장하므로(위 lesson.ts 주석 참고), 이보다 큰(멀티파일·
// 대용량 에셋) 시뮬레이션은 CodePen·Glitch에 올리고 링크 모드로 붙여넣는 쪽을 권장한다.
const MAX_HTML_FILE_BYTES = 3_000_000

function EmbedFrame({ block }: { block: EmbedBlockData }) {
  const isFile = block.source === 'file'
  // 모드 전환이나 재업로드로 src↔srcDoc이 바뀌거나 srcDoc 내용 자체가 바뀔 때, 같은 DOM
  // 엘리먼트를 재사용하면 브라우저가 iframe을 다시 로드하지 않는 경우가 있었다(2026-07-30,
  // 실배포 테스트로 발견) — key를 내용에 묶어 매번 새 엘리먼트로 강제 교체한다.
  const frameKey = isFile ? `file:${block.html}` : `url:${block.url}`
  return (
    <iframe
      key={frameKey}
      {...(isFile ? { srcDoc: block.html } : { src: block.url })}
      className="mt-2 aspect-video w-full rounded-lg border border-neutral-200"
      // 링크 모드: 지금까지 GeoGebra·PhET·Desmos 등에서 실제로 필요했던 권한을 그대로 유지.
      // 업로드 모드: 출처를 못 믿는 임의 코드이므로 스크립트 실행만 허용하고, 최상위 페이지
      // 이동(top-navigation)·팝업으로 벗어나는 것은 막는다.
      sandbox={isFile ? 'allow-scripts' : 'allow-scripts allow-same-origin allow-forms allow-popups'}
      loading="lazy"
      title="임베드 콘텐츠"
    />
  )
}

function SiteHints() {
  return (
    <Accordion title="추천 사이트 보기">
      <ul className="flex flex-col gap-1 text-sm text-neutral-600">
        {EMBED_SITE_HINTS.map((s) => (
          <li key={s.name}>
            <span className="font-medium text-neutral-700">{s.name}</span> — {s.note}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-400">
        일부 사이트는 브라우저 주소창의 일반 페이지 링크가 아니라, 그 사이트가 따로 제공하는 "임베드/embed" 전용 링크를 써야 정상 작동해요.
      </p>
    </Accordion>
  )
}

function UrlModeEditor({ block, onChange }: BlockEditorProps<EmbedBlockData>) {
  const valid = block.url === '' || isEmbedUrlAllowed(block.url)
  return (
    <div>
      <input
        value={block.url}
        onChange={(e) => onChange({ ...block, source: 'url', url: e.target.value, html: undefined, filename: undefined })}
        placeholder="시뮬레이션 링크를 붙여넣으세요"
        className="tap-target w-full rounded border border-neutral-300 px-3 text-sm"
      />
      {!valid && <p className="mt-1 text-sm text-danger">지원하지 않는 사이트입니다. 아래 "추천 사이트 보기"를 확인하세요.</p>}
      {valid && block.url && <EmbedFrame block={block} />}
      <SiteHints />
    </div>
  )
}

function FileModeEditor({ block, onChange }: BlockEditorProps<EmbedBlockData>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!/\.html?$/i.test(file.name)) {
      setError('.html 파일만 올릴 수 있어요')
      return
    }
    if (file.size > MAX_HTML_FILE_BYTES) {
      setError(`파일이 너무 커요(${Math.round(file.size / 1_000_000)}MB). 스크립트·이미지를 파일 안에 전부 inline한 단일 HTML만 지원해요 — 더 크면 CodePen·Glitch에 올리고 링크 모드를 쓰세요.`)
      return
    }
    try {
      const html = await file.text()
      onChange({ ...block, source: 'file', html, filename: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 읽지 못했습니다')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="tap-target rounded border border-neutral-300 px-3 text-sm"
          onClick={() => inputRef.current?.click()}
        >
          {block.filename ? '다른 파일로 바꾸기' : 'HTML 파일 선택'}
        </button>
        {block.filename && <span className="text-sm text-neutral-500">{block.filename}</span>}
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        스크립트·스타일·이미지가 전부 그 파일 하나 안에 들어있는(inline) 단일 HTML만 지원해요. 여러 파일로 구성된 시뮬레이션은 CodePen·Glitch에 올리고 링크 모드를 쓰세요.
      </p>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      {block.html && block.source === 'file' && <EmbedFrame block={block} />}
    </div>
  )
}

function Editor(props: BlockEditorProps<EmbedBlockData>) {
  const { block, onChange } = props
  const source = block.source ?? 'url'
  return (
    <div>
      <div className="mb-2 flex gap-1 text-sm">
        <button
          type="button"
          onClick={() => onChange({ ...block, source: 'url' })}
          className={`tap-target rounded px-3 ${source === 'url' ? 'bg-accent-50 text-accent-500' : 'text-neutral-500 hover:bg-neutral-100'}`}
        >
          링크
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...block, source: 'file' })}
          className={`tap-target rounded px-3 ${source === 'file' ? 'bg-accent-50 text-accent-500' : 'text-neutral-500 hover:bg-neutral-100'}`}
        >
          파일 업로드
        </button>
      </div>
      {source === 'url' ? <UrlModeEditor {...props} /> : <FileModeEditor {...props} />}
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<EmbedBlockData>) {
  const source = block.source ?? 'url'
  if (source === 'url') {
    if (!block.url || !isEmbedUrlAllowed(block.url)) return null
  } else if (!block.html) {
    return null
  }
  return <EmbedFrame block={block} />
}

registerBlock<EmbedBlockData>({
  type: 'embed',
  label: 'URL 임베드',
  category: '미디어',
  createDefault: (id) => ({ id, type: 'embed', source: 'url', url: '' }),
  Editor,
  Viewer,
})
