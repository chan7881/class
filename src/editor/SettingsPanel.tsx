import type { IdentityField, Lesson, LessonSettings } from '../types/lesson'

const IDENTITY_LABELS: Record<IdentityField, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }
const ALL_IDENTITY_FIELDS: IdentityField[] = ['grade', 'klass', 'number', 'name']

interface SettingsPanelProps {
  lesson: Lesson
  onUpdateSettings: (updater: (settings: LessonSettings) => LessonSettings) => void
  onUpdateDescription: (description: string) => void
  onClose: () => void
}

/** 수업 전체 설정(식별 필드·진행 잠금·피드백 시점 등) — Player.tsx의 동작을 그대로 좌우한다. */
export function SettingsPanel({ lesson, onUpdateSettings, onUpdateDescription, onClose }: SettingsPanelProps) {
  const { settings } = lesson

  function toggleIdentityField(field: IdentityField) {
    onUpdateSettings((s) => ({
      ...s,
      identityFields: s.identityFields.includes(field) ? s.identityFields.filter((f) => f !== field) : [...s.identityFields, field],
    }))
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-30 bg-black/20" onClick={onClose} aria-label="설정 닫기" />
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:top-16 sm:bottom-auto sm:w-96 sm:rounded-2xl">
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

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          정오답 공개 시점 (문항별로 따로 지정하지 않은 경우의 기본값)
          <select
            value={settings.feedbackMode}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, feedbackMode: e.target.value as LessonSettings['feedbackMode'] }))}
            className="tap-target rounded border border-neutral-300 px-2"
          >
            <option value="immediate">즉시 (답하자마자)</option>
            <option value="onFinish">제출 후 (요약 화면에서)</option>
            <option value="never">공개 안 함</option>
          </select>
        </label>
      </div>
    </>
  )
}
