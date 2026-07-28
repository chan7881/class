import { useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'

export default function ResultsPage() {
  const { code } = useParams()
  return (
    <PageShell>
      <h1 className="text-xl font-semibold">결과 대시보드</h1>
      <p className="mt-2 text-neutral-500">수업 코드: {code}</p>
      <p className="mt-4 text-sm text-neutral-500">결과·엑셀 내보내기는 10단계에서 구현됩니다 (docs/PROGRESS.md 참고).</p>
    </PageShell>
  )
}
