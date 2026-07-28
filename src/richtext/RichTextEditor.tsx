import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyleKit } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Placeholder from '@tiptap/extension-placeholder'
import { BubbleToolbar } from './BubbleToolbar'

interface RichTextEditorProps {
  html: string
  onChange: (html: string) => void
  placeholder?: string
  /** 문항 프롬프트처럼 한 줄 입력 성격이 강한 곳에서 Enter로 줄바꿈되지 않게 하고 싶을 때 */
  singleLine?: boolean
  className?: string
}

/**
 * Notion 스타일 리치텍스트 입력의 공통 구현체. TextBlock·CalloutBlock·문항 prompt가 전부 이걸 쓴다.
 * 새 서식 버튼이 필요해지면 여기 extensions와 BubbleToolbar 한 곳만 고치면 된다.
 */
export function RichTextEditor({ html, onChange, placeholder, singleLine, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TextStyleKit.configure({ lineHeight: false }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: placeholder ?? '입력하세요' }),
    ],
    content: html,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'max-w-none text-base leading-[1.7] focus:outline-none' },
      handleKeyDown: singleLine
        ? (_view, event) => event.key === 'Enter' && !event.shiftKey
        : undefined,
    },
  })

  // 되돌리기/외부 저장 복원 등으로 html prop이 바뀌면 에디터 내용도 맞춰준다 (무한루프 방지: 값이 다를 때만)
  useEffect(() => {
    if (editor && html !== editor.getHTML()) {
      editor.commands.setContent(html, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, editor])

  if (!editor) return null

  return (
    <div className={className}>
      <BubbleToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
