import { useState } from 'react'
import { getBlockDefinition } from '../blocks/registry'
import type { Slide } from '../types/lesson'

/**
 * 지금은 현재 슬라이드를 Viewer로만 그대로 보여준다(진행 잠금·다음 버튼 없음).
 * 5단계에서 실제 플레이어 컴포넌트를 읽기 전용 모드로 재사용하도록 교체한다.
 */
export function PreviewFrame({ slide }: { slide: Slide }) {
  const [mobile, setMobile] = useState(true)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMobile(true)}
          className={`tap-target rounded px-3 ${mobile ? 'bg-accent-500 text-white' : 'text-neutral-500'}`}
        >
          📱 모바일
        </button>
        <button
          type="button"
          onClick={() => setMobile(false)}
          className={`tap-target rounded px-3 ${!mobile ? 'bg-accent-500 text-white' : 'text-neutral-500'}`}
        >
          🖥️ 데스크톱
        </button>
      </div>

      <div
        className={`overflow-y-auto rounded-xl border border-neutral-300 bg-white p-4 shadow-inner ${
          mobile ? 'h-[700px] w-[390px] max-w-full' : 'h-[600px] w-full max-w-2xl'
        }`}
      >
        <div className="flex flex-col gap-4">
          {slide.blocks.length === 0 && <p className="text-center text-sm text-neutral-400">빈 슬라이드</p>}
          {slide.blocks.map((block) => {
            const def = getBlockDefinition(block.type)
            return def ? <def.Viewer key={block.id} block={block} /> : null
          })}
        </div>
      </div>
    </div>
  )
}
