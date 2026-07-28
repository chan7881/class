/** 버블 툴바에서 쓰는 고정 옵션들 — 여기 값만 바꾸면 에디터 전체에 반영된다. */

export const FONT_FAMILIES = [
  { label: '기본', value: '' },
  { label: '고딕', value: "'Pretendard', system-ui, sans-serif" },
  { label: '명조', value: "'Nanum Myeongjo', serif" },
  { label: '고정폭', value: "'D2Coding', 'Consolas', monospace" },
] as const

export const FONT_SIZES = [
  { label: '작게', value: '14px' },
  { label: '보통', value: '' },
  { label: '크게', value: '20px' },
  { label: '아주 크게', value: '28px' },
] as const

export const TEXT_COLORS = ['#18181b', '#dc2626', '#d97706', '#16a34a', '#2563eb', '#7c3aed'] as const

export const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'] as const
