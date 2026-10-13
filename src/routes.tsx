import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import { PageShell } from './components/PageShell'

/*
 * 화면마다 따로 내려받는다 (2026-10-13).
 * 예전에는 한 파일(gzip 780KB)에 편집기(tiptap·dnd-kit)·결과(xlsx·recharts)까지 들어 있어,
 * 폰으로 문제만 푸는 학생도 그 전부를 받고 해석한 뒤에야 첫 화면이 떴다.
 */
const EditorPage = lazy(() => import('./pages/EditorPage'))
const PlayerPage = lazy(() => import('./pages/PlayerPage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const LivePage = lazy(() => import('./pages/LivePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function Loading() {
  return (
    <PageShell>
      <p className="text-neutral-500">불러오는 중…</p>
    </PageShell>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor/:code" element={<EditorPage />} />
        <Route path="/play/:code" element={<PlayerPage />} />
        <Route path="/results/:code" element={<ResultsPage />} />
        {/* 수업 중 실시간 진행 모니터링 — 결과 화면과 목적이 달라 따로 둔다 */}
        <Route path="/live/:code" element={<LivePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
