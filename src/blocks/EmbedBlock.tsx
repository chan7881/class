import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { EmbedBlock as EmbedBlockData } from '../types/lesson'

/** 화이트리스트 — 여기 없는 도메인은 iframe으로 띄우지 않는다 (임의 사이트 임베드 방지) */
const ALLOWED_HOSTS = ['geogebra.org', 'www.geogebra.org', 'phet.colorado.edu', 'www.desmos.com']

function isAllowed(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url)
    return protocol === 'https:' && ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

function Editor({ block, onChange }: BlockEditorProps<EmbedBlockData>) {
  const valid = block.url === '' || isAllowed(block.url)
  return (
    <div>
      <input
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
        placeholder="GeoGebra·PhET·Desmos 링크를 붙여넣으세요"
        className="tap-target w-full rounded border border-neutral-300 px-3 text-sm"
      />
      {!valid && <p className="mt-1 text-sm text-danger">지원하지 않는 사이트입니다 (GeoGebra·PhET·Desmos만 임베드할 수 있어요).</p>}
      {valid && block.url && <EmbedFrame url={block.url} />}
    </div>
  )
}

function EmbedFrame({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="mt-2 aspect-video w-full rounded-lg border border-neutral-200"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      loading="lazy"
      title="임베드 콘텐츠"
    />
  )
}

function Viewer({ block }: BlockViewerProps<EmbedBlockData>) {
  if (!isAllowed(block.url)) return null
  return <EmbedFrame url={block.url} />
}

registerBlock<EmbedBlockData>({
  type: 'embed',
  label: '시뮬레이션 임베드',
  icon: '🧪',
  category: '미디어',
  createDefault: (id) => ({ id, type: 'embed', url: '' }),
  Editor,
  Viewer,
})
