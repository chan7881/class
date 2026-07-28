import { useRef, useState } from 'react'
import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { api } from '../../api/client'
import { prepareImageForUpload } from '../../lib/image'
import { usePlayerCode } from '../../player/PlayerMediaContext'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { PhotoQuestion } from '../../types/lesson'

function Editor({ question, onChange }: QuestionEditorProps<PhotoQuestion>) {
  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <label className="flex items-center gap-2 text-sm text-neutral-600">
        최대 첨부 장수
        <input
          type="number"
          min={1}
          max={5}
          value={question.maxFiles}
          onChange={(e) => onChange({ ...question, maxFiles: Math.max(1, Number(e.target.value) || 1) })}
          className="tap-target w-20 rounded border border-neutral-300 px-2"
        />
      </label>
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<PhotoQuestion>) {
  const code = usePlayerCode()
  const urls = Array.isArray(value) ? (value as string[]) : []
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList) {
    setError(null)
    const remaining = question.maxFiles - urls.length
    const toUpload = Array.from(files).slice(0, remaining)
    if (toUpload.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of toUpload) {
        const blob = await prepareImageForUpload(file)
        const { url } = await api.uploadStudentMedia(code, blob, file.name)
        uploaded.push(url)
      }
      onChange([...urls, ...uploaded])
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {urls.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt={`첨부 ${i + 1}`} className="h-24 w-24 rounded-lg border border-neutral-200 object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="tap-target absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-xs text-white"
                  aria-label="사진 삭제"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {urls.length < question.maxFiles && (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="tap-target rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 disabled:opacity-60"
        >
          {uploading ? '업로드 중…' : '📷 사진 추가'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

registerQuestion<PhotoQuestion>({
  kind: 'photo',
  label: '사진 업로드',
  icon: '📷',
  createDefault: (id) => ({ id, kind: 'photo', prompt: '', required: true, points: 10, maxFiles: 1 }),
  Editor,
  Viewer,
  // grade 없음 — 사진은 정오답 개념이 없어 교사가 결과 화면에서 수기로 확인한다
  isAnswered: (_question, value) => Array.isArray(value) && value.length > 0,
})
