import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import PlayerPage from './pages/PlayerPage'
import ResultsPage from './pages/ResultsPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor/:code" element={<EditorPage />} />
      <Route path="/play/:code" element={<PlayerPage />} />
      <Route path="/results/:code" element={<ResultsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
