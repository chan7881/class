import { useRef, useState } from 'react'
import { api } from '../api/client'
import { useEditorAuth } from '../editor/EditorContext'
import { prepareImageForUpload } from '../lib/image'
import { registerBlock } from './registry'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { ImageBlock as ImageBlockData } from '../types/lesson'

function Editor({ block, onChange }: BlockEditorProps<ImageBlockData>) {
  const { code, editToken } = useEditorAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const blob = await prepareImageForUpload(file)
      const { url } = await api.uploadMedia(code, editToken, blob, file.name)
      onChange({ ...block, src: url, alt: block.alt || file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-dashed border-neutral-300 p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) void handleFile(file)
      }}
    >
      {block.src ? (
        <img
          src={block.src}
          alt={block.alt}
          className={block.width === 'half' ? 'mx-auto max-h-72 max-w-[50%] object-contain' : 'max-h-96 w-full object-contain'}
        />
      ) : (
        <p className="py-6 text-center text-sm text-neutral-500">이미지를 드래그하거나 아래에서 선택하세요</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="tap-target rounded border border-neutral-300 px-3 text-sm disabled:opacity-60"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '업로드 중…' : '파일 선택'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
        <input
          value={block.src.startsWith('blob:') ? '' : block.src}
          onChange={(e) => onChange({ ...block, src: e.target.value })}
          placeholder="또는 이미지 URL 붙여넣기"
          className="tap-target min-w-40 flex-1 rounded border border-neutral-300 px-2 text-sm"
        />
        <select
          value={block.width}
          onChange={(e) => onChange({ ...block, width: e.target.value as 'full' | 'half' })}
          className="tap-target rounded border border-neutral-300 px-1 text-sm"
        >
          <option value="full">전체 폭</option>
          <option value="half">절반 폭</option>
        </select>
      </div>
      <input
        value={block.caption ?? ''}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="캡션 (선택)"
        className="tap-target mt-2 w-full rounded border border-neutral-200 px-2 text-sm text-neutral-500"
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

function Viewer({ block }: BlockViewerProps<ImageBlockData>) {
  if (!block.src) return null
  return (
    <figure className={block.width === 'half' ? 'mx-auto max-w-[50%]' : 'w-full'}>
      <img src={block.src} alt={block.alt} className="w-full rounded-lg" />
      {block.caption && <figcaption className="mt-1 text-center text-sm text-neutral-500">{block.caption}</figcaption>}
    </figure>
  )
}

registerBlock<ImageBlockData>({
  type: 'image',
  label: '이미지',
  category: '미디어',
  createDefault: (id) => ({ id, type: 'image', src: '', alt: '', width: 'full' }),
  Editor,
  Viewer,
})
