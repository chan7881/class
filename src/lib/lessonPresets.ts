import type { LessonSettings } from '../types/lesson'

/**
 * 수업 진행 방식 프리셋.
 *
 * 왜 두나: 진행 관련 설정(되돌아가기·필수 응답 잠금·정오답 공개 시점·보기 섞기)은 네 개가
 * 서로 맞물려 있어서 하나씩 고르면 앞뒤가 안 맞는 조합이 나오기 쉽다. 예를 들어 평가로 쓰면서
 * 정오답을 즉시 공개하면 앞 학생 답을 보고 베낄 수 있다. 교사가 실제로 하는 판단은
 * "지금 이걸 수업 중에 같이 푸나, 과제로 내주나, 평가로 쓰나" 셋 중 하나라, 그 판단만 고르면
 * 나머지가 따라오게 한다.
 *
 * 프리셋은 진행 관련 네 항목만 건드린다 — 식별 필드나 참고자료 패널처럼 진행 방식과 무관한
 * 설정을 같이 덮어쓰면 교사가 애써 맞춰둔 것이 소리 없이 날아간다.
 */

export type LessonPresetId = 'guided' | 'homework' | 'assessment'

type ProgressionSettings = Pick<LessonSettings, 'requireAnswerToAdvance' | 'allowBackNavigation' | 'feedbackMode' | 'shuffleChoices'>

export interface LessonPreset {
  id: LessonPresetId
  label: string
  description: string
  settings: ProgressionSettings
}

export const LESSON_PRESETS: LessonPreset[] = [
  {
    id: 'guided',
    label: '함께 진행',
    description: '수업 중 교사와 같은 속도로 — 슬라이드를 넘길 때마다 정오답을 확인하고, 앞으로만 나아갑니다',
    settings: { requireAnswerToAdvance: true, allowBackNavigation: false, feedbackMode: 'onSlideLeave', shuffleChoices: false },
  },
  {
    id: 'homework',
    label: '개별 과제',
    description: '학생이 스스로 속도를 조절 — 앞뒤로 오가며 고칠 수 있고, 정오답은 제출 후 한 번에 봅니다',
    settings: { requireAnswerToAdvance: true, allowBackNavigation: true, feedbackMode: 'onFinish', shuffleChoices: false },
  },
  {
    id: 'assessment',
    label: '평가',
    description: '되돌아가기와 정오답 공개를 막고 보기 순서를 학생마다 섞습니다',
    settings: { requireAnswerToAdvance: true, allowBackNavigation: false, feedbackMode: 'never', shuffleChoices: true },
  },
]

/** 지금 설정이 어떤 프리셋과 정확히 같은지 — 같은 게 없으면 null(교사가 직접 조합한 상태) */
export function matchPreset(settings: LessonSettings): LessonPresetId | null {
  const found = LESSON_PRESETS.find(
    (p) =>
      p.settings.requireAnswerToAdvance === settings.requireAnswerToAdvance &&
      p.settings.allowBackNavigation === settings.allowBackNavigation &&
      p.settings.feedbackMode === settings.feedbackMode &&
      p.settings.shuffleChoices === settings.shuffleChoices,
  )
  return found?.id ?? null
}

/** 프리셋을 적용하되 진행과 무관한 설정(식별 필드·참고자료 패널 등)은 그대로 둔다 */
export function applyPreset(settings: LessonSettings, id: LessonPresetId): LessonSettings {
  const preset = LESSON_PRESETS.find((p) => p.id === id)
  if (!preset) return settings
  return { ...settings, ...preset.settings }
}
