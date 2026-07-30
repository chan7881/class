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
  /** 실제 입력 영역(ProseMirror)에 줄 기본값(text-base 등) 대신 적용할 클래스 —
   *  제목 블록처럼 글자 크기 자체가 달라야 하는 곳에서 쓴다. 생략하면 본문 기본 스타일. */
  contentClassName?: string
}

/**
 * Notion 스타일 리치텍스트 입력의 공통 구현체. TextBlock·CalloutBlock·문항 prompt가 전부 이걸 쓴다.
 * 새 서식 버튼이 필요해지면 여기 extensions와 BubbleToolbar 한 곳만 고치면 된다.
 */
export function RichTextEditor({ html, onChange, placeholder, singleLine, className, contentClassName }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      // link·underline: tiptap v3의 StarterKit이 기본으로 포함하게 되면서(v2 시절엔 없었음)
      // 아래 별도 Underline/Link와 중복 등록돼 콘솔 경고가 났다 — StarterKit 쪽은 꺼두고
      // 커스텀 설정(Link의 openOnClick 등)이 있는 아래 것만 쓴다.
      StarterKit.configure({ heading: false, underline: false, link: false }),
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
      attributes: { class: contentClassName ?? 'max-w-none text-base leading-[1.7] focus:outline-none' },
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
