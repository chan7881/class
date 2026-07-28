import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { createLiveAdapter } from '../player/adapters'
import { Player } from '../player/Player'
import { PageShell } from '../components/PageShell'
import type { Lesson } from '../types/lesson'

export default function PlayerPage() {
  const { code = '' } = useParams()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setLesson(null)
    api
      .getLesson(code)
      .then((l) => {
        if (!cancelled) setLesson(l)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '수업을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <PageShell>
        <h1 className="text-xl font-semibold text-danger">참여할 수 없습니다</h1>
        <p className="mt-2 text-sm text-neutral-500">{error}</p>
        <p className="mt-1 text-sm text-neutral-400">수업 코드를 다시 확인하거나, 교사에게 발행 여부를 문의하세요.</p>
      </PageShell>
    )
  }

  if (!lesson) {
    return (
      <PageShell>
        <p className="text-neutral-500">불러오는 중…</p>
      </PageShell>
    )
  }

  return <Player lesson={lesson} code={code} adapter={createLiveAdapter(code)} mode="live" />
}
