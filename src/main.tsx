import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './blocks' // 모든 블록 타입의 registerBlock(...) 부작용을 앱 시작 시 한 번 실행
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
