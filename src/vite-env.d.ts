/// <reference types="vite/client" />

// .env.example에 있는 키와 맞춰둔다 — 새 환경변수를 추가하면 여기도 같이 늘린다.
interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'live'
  readonly VITE_APPS_SCRIPT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
