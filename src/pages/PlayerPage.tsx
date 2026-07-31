import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { createLiveAdapter } from '../player/adapters'
import { Player } from '../player/Player'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import type { Lesson } from '../types/lesson'

export default function PlayerPage() {
  const { code = '' } = useParams()
  const [searchParams] = useSearchParams()
  const testToken = searchParams.get('test') || undefined

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setLesson(null)
    const request = testToken ? api.getLessonForEdit(code, testToken) : api.getLesson(code)
    request
      .then((l) => {
        if (!cancelled) setLesson(l)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '수업을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [code, testToken])

  if (error) {
    return (
      <PageShell>
        <PageTitle tone="danger">참여할 수 없습니다</PageTitle>
        <p className="mt-2 text-sm text-neutral-500">{error}</p>
        <p className="mt-1 text-sm text-neutral-400">
          {testToken ? '테스트 모드 링크의 편집 키가 올바른지 확인하세요.' : '수업 코드를 다시 확인하거나, 교사에게 발행 여부를 문의하세요.'}
        </p>
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

  return (
    <Player
      lesson={lesson}
      code={code}
      adapter={createLiveAdapter(code, testToken)}
      mode="live"
      isTest={!!testToken}
    />
  )
}
