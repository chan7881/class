import { useEffect, useRef, useState } from 'react'
import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { api } from '../../api/client'
import { useEditorAuth } from '../../editor/EditorContext'
import { prepareImageForUpload } from '../../lib/image'
import { usePlayerCode } from '../../player/PlayerMediaContext'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { DrawingQuestion } from '../../types/lesson'

type DrawingTool = DrawingQuestion['tools'][number]

/** 정규화 좌표(0~1)로 저장 — 화면 회전·리사이즈에도 스트로크가 어긋나지 않는다 (docs/PLAN.md 4번 항목). */
interface NormalizedStroke {
  tool: DrawingTool
  color: string
  width: number // 캔버스 폭 대비 비율
  points: { x: number; y: number }[]
}

interface DrawingAnswerValue {
  strokes: NormalizedStroke[]
  pngUrl?: string
}

const COLORS = ['#18181b', '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#7c3aed']
const WIDTHS = [0.004, 0.009, 0.016]
const TOOL_LABELS: Record<DrawingTool, string> = { pen: '펜', line: '직선', eraser: '지우개' }

function Editor({ question, onChange }: QuestionEditorProps<DrawingQuestion>) {
  const { code, editToken } = useEditorAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleBackground(file: File) {
    setUploading(true)
    try {
      const blob = await prepareImageForUpload(file)
      const { url } = await api.uploadMedia(code, editToken, blob, file.name)
      onChange({ ...question, background: url })
    } finally {
      setUploading(false)
    }
  }

  function toggleTool(tool: DrawingTool) {
    const has = question.tools.includes(tool)
    if (has && question.tools.length === 1) return // 도구 하나는 남겨야 함
    onChange({ ...question, tools: has ? question.tools.filter((t) => t !== tool) : [...question.tools, tool] })
  }

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <p className="text-sm font-medium text-neutral-600">학생에게 줄 도구</p>
      <div className="mt-1 flex flex-wrap gap-3">
        {(['pen', 'line', 'eraser'] as DrawingTool[]).map((tool) => (
          <label key={tool} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={question.tools.includes(tool)} onChange={() => toggleTool(tool)} />
            {TOOL_LABELS[tool]}
          </label>
        ))}
      </div>

      <p className="mt-3 text-sm font-medium text-neutral-600">밑그림 (선택 — 모눈종이·도해·지도 등)</p>
      <div className="mt-1 flex items-center gap-2">
        {question.background && <img src={question.background} alt="밑그림" className="h-16 w-16 rounded border border-neutral-200 object-cover" />}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="tap-target rounded border border-neutral-300 px-3 text-sm disabled:opacity-60"
        >
          {uploading ? '업로드 중…' : question.background ? '밑그림 바꾸기' : '밑그림 올리기'}
        </button>
        {question.background && (
          <button type="button" onClick={() => onChange({ ...question, background: undefined })} className="tap-target text-sm text-neutral-400 hover:text-danger">
            제거
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleBackground(file)
            e.target.value = ''
          }}
        />
      </div>
    </QuestionEditorShell>
  )
}

function useCanvasSize(): [React.RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 320, height: 240 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0) setSize({ width: rect.width, height: rect.width * 0.75 })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: NormalizedStroke[], width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = Math.max(1, stroke.width * width)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x * width, p.y * height)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<DrawingQuestion>) {
  const code = usePlayerCode()
  const current = (value as DrawingAnswerValue | undefined) ?? { strokes: [] }
  const [containerRef, size] = useCanvasSize()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef<NormalizedStroke | null>(null)
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tool, setTool] = useState<DrawingTool>(question.tools[0] ?? 'pen')
  const [color, setColor] = useState(COLORS[0])
  const [widthIdx, setWidthIdx] = useState(1)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      canvas.width = size.width
      canvas.height = size.height
      drawStrokes(ctx, current.strokes, size.width, size.height)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, current.strokes])

  function scheduleUpload(strokes: NormalizedStroke[]) {
    if (uploadTimer.current) clearTimeout(uploadTimer.current)
    uploadTimer.current = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const { url } = await api.uploadStudentMedia(code, blob, 'drawing.png')
        onChange({ strokes, pngUrl: url })
      }, 'image/png')
    }, 600)
  }

  function toNormalized(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = { tool, color, width: WIDTHS[widthIdx], points: [toNormalized(e)] }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = drawingRef.current
    if (!stroke) return
    const point = toNormalized(e)
    if (stroke.tool === 'line') {
      stroke.points = [stroke.points[0], point]
    } else {
      stroke.points.push(point)
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawStrokes(ctx, [...current.strokes, stroke], size.width, size.height)
  }

  function handlePointerUp() {
    const stroke = drawingRef.current
    drawingRef.current = null
    if (!stroke || stroke.points.length < 2) return
    const strokes = [...current.strokes, stroke]
    onChange({ strokes })
    scheduleUpload(strokes)
  }

  function undo() {
    const strokes = current.strokes.slice(0, -1)
    onChange({ strokes })
    scheduleUpload(strokes)
  }

  function clearAll() {
    onChange({ strokes: [] })
    scheduleUpload([])
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {question.tools.length > 1 && (
          <div className="flex gap-1">
            {question.tools.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTool(t)}
                className={`tap-target rounded border px-2 text-sm ${tool === t ? 'border-accent-500 bg-accent-500/10 text-accent-600' : 'border-neutral-300'}`}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`색상 ${c}`}
              onClick={() => setColor(c)}
              className={`tap-target h-7 w-7 rounded-full border-2 ${color === c ? 'border-accent-500' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {WIDTHS.map((w, i) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidthIdx(i)}
              aria-label={`굵기 ${i + 1}`}
              className={`tap-target flex h-7 w-7 items-center justify-center rounded border ${widthIdx === i ? 'border-accent-500' : 'border-neutral-300'}`}
            >
              <span className="rounded-full bg-neutral-700" style={{ width: 6 + i * 4, height: 6 + i * 4 }} />
            </button>
          ))}
        </div>
        <button type="button" onClick={undo} disabled={disabled || current.strokes.length === 0} className="tap-target rounded border border-neutral-300 px-2 text-sm disabled:opacity-50">
          되돌리기
        </button>
        <button type="button" onClick={clearAll} disabled={disabled || current.strokes.length === 0} className="tap-target rounded border border-neutral-300 px-2 text-sm disabled:opacity-50">
          전체 지우기
        </button>
      </div>
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border border-neutral-300" style={{ touchAction: 'none' }}>
        {question.background && <img src={question.background} alt="밑그림" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
        <canvas
          ref={canvasRef}
          className="relative block w-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
    </div>
  )
}

registerQuestion<DrawingQuestion>({
  kind: 'drawing',
  label: '그리기',
  icon: '✏️',
  createDefault: (id) => ({ id, kind: 'drawing', prompt: '', required: true, points: 10, tools: ['pen', 'line', 'eraser'] }),
  Editor,
  Viewer,
  // grade 없음 — 그림은 정오답 개념이 없어 교사가 결과 화면에서 수기로 확인한다
  isAnswered: (_question, value) => {
    const v = value as DrawingAnswerValue | undefined
    return !!v && v.strokes.length > 0
  },
})
