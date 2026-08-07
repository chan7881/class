import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import PlayerPage from './pages/PlayerPage'
import ResultsPage from './pages/ResultsPage'
import LivePage from './pages/LivePage'
import AdminPage from './pages/AdminPage'

export default function AppRoutes() {
  return (
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
  )
}
