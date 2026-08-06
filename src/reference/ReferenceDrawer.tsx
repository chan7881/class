import { useState } from 'react'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { Constants } from './Constants'
import { PeriodicTable } from './PeriodicTable'
import { UnitConverter } from './UnitConverter'
import type { ReferencePanelSettings } from '../types/lesson'

const TAB_LABELS: Record<ReferencePanelSettings['tabs'][number], string> = {
  periodic: '주기율표',
  constants: '상수표',
  units: '단위환산',
  custom: '자료',
}

/**
 * 화면 우하단 플로팅 버튼 → 바텀시트. 슬라이드를 벗어나지 않고 언제든 열 수 있다
 * (docs/PLAN.md 7번 항목). 교사가 수업 설정에서 켠 탭만 보여준다.
 */
export function ReferenceDrawer({ settings }: { settings: ReferencePanelSettings }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ReferencePanelSettings['tabs'][number] | null>(settings.tabs[0] ?? null)

  if (!settings.enabled || settings.tabs.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 배경이 뒤집히는 토큰이므로 글자도 뒤집히는 text-neutral-0을 쓴다
        className="tap-target fixed bottom-20 right-4 z-20 rounded-full bg-neutral-800 px-4 text-sm font-medium text-neutral-0 shadow-lg"
      >
        참고자료
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="max-h-[75vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-neutral-0 p-4 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1 overflow-x-auto">
                {settings.tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`tap-target shrink-0 rounded px-3 text-sm ${tab === t ? 'bg-accent-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="tap-target shrink-0 px-2 text-neutral-400" aria-label="닫기">
                ✕
              </button>
            </div>

            {tab === 'periodic' && <PeriodicTable />}
            {tab === 'constants' && <Constants />}
            {tab === 'units' && <UnitConverter />}
            {tab === 'custom' && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.customHtml ?? '') }} />}
          </div>
        </div>
      )}
    </>
  )
}
