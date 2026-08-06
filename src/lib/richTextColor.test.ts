import { describe, expect, it } from 'vitest'
import { adaptTextColor, INK_TOKEN, needsThemeAdaptation, parseColor, relativeLuminance, saturation } from './richTextColor'
import { TEXT_COLORS } from '../richtext/toolbarOptions'

/**
 * 다크모드에서 글자가 사라지지 않게 하는 규칙을 고정한다.
 * 새 본문 색을 팔레트에 추가할 때 이 테스트가 같이 지켜준다.
 */

describe('parseColor', () => {
  it('여러 표기법을 읽는다', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseColor('#18181b')).toEqual({ r: 24, g: 24, b: 27 })
    expect(parseColor('rgb(37, 99, 235)')).toEqual({ r: 37, g: 99, b: 235 })
    // 브라우저가 style.color를 rgb()로 정규화해 돌려주는 경우가 많아 반드시 지원해야 한다
    expect(parseColor('rgba(24, 24, 27, 0.5)')).toEqual({ r: 24, g: 24, b: 27 })
    expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('모르는 표기는 null — 건드리지 않고 그대로 둔다', () => {
    expect(parseColor('var(--color-neutral-900)')).toBeNull()
    expect(parseColor('hsl(200 50% 50%)')).toBeNull()
    expect(parseColor('')).toBeNull()
  })
})

describe('relativeLuminance / saturation', () => {
  it('검정은 0, 흰색은 1에 가깝다', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
  })

  it('회색은 채도가 0, 순색은 1', () => {
    expect(saturation({ r: 128, g: 128, b: 128 })).toBe(0)
    expect(saturation({ r: 255, g: 0, b: 0 })).toBe(1)
  })
})

describe('needsThemeAdaptation', () => {
  it('아주 어두운 무채색은 바꿔야 한다 — 다크모드에서 배경과 같아진다', () => {
    expect(needsThemeAdaptation('#18181b')).toBe(true) // 팔레트의 검정
    expect(needsThemeAdaptation('#000000')).toBe(true)
    expect(needsThemeAdaptation('rgb(24, 24, 27)')).toBe(true)
  })

  it('아주 밝은 무채색도 바꿔야 한다 — 라이트모드에서 배경과 같아진다', () => {
    expect(needsThemeAdaptation('#ffffff')).toBe(true)
    expect(needsThemeAdaptation('white')).toBe(true)
  })

  it('유채색 강조는 그대로 둔다 — 두 모드 모두에서 읽히고 저자의 의도다', () => {
    expect(needsThemeAdaptation('#dc2626')).toBe(false) // 빨강
    expect(needsThemeAdaptation('#2563eb')).toBe(false) // 파랑
    expect(needsThemeAdaptation('#16a34a')).toBe(false) // 초록
    expect(needsThemeAdaptation('#d97706')).toBe(false) // 주황
    expect(needsThemeAdaptation('#7c3aed')).toBe(false) // 보라
  })

  it('중간 밝기 회색은 두 모드 모두에서 읽히므로 그대로 둔다', () => {
    expect(needsThemeAdaptation('#71717a')).toBe(false)
  })

  it('읽을 수 없는 표기는 건드리지 않는다', () => {
    expect(needsThemeAdaptation('var(--color-neutral-900)')).toBe(false)
  })
})

describe('adaptTextColor', () => {
  it('바꿔야 하는 색만 토큰으로 교체한다', () => {
    expect(adaptTextColor('#18181b')).toBe(INK_TOKEN)
    expect(adaptTextColor('#dc2626')).toBe('#dc2626')
  })

  it('이미 토큰이면 그대로 둔다(두 번 적용해도 안전)', () => {
    expect(adaptTextColor(INK_TOKEN)).toBe(INK_TOKEN)
  })
})

describe('본문 색 팔레트', () => {
  it('팔레트의 모든 색이 두 모드 중 한쪽에서라도 사라지지 않는다', () => {
    // 검정처럼 사라질 색은 adaptTextColor가 토큰으로 바꿔주므로, 결국 어떤 색을 골라도
    // 학생 화면에서는 읽힌다는 뜻이다. 팔레트에 색을 추가하면 여기서 자동으로 검증된다.
    for (const color of TEXT_COLORS) {
      const adapted = adaptTextColor(color)
      const stillFixed = adapted === color
      expect(stillFixed ? !needsThemeAdaptation(color) : adapted === INK_TOKEN).toBe(true)
    }
  })
})
