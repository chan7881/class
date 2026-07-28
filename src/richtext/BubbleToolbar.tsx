import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { FONT_FAMILIES, FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS } from './toolbarOptions'

interface Rect {
  top: number
  left: number
}

function ToolbarButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // 버튼 클릭으로 에디터 선택이 풀리지 않게
      onClick={onClick}
      className={`tap-target flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm font-medium ${
        active ? 'bg-accent-500 text-white' : 'text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

/** 텍스트를 드래그해서 선택하면 뜨는 서식 툴바. 선택 좌표는 TipTap의 좌표 API로 직접 계산한다. */
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    const updatePosition = () => {
      const { from, to, empty } = editor.state.selection
      if (empty || !editor.isFocused) {
        setRect(null)
        return
      }
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      setRect({ top: Math.min(start.top, end.top), left: (start.left + end.left) / 2 })
    }
    const hide = () => setRect(null)

    editor.on('selectionUpdate', updatePosition)
    editor.on('blur', hide)
    return () => {
      editor.off('selectionUpdate', updatePosition)
      editor.off('blur', hide)
    }
  }, [editor])

  if (!rect) return null

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 주소', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div
      className="fixed z-50 flex -translate-x-1/2 -translate-y-full flex-wrap items-center gap-1 rounded-lg border border-neutral-300 bg-white p-1.5 shadow-lg"
      style={{ top: rect.top - 8, left: rect.left }}
    >
      <select
        className="tap-target rounded border border-neutral-200 bg-white px-1 text-sm"
        value={editor.getAttributes('textStyle').fontFamily ?? ''}
        onChange={(e) => {
          const value = e.target.value
          if (value) editor.chain().focus().setFontFamily(value).run()
          else editor.chain().focus().unsetFontFamily().run()
        }}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="tap-target rounded border border-neutral-200 bg-white px-1 text-sm"
        value={editor.getAttributes('textStyle').fontSize ?? ''}
        onChange={(e) => {
          const value = e.target.value
          if (value) editor.chain().focus().setFontSize(value).run()
          else editor.chain().focus().unsetFontSize().run()
        }}
      >
        {FONT_SIZES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <div className="mx-1 h-6 w-px bg-neutral-200" />

      <ToolbarButton title="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton title="기울임" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton title="밑줄" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton title="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>
      <ToolbarButton title="위첨자" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
        x<sup>2</sup>
      </ToolbarButton>
      <ToolbarButton title="아래첨자" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
        x<sub>2</sub>
      </ToolbarButton>
      <ToolbarButton title="링크" active={editor.isActive('link')} onClick={setLink}>
        🔗
      </ToolbarButton>

      <div className="mx-1 h-6 w-px bg-neutral-200" />

      <div className="flex items-center gap-0.5" title="글자 색">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setColor(color).run()}
            className="tap-target h-6 w-6 rounded-full border border-neutral-200"
            style={{ backgroundColor: color }}
            aria-label={`글자 색 ${color}`}
          />
        ))}
      </div>

      <div className="flex items-center gap-0.5" title="형광펜">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
            className="tap-target h-6 w-6 rounded border border-neutral-200"
            style={{ backgroundColor: color }}
            aria-label={`형광펜 ${color}`}
          />
        ))}
        <ToolbarButton title="서식 지우기" onClick={() => editor.chain().focus().unsetAllMarks().run()}>
          ⌫
        </ToolbarButton>
      </div>
    </div>
  )
}
