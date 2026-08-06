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

/**
 * 본문 색.
 *
 * 첫 번째 '기본 글자색'은 고정된 검정(#18181b)이 아니라 **토큰**이다 — 값이 그대로 저장되는
 * 인라인 색은 다크모드에서 뒤집히지 않아 검정을 고르면 어두운 배경에 검은 글자가 되어 아예
 * 안 보였다(2026-08-06 신고). 토큰으로 저장하면 편집 화면·학생 화면 양쪽에서 모드에 따라
 * 저절로 뒤집힌다. 색 견본 버튼도 이 값을 그대로 background로 쓰므로 견본까지 알아서 맞는다.
 *
 * 나머지 유채색은 두 모드 모두에서 읽히므로 값 그대로 둔다.
 * ⚠️ 여기에 색을 추가할 때는 다크·라이트 양쪽에서 배경과 구분되는지 확인할 것 —
 *    `lib/richTextColor.test.ts`가 팔레트를 훑어 검사한다.
 */
export const TEXT_COLORS = [
  'var(--color-neutral-900)',
  'var(--color-rt-red)',
  'var(--color-rt-amber)',
  'var(--color-rt-green)',
  'var(--color-rt-blue)',
  'var(--color-rt-violet)',
] as const

export const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'] as const
