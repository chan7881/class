import type { ReactNode } from 'react'

/** 접었다 펼 수 있는 설정 영역 — 네이티브 <details>라 별도 상태 관리 없이 키보드·스크린리더도 기본 동작한다. */
export function Accordion({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="mt-3 rounded border border-neutral-200 [&_summary::-webkit-details-marker]:hidden">
      <summary className="tap-target flex cursor-pointer list-none items-center gap-1 px-2 text-sm font-medium text-neutral-600">
        <span className="text-neutral-400 [details[open]_&]:rotate-90">▶</span>
        {title}
      </summary>
      <div className="border-t border-neutral-100 p-2">{children}</div>
    </details>
  )
}
