import { applyPreset, LESSON_PRESETS, matchPreset } from '../lib/lessonPresets'
import type { IdentityField, Lesson, LessonSettings, ReferencePanelSettings } from '../types/lesson'

const IDENTITY_LABELS: Record<IdentityField, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }
const ALL_IDENTITY_FIELDS: IdentityField[] = ['grade', 'klass', 'number', 'name']
const REFERENCE_TAB_LABELS: Record<ReferencePanelSettings['tabs'][number], string> = {
  periodic: '주기율표',
  constants: '상수표',
  units: '단위환산',
  custom: '커스텀 자료',
}
const ALL_REFERENCE_TABS: ReferencePanelSettings['tabs'][number][] = ['periodic', 'constants', 'units', 'custom']

interface SettingsPanelProps {
  lesson: Lesson
  onUpdateSettings: (updater: (settings: LessonSettings) => LessonSettings) => void
  onUpdateDescription: (description: string) => void
  onUpdateMeta: (meta: Pick<Lesson, 'subject' | 'grade' | 'unit'>) => void
  onClose: () => void
}

/** 수업 전체 설정(식별 필드·진행 잠금·피드백 시점 등) — Player.tsx의 동작을 그대로 좌우한다. */
export function SettingsPanel({ lesson, onUpdateSettings, onUpdateDescription, onUpdateMeta, onClose }: SettingsPanelProps) {
  const { settings } = lesson
  const activePreset = matchPreset(settings)

  function setMeta(field: 'subject' | 'grade' | 'unit', value: string) {
    onUpdateMeta({ subject: lesson.subject, grade: lesson.grade, unit: lesson.unit, [field]: value })
  }

  function toggleIdentityField(field: IdentityField) {
    onUpdateSettings((s) => ({
      ...s,
      identityFields: s.identityFields.includes(field) ? s.identityFields.filter((f) => f !== field) : [...s.identityFields, field],
    }))
  }

  function toggleReferenceTab(tab: ReferencePanelSettings['tabs'][number]) {
    onUpdateSettings((s) => ({
      ...s,
      referencePanel: {
        ...s.referencePanel,
        tabs: s.referencePanel.tabs.includes(tab) ? s.referencePanel.tabs.filter((t) => t !== tab) : [...s.referencePanel.tabs, tab],
      },
    }))
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-30 bg-black/20" onClick={onClose} aria-label="설정 닫기" />
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-neutral-0 p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:top-16 sm:bottom-auto sm:w-96 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">수업 설정</h2>
          <button type="button" onClick={onClose} className="tap-target rounded px-2 text-neutral-400 hover:text-neutral-700" aria-label="닫기">
            ✕
          </button>
        </div>

        <label className="mb-4 flex flex-col gap-1 text-sm text-neutral-700">
          수업 설명 (학생 입장 화면에 표시)
          <textarea
            value={lesson.description ?? ''}
            onChange={(e) => onUpdateDescription(e.target.value)}
            rows={2}
            className="rounded border border-neutral-300 px-2 py-1 outline-none focus:border-accent-500"
          />
        </label>

        {/* 분류 필드 — 수업이 쌓였을 때 목록에서 골라내기 위한 것이라 전부 선택 입력이다 */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(
            [
              ['subject', '과목', '과학'],
              ['grade', '학년', '중2'],
              ['unit', '단원', '전기와 자기'],
            ] as const
          ).map(([field, label, placeholder]) => (
            <label key={field} className="flex flex-col gap-1 text-sm text-neutral-700">
              {label}
              <input
                type="text"
                value={lesson[field] ?? ''}
                onChange={(e) => setMeta(field, e.target.value)}
                placeholder={placeholder}
                className="tap-target w-full rounded border border-neutral-300 px-2 outline-none focus:border-accent-500"
              />
            </label>
          ))}
        </div>

        <div className="mb-4">
          <p className="mb-1 text-sm font-medium text-neutral-700">학생 식별 필드</p>
          <div className="flex flex-wrap gap-3">
            {ALL_IDENTITY_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={settings.identityFields.includes(field)} onChange={() => toggleIdentityField(field)} />
                {IDENTITY_LABELS[field]}
              </label>
            ))}
          </div>
          {settings.identityFields.length === 0 && <p className="mt-1 text-xs text-danger">최소 하나는 선택해야 응답을 구분할 수 있어요</p>}
        </div>

        {/* 진행 관련 네 설정은 서로 맞물려 있어, 하나씩 고르기 전에 큰 방향부터 고르게 한다 */}
        <div className="mb-3 border-t border-neutral-200 pt-3">
          <p className="mb-1 text-sm font-medium text-neutral-700">진행 방식</p>
          <div className="flex flex-wrap gap-1.5">
            {LESSON_PRESETS.map((preset) => {
              const selected = activePreset === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  onClick={() => onUpdateSettings((s) => applyPreset(s, preset.id))}
                  className={`tap-target rounded-full border px-3 text-sm ${
                    selected ? 'border-accent-500 bg-accent-50 text-accent-ink' : 'border-neutral-300 text-neutral-600'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            {activePreset
              ? LESSON_PRESETS.find((p) => p.id === activePreset)?.description
              : '직접 조합한 설정이에요. 프리셋을 누르면 아래 네 항목이 한 번에 바뀝니다.'}
          </p>
        </div>

        <label className="mb-3 flex items-center justify-between text-sm">
          필수 문항 미응답 시 다음 슬라이드 잠금
          <input
            type="checkbox"
            checked={settings.requireAnswerToAdvance}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, requireAnswerToAdvance: e.target.checked }))}
          />
        </label>

        <label className="mb-3 flex items-center justify-between text-sm">
          이전 슬라이드로 돌아가기 허용
          <input
            type="checkbox"
            checked={settings.allowBackNavigation}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, allowBackNavigation: e.target.checked }))}
          />
        </label>

        <label className="mb-3 flex items-center justify-between text-sm">
          선택형 보기 순서를 학생마다 섞기
          <input
            type="checkbox"
            checked={settings.shuffleChoices}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, shuffleChoices: e.target.checked }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          정오답 공개 시점 (문항별로 따로 지정하지 않은 경우의 기본값)
          <select
            value={settings.feedbackMode}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, feedbackMode: e.target.value as LessonSettings['feedbackMode'] }))}
            className="tap-target rounded border border-neutral-300 px-2"
          >
            <option value="immediate">즉시 (답하자마자)</option>
            <option value="onSlideLeave">슬라이드를 넘길 때 (그 슬라이드 문항만)</option>
            <option value="onFinish">제출 후 (요약 화면에서)</option>
            <option value="never">공개 안 함</option>
          </select>
        </label>

        <div className="mt-4 border-t border-neutral-200 pt-3">
          <label className="flex items-center justify-between text-sm font-medium text-neutral-700">
            참고자료 패널 (학생 화면 우하단 버튼)
            <input
              type="checkbox"
              checked={settings.referencePanel.enabled}
              onChange={(e) => onUpdateSettings((s) => ({ ...s, referencePanel: { ...s.referencePanel, enabled: e.target.checked } }))}
            />
          </label>
          {settings.referencePanel.enabled && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap gap-3 text-sm">
                {ALL_REFERENCE_TABS.map((tab) => (
                  <label key={tab} className="flex items-center gap-1">
                    <input type="checkbox" checked={settings.referencePanel.tabs.includes(tab)} onChange={() => toggleReferenceTab(tab)} />
                    {REFERENCE_TAB_LABELS[tab]}
                  </label>
                ))}
              </div>
              {settings.referencePanel.tabs.includes('custom') && (
                <label className="flex flex-col gap-1 text-sm text-neutral-700">
                  커스텀 자료 (HTML)
                  <textarea
                    value={settings.referencePanel.customHtml ?? ''}
                    onChange={(e) => onUpdateSettings((s) => ({ ...s, referencePanel: { ...s.referencePanel, customHtml: e.target.value } }))}
                    rows={3}
                    className="rounded border border-neutral-300 px-2 py-1 outline-none focus:border-accent-500"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
