import katex from 'katex'
import 'katex/dist/katex.css'

/**
 * 읽기 전용 수식 표시(문항 지문에 인라인으로 들어간 수식, 정답 요약 등). KaTeX은 신뢰할 수 없는
 * LaTeX 입력을 안전하게 렌더링하도록 설계된 라이브러리라 별도 살균 없이 그대로 쓴다
 * (TipTap의 자유 형식 HTML과는 성격이 다르다 — katex가 만드는 마크업만 나온다).
 */
export function MathRender({ latex, display = false }: { latex: string; display?: boolean }) {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: display })
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
