import { registerBlock } from './registry'
import { useEditorStore } from '../store/editorStore'
import type { BlockEditorProps, BlockViewerProps } from './types'
import type { PoeGroupBlock as PoeGroupBlockData } from '../types/lesson'

interface QuestionOption {
  id: string
  label: string
}

function useAllQuestionOptions(): QuestionOption[] {
  const lesson = useEditorStore((s) => s.lesson)
  if (!lesson) return []
  const options: QuestionOption[] = []
  lesson.slides.forEach((slide, si) => {
    let qi = 0
    slide.blocks.forEach((b) => {
      if (b.type !== 'question') return
      qi += 1
      options.push({ id: b.q.id, label: `${si + 1}번 슬라이드 · 문항 ${qi}` })
    })
  })
  return options
}

/**
 * 예측-관찰-설명(POE) 묶음 — 실제 화면 렌더링은 하지 않는다(값 null). 이 블록은 어떤
 * 문항이 예측/설명인지 메타데이터로만 기록해, 예측 문항의 `lockAfterSubmit` 잠금과
 * 결과 화면의 "내 예측 vs 내 설명" 비교(SummaryView)가 이 정보를 참조한다.
 * 예측·관찰·설명에 해당하는 실제 텍스트/문항 블록은 이 블록과 별개로 슬라이드에 평소처럼 추가한다.
 */
function Editor({ block, onChange }: BlockEditorProps<PoeGroupBlockData>) {
  const options = useAllQuestionOptions()

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-3 text-sm">
      <p className="font-medium text-neutral-600">🔬 예측-관찰-설명(POE) 묶음</p>
      <p className="mt-1 text-xs text-neutral-400">
        먼저 예측 문항과 설명 문항을 수업 어딘가에 평소처럼 추가한 뒤 여기서 골라 묶어주세요. 예측 문항의 "제출 후 잠금(수정 불가)"은
        문항 편집기 안의 필수/배점 옆에서 켤 수 있어요.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          예측 문항
          <select value={block.predictId} onChange={(e) => onChange({ ...block, predictId: e.target.value })} className="tap-target rounded border border-neutral-300 px-2">
            <option value="">선택 안 함</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          설명 문항
          <select value={block.explainId} onChange={(e) => onChange({ ...block, explainId: e.target.value })} className="tap-target rounded border border-neutral-300 px-2">
            <option value="">선택 안 함</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

function Viewer(_props: BlockViewerProps<PoeGroupBlockData>) {
  return null
}

registerBlock<PoeGroupBlockData>({
  type: 'poeGroup',
  label: 'POE 묶음',
  icon: '🔬',
  category: '콘텐츠',
  createDefault: (id) => ({ id, type: 'poeGroup', predictId: '', observeIds: [], explainId: '' }),
  Editor,
  Viewer,
})
