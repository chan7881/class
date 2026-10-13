import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'

/*
 * 무거운 라이브러리를 쓰는 컴포넌트는 **처음 화면에 나올 때** 내려받는다 (2026-10-13).
 *
 * 블록 레지스트리(src/blocks/index.ts)는 앱이 뜰 때 전부 실행되고, 블록 파일 하나에 편집용
 * Editor 와 학생용 Viewer 가 같이 들어 있다. 그래서 정적 import 하나가 recharts(차트)·mathlive
 * (수식 입력)를 학생 화면의 첫 로딩에 끌고 들어왔다. 여기 래퍼를 거치면 그 라이브러리는 실제로
 * 그 블록이 화면에 나올 때만 받는다.
 *
 * tiptap(편집기)은 여기로 하지 않는다 — Suspense 와 맞지 않는다(richtext/RichTextEditorSlot.tsx).
 *
 * 불러오는 동안에는 **같은 높이의 빈 상자**를 둔다 — 자리가 갑자기 생기면 화면이 튄다.
 */

const ChartRendererImpl = lazy(() => import('./ChartRenderer').then((m) => ({ default: m.ChartRenderer })))
const MathFieldImpl = lazy(() => import('../math/MathField').then((m) => ({ default: m.MathField })))

function Placeholder({ height }: { height: number }) {
  return <div aria-hidden className="w-full rounded border border-neutral-200 bg-neutral-50" style={{ height }} />
}

export function ChartRenderer(props: ComponentProps<typeof ChartRendererImpl>) {
  return (
    <Suspense fallback={<Placeholder height={props.height ?? 260} />}>
      <ChartRendererImpl {...props} />
    </Suspense>
  )
}

export function MathField(props: ComponentProps<typeof MathFieldImpl>) {
  return (
    <Suspense fallback={<Placeholder height={48} />}>
      <MathFieldImpl {...props} />
    </Suspense>
  )
}
