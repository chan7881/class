import { useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'

export default function EditorPage() {
  const { code } = useParams()
  return (
    <PageShell>
      <h1 className="text-xl font-semibold">교사 에디터</h1>
      <p className="mt-2 text-neutral-500">수업 코드: {code}</p>
      <p className="mt-4 text-sm text-neutral-500">블록 에디터는 3단계에서 구현됩니다 (docs/PROGRESS.md 참고).</p>
    </PageShell>
  )
}
