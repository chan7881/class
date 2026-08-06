/**
 * 교사가 리치텍스트에 직접 지정한 색을 다크모드에서도 읽히게 고친다.
 *
 * 왜 필요한가: 본문 색·형광펜 색은 수업 JSON 안에 `style="color:#18181b"`처럼 **값 그대로**
 * 저장된다. 앱의 나머지 색은 index.css의 토큰을 뒤집어 다크모드에 대응하지만, 이렇게 박혀 있는
 * 값은 뒤집힐 방법이 없다. 그래서 다크모드에서 "검은 글자 + 검은 배경"이 되어 글자가 아예 안
 * 보였다(2026-08-06 사용자 신고).
 *
 * 어떻게 고치나 — 두 가지 경우로 나뉜다.
 *  1) **배경과 같은 쪽으로 붙어버리는 색**(아주 어둡거나 아주 밝은 무채색): 저자가 "기본 글자색"
 *     을 고른 것으로 보고 토큰(`--color-neutral-900`)으로 바꾼다. 그러면 두 모드 모두에서
 *     본문과 같은 색이 되어 항상 읽힌다.
 *  2) **형광펜이 칠해진 글자**: 형광펜 색은 전부 옅은 파스텔이라 어느 모드에서든 배경이 밝다.
 *     그 위의 글자는 항상 어두워야 하므로 고정된 잉크색을 강제한다(index.css의 `mark` 규칙).
 *
 * 색상이 있는 글자(빨강·파랑 등)는 그대로 둔다 — 두 모드 모두에서 읽히고, 저자가 의도한
 * 강조 색을 앱이 멋대로 바꾸면 그것대로 이상하다.
 *
 * 순수 함수라 테스트로 규칙을 고정한다. 실제 적용은 `sanitizeHtml`이 한다.
 */

/** 두 모드에서 항상 본문과 같은 색이 되도록 하는 토큰 */
export const INK_TOKEN = 'var(--color-neutral-900)'

/** 이보다 어두우면 "검정을 고른 것"으로 본다 (0~1 상대 휘도) */
const DARK_LIMIT = 0.12
/** 이보다 밝으면 "흰색을 고른 것"으로 본다 */
const LIGHT_LIMIT = 0.85
/** 채도가 이보다 낮으면 무채색(회색 계열)으로 본다 — 어두운 남색 같은 유채색은 건드리지 않는다 */
const GRAY_LIMIT = 0.12

export interface Rgb {
  r: number
  g: number
  b: number
}

/** `#abc` · `#aabbcc` · `rgb(1, 2, 3)` · `rgba(1,2,3,.5)`를 읽는다. 그 밖의 표기는 null. */
export function parseColor(raw: string): Rgb | null {
  const value = raw.trim().toLowerCase()

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const h = hex[1]
    if (h.length === 3) {
      return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) }
    }
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }

  const rgb = value.match(/^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/)
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  }

  if (value === 'black') return { r: 0, g: 0, b: 0 }
  if (value === 'white') return { r: 255, g: 255, b: 255 }
  return null
}

/** WCAG 상대 휘도(0~1) */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = Math.min(255, Math.max(0, v)) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 0(완전 무채색) ~ 1 — HSV 채도 */
export function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/**
 * 이 글자색을 토큰으로 바꿔야 하는가 — 즉 "모드에 따라 뒤집혀야 하는 무채색"인가.
 * 유채색(빨강·파랑 등)이나 중간 밝기의 회색은 두 모드 모두에서 읽히므로 그대로 둔다.
 */
export function needsThemeAdaptation(raw: string): boolean {
  const rgb = parseColor(raw)
  if (!rgb) return false
  if (saturation(rgb) > GRAY_LIMIT) return false
  const l = relativeLuminance(rgb)
  return l < DARK_LIMIT || l > LIGHT_LIMIT
}

/** 바꿔야 하면 토큰을, 아니면 원래 색을 그대로 돌려준다. */
export function adaptTextColor(raw: string): string {
  return needsThemeAdaptation(raw) ? INK_TOKEN : raw
}
