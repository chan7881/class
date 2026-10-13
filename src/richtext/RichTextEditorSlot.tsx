import type { ComponentType } from 'react'
import type { RichTextEditorProps } from './RichTextEditor'

/*
 * 블록 Editor 들은 이 자리를 거쳐 tiptap 편집기를 쓴다 (2026-10-13).
 *
 * 블록 파일은 Editor 와 학생용 Viewer 를 함께 담고 앱 시작 때 전부 실행된다. 거기서 tiptap 을
 * 정적으로 import 하면 학생 화면 첫 로딩에 편집기 라이브러리(gzip 약 120KB)가 끼어든다.
 * 그래서 tiptap 은 편집기 화면 조각(EditorPage)만 들고 오고, 거기서 이 자리에 꽂아 준다.
 * 블록 Editor 는 편집기 화면 안에서만 그려지므로 그때는 항상 채워져 있다.
 *
 * ⚠️ React.lazy + Suspense 로 하지 않은 이유: 운영 빌드에서 tiptap 의 useEditor 가 Suspense 경계
 *   안에서 파괴된 편집기를 붙잡아 블록을 추가하는 순간 **화면 전체가 하얗게** 됐다(개발 서버에서는
 *   재현되지 않는다). 이 방식은 Suspense 를 거치지 않아 예전과 똑같이 동작한다.
 */
let Impl: ComponentType<RichTextEditorProps> | null = null

export function provideRichTextEditor(component: ComponentType<RichTextEditorProps>) {
  Impl = component
}

export function RichTextEditor(props: RichTextEditorProps) {
  if (!Impl) throw new Error('RichTextEditor는 편집기 화면에서만 쓸 수 있습니다 (EditorPage가 provideRichTextEditor를 부른다)')
  return <Impl {...props} />
}
