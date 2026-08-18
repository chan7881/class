import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Icon } from '../components/Icon'
import { StudentCard } from './StudentCard'
import { StudentDetail } from '../results/StudentDetail'
import type { LiveStudent, LiveView } from '../lib/liveStatus'
import type { Lesson } from '../types/lesson'

/**
 * 학생 카드 그리드. 진행 중인 학생이 위, 제출을 끝낸 학생은 아래에 접어 둔다 —
 * 이 화면의 목적은 "지금 개입이 필요한 학생 찾기"라, 끝난 학생이 자리를 차지하면 안 된다.
 */
export function LiveGrid({
  lesson,
  view,
  maskNames,
  onForceSubmit,
}: {
  lesson: Lesson
  view: LiveView
  maskNames: boolean
  /** 학생 한 명을 대신 제출 처리한다. 되돌릴 수 없어 부르는 쪽에서 먼저 확인을 받는다. */
  onForceSubmit?: (student: LiveStudent) => void
}) {
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [showSubmitted, setShowSubmitted] = useState(false)
  const idFields = lesson.settings.identityFields

  const all = [...view.inProgress, ...view.submitted]
  const detail = all.find((s) => s.record.studentKey === detailKey)

  return (
    <>
      {view.inProgress.length === 0 && view.submitted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          아직 들어온 학생이 없습니다. 학생이 수업에 접속하면 여기에 나타납니다.
        </p>
      ) : (
        <Grid students={view.inProgress} idFields={idFields} maskNames={maskNames} onOpen={setDetailKey} onForceSubmit={onForceSubmit} />
      )}

      {view.submitted.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setShowSubmitted((v) => !v)}
            aria-expanded={showSubmitted}
            // tap-target으로 44px을 보장한다 — 손가락으로 여는 버튼이라 글자 크기만큼만 두면 안 눌린다(규칙 8)
            className="tap-target flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <Icon icon={showSubmitted ? ChevronDown : ChevronRight} />
            제출 완료 {view.submitted.length}명
          </button>
          {showSubmitted && (
            <div className="mt-2">
              <Grid
                students={view.submitted}
                idFields={idFields}
                maskNames={maskNames}
                onOpen={setDetailKey}
                offset={view.inProgress.length}
              />
            </div>
          )}
        </section>
      )}

      {detail && <StudentDetail lesson={lesson} record={detail.record} onClose={() => setDetailKey(null)} />}
    </>
  )
}

function Grid({
  students,
  idFields,
  maskNames,
  onOpen,
  onForceSubmit,
  offset = 0,
}: {
  students: LiveStudent[]
  idFields: Lesson['settings']['identityFields']
  maskNames: boolean
  onOpen: (studentKey: string) => void
  onForceSubmit?: (student: LiveStudent) => void
  offset?: number
}) {
  return (
    // 카드 최소 너비를 정해 두고 화면 폭에 맞춰 열 수가 늘게 한다 — 폰에서는 2열,
    // 교실 TV에서는 6~8열이 되도록. 미디어 쿼리로 단계를 못 박지 않는다.
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
      {students.map((s, i) => (
        <StudentCard
          key={s.record.studentKey}
          student={s}
          index={offset + i}
          idFields={idFields}
          maskNames={maskNames}
          onOpen={() => onOpen(s.record.studentKey)}
          onForceSubmit={onForceSubmit ? () => onForceSubmit(s) : undefined}
        />
      ))}
    </div>
  )
}
