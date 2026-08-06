import { listQuestionsInLesson } from '../lib/findQuestion'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

interface MediaItem {
  url: string
  questionPrompt: string
  studentLabel: string
}

function studentLabel(r: ResponseRecord): string {
  const parts = Object.values(r.identity).filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : r.studentKey.slice(0, 6)
}

export function MediaGallery({ lesson, records }: { lesson: Lesson; records: ResponseRecord[] }) {
  const mediaQuestions = listQuestionsInLesson(lesson).filter((q) => q.kind === 'drawing' || q.kind === 'photo')
  const items: MediaItem[] = []

  for (const r of records) {
    for (const q of mediaQuestions) {
      const value = r.answers[q.id]
      if (q.kind === 'photo' && Array.isArray(value)) {
        for (const url of value as string[]) items.push({ url, questionPrompt: q.prompt, studentLabel: studentLabel(r) })
      } else if (q.kind === 'drawing' && value && typeof value === 'object' && 'pngUrl' in (value as object)) {
        const url = (value as { pngUrl?: string }).pngUrl
        if (url) items.push({ url, questionPrompt: q.prompt, studentLabel: studentLabel(r) })
      }
    }
  }

  if (items.length === 0) return <p className="text-sm text-neutral-400">사진·그림 답안이 없어요</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((item, i) => (
        <a key={`${item.url}-${i}`} href={item.url} target="_blank" rel="noreferrer" className="block">
          {/* 그리기 답안은 배경이 투명한 PNG라 다크모드에서는 검은 선이 안 보인다 —
              학생이 그릴 때 본 것과 같도록 항상 흰 바탕 위에 얹는다(Drawing.tsx의 판과 같은 이유). */}
          <img src={item.url} alt={item.studentLabel} className="aspect-square w-full rounded-lg border border-neutral-200 bg-white object-cover" />
          <p className="mt-1 truncate text-xs text-neutral-500">{item.studentLabel}</p>
          <p className="truncate text-xs text-neutral-400" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.questionPrompt) }} />
        </a>
      ))}
    </div>
  )
}
