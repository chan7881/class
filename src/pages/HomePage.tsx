import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { Button } from '../components/Button'

export default function HomePage() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  return (
    <PageShell>
      <h1 className="text-2xl font-bold">인터랙티브 수업</h1>
      <p className="mt-2 text-neutral-500">수업 코드를 입력해 참여하거나, 새 수업을 만들어 보세요.</p>

      <div className="mt-8 flex flex-col gap-3">
        <label className="text-sm font-medium text-neutral-700" htmlFor="lesson-code">
          수업 코드
        </label>
        <input
          id="lesson-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예: 7F3K9Q"
          maxLength={6}
          className="tap-target rounded-lg border border-neutral-300 bg-white px-4 text-lg tracking-widest outline-none focus:border-accent-500"
        />
        <Button disabled={code.length < 4} onClick={() => navigate(`/play/${code}`)}>
          수업 참여하기
        </Button>
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-6">
        <p className="text-sm text-neutral-500">교사이신가요?</p>
        <Button variant="secondary" className="mt-3" onClick={() => navigate('/editor/new')}>
          새 수업 만들기
        </Button>
      </div>
    </PageShell>
  )
}
