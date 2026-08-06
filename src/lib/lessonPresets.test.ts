import { describe, expect, it } from 'vitest'
import { applyPreset, LESSON_PRESETS, matchPreset } from './lessonPresets'
import type { LessonSettings } from '../types/lesson'

function baseSettings(): LessonSettings {
  return {
    requireAnswerToAdvance: true,
    allowBackNavigation: true,
    feedbackMode: 'onFinish',
    identityFields: ['klass', 'number', 'name'],
    shuffleChoices: false,
    referencePanel: { enabled: true, tabs: ['periodic'] },
  }
}

describe('lessonPresets', () => {
  it('프리셋을 적용해도 진행과 무관한 설정은 그대로 둔다', () => {
    const next = applyPreset(baseSettings(), 'assessment')
    expect(next.identityFields).toEqual(['klass', 'number', 'name'])
    expect(next.referencePanel).toEqual({ enabled: true, tabs: ['periodic'] })
  })

  it('평가 프리셋은 되돌아가기·정오답 공개를 막고 보기를 섞는다', () => {
    const next = applyPreset(baseSettings(), 'assessment')
    expect(next.allowBackNavigation).toBe(false)
    expect(next.feedbackMode).toBe('never')
    expect(next.shuffleChoices).toBe(true)
  })

  it('적용한 프리셋은 다시 그 프리셋으로 인식된다', () => {
    for (const preset of LESSON_PRESETS) {
      expect(matchPreset(applyPreset(baseSettings(), preset.id))).toBe(preset.id)
    }
  })

  it('교사가 직접 조합한 상태는 어떤 프리셋에도 걸리지 않는다', () => {
    const custom = { ...baseSettings(), allowBackNavigation: false, feedbackMode: 'immediate' as const }
    expect(matchPreset(custom)).toBeNull()
  })

  it('프리셋끼리 설정 조합이 겹치지 않는다 — 겹치면 어느 쪽이 선택됐는지 화면에서 구분이 안 된다', () => {
    const keys = LESSON_PRESETS.map((p) => JSON.stringify(p.settings))
    expect(new Set(keys).size).toBe(LESSON_PRESETS.length)
  })
})
