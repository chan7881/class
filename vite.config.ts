/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 프로젝트 페이지(https://<user>.github.io/class/)로 배포하므로
// 빌드 시 에셋 경로 기준을 '/class/'로 맞춘다. 로컬 개발(dev)에는 영향 없음.
// (실제 배포는 11단계. 리포가 Private인 동안은 Pages 무료 배포가 안 될 수 있음 —
//  docs/PROGRESS.md 미해결 이슈 참고)
export default defineConfig({
  base: '/class/',
  plugins: [react(), tailwindcss()],
  test: {
    // 지금은 순수 함수(grade/units/migrate 등)만 테스트한다. 컴포넌트 테스트가 필요해지면
    // 그때 jsdom + @testing-library/react를 추가하고 environment를 바꾼다.
    environment: 'node',
  },
})
