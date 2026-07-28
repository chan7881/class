import { HashRouter } from 'react-router-dom'
import AppRoutes from './routes'

// GitHub Pages 정적 배포라 서버 사이드 라우팅이 없다 — HashRouter로 새로고침·직접 URL 접근 문제를 피한다.
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
