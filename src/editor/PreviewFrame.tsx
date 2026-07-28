import { useState } from 'react'
import { createPreviewAdapter } from '../player/adapters'
import { Player } from '../player/Player'
import type { Lesson } from '../types/lesson'

/** 실제 학생 플레이어(src/player/Player.tsx)를 미리보기 모드로 그대로 재사용한다 — 채점·잠금·피드백까지 진짜와 동일하게 보인다. */
export function PreviewFrame({ lesson, code, initialSlideId }: { lesson: Lesson; code: string; initialSlideId: string }) {
  const [mobile, setMobile] = useState(true)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMobile(true)}
          className={`tap-target rounded px-3 ${mobile ? 'bg-accent-500 text-white' : 'text-neutral-500'}`}
        >
          모바일
        </button>
        <button
          type="button"
          onClick={() => setMobile(false)}
          className={`tap-target rounded px-3 ${!mobile ? 'bg-accent-500 text-white' : 'text-neutral-500'}`}
        >
          데스크톱
        </button>
      </div>

      <div
        key={mobile ? 'mobile' : 'desktop'} // 프레임을 바꾸면 미리보기를 처음부터 다시 시작한다
        className={`overflow-y-auto rounded-xl border border-neutral-300 bg-white shadow-inner ${mobile ? 'h-[700px] w-[390px] max-w-full' : 'h-[600px] w-full max-w-2xl'}`}
      >
        <Player lesson={lesson} code={code} adapter={createPreviewAdapter(lesson)} mode="preview" initialSlideId={initialSlideId} />
      </div>
    </div>
  )
}
