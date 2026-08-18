import { CircleCheck, CircleHelp, Ellipsis, TriangleAlert } from 'lucide-react'
import { MenuButton, MenuItem } from '../components/MenuButton'
import { Icon } from '../components/Icon'
import { formatSince, maskedLabel, type LiveStudent } from '../lib/liveStatus'
import { studentLabel } from '../results/StudentDetail'
import type { IdentityField } from '../types/lesson'

/**
 * 수업 중 화면의 학생 카드 한 장.
 *
 * 담는 것은 **이름 / 현재 슬라이드 / 진행 막대 / 마지막 활동** 넷뿐이다. 교실 뒤에서도 읽혀야
 * 하는 화면이라 정보를 더 넣으면 정작 찾아야 할 "멈춘 학생"이 묻힌다. 자세한 건 카드를 눌러서 본다.
 *
 * 상태는 **색 + 아이콘 + 텍스트** 세 겹으로 표시한다(CLAUDE.md 규칙 9) — 색만으로 구분하면
 * 색약 사용자와 빔프로젝터 색 왜곡에서 정보가 사라진다.
 */
export function StudentCard({
  student,
  index,
  idFields,
  maskNames,
  onOpen,
  onForceSubmit,
}: {
  student: LiveStudent
  index: number
  idFields: IdentityField[]
  maskNames: boolean
  onOpen: () => void
  /** 값이 있으면 카드 오른쪽 위에 ⋯ 메뉴가 생긴다. 이미 제출한 학생에게는 안 보인다. */
  onForceSubmit?: () => void
}) {
  const { record, state, slideLabel, slideTotal, progress, answered, totalQuestions, secondsSince } = student
  const name = maskNames ? maskedLabel(record, index) : studentLabel(record, idFields)
  const submitted = Boolean(record.submittedAt)

  // 테두리·배경만 상태별로 바꾸고 글자색은 토큰이 알아서 뒤집히게 둔다(규칙 10).
  const tone = submitted
    ? 'border-green-800/40 bg-green-50'
    : state === 'stalled'
      ? 'border-amber-400 bg-amber-50'
      : 'border-neutral-200 bg-neutral-0'

  // ⚠️ 카드 전체를 <button>으로 두면 그 안에 ⋯ 메뉴 버튼을 넣을 수 없다(버튼 중첩 금지).
  //    감싸는 div 안에 「본문 버튼」과 「메뉴 버튼」을 나란히 두고, 메뉴는 위에 겹쳐 놓는다.
  //    MenuButton 의 드롭다운은 position:absolute 라 이 div 에 overflow-hidden 을 걸면 잘린다.
  return (
    <div className={`relative flex min-h-[7rem] flex-col rounded-xl border transition-colors ${tone}`}>
      {onForceSubmit && !submitted && (
        <div className="absolute top-1 right-1 z-10">
          <MenuButton
            ariaLabel={`${name} 관리`}
            label={<Icon icon={Ellipsis} />}
            triggerClassName="tap-target inline-flex items-center justify-center rounded-lg px-1.5 text-neutral-500 transition-colors hover:bg-neutral-200/70"
          >
            <MenuItem onClick={onForceSubmit}>강제 제출</MenuItem>
          </MenuButton>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name} 답안 자세히 보기`}
        className="flex flex-1 flex-col gap-2 rounded-xl p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
      <div className={`flex items-baseline justify-between gap-2 ${onForceSubmit && !submitted ? 'pr-7' : ''}`}>
        <span className="truncate text-base font-semibold text-neutral-900">{name}</span>
        {/*
          현재 위치를 가장 크게 — 이 화면에서 교사가 제일 먼저 보는 값이다.
          전체 수를 같이 붙여 "3 / 5"로 보여준다. 번호만 있으면 그게 끝에 가까운 건지
          한참 남은 건지 알 수 없다(학생 화면의 진행 표시와 같은 형식).
        */}
        <span className="shrink-0 whitespace-nowrap text-neutral-900">
          <span className="text-2xl font-bold tabular-nums">{slideLabel ?? '—'}</span>
          <span className="text-sm font-medium tabular-nums text-neutral-500"> / {slideTotal}</span>
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className={submitted ? 'h-full bg-success' : 'h-full bg-accent-500'}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-neutral-500">
          {answered}/{totalQuestions}문항
        </span>
        <StatusText submitted={submitted} state={state} secondsSince={secondsSince} />
      </div>
      </button>
    </div>
  )
}

function StatusText({
  submitted,
  state,
  secondsSince,
}: {
  submitted: boolean
  state: LiveStudent['state']
  secondsSince: number | null
}) {
  if (submitted) {
    return (
      <span className="flex items-center gap-1 font-medium text-green-800">
        <Icon icon={CircleCheck} />
        제출 완료
      </span>
    )
  }
  if (state === 'stalled') {
    return (
      <span className="flex items-center gap-1 font-semibold text-amber-800">
        <Icon icon={TriangleAlert} />
        {formatSince(secondsSince)}
      </span>
    )
  }
  if (state === 'unknown') {
    // 캐시가 비어 활동 기록이 없는 상태. "오래 멈춤"과 반드시 구별해야 한다 —
    // 모르는 것을 멈춘 것처럼 보여주면 교사가 헛걸음한다.
    //
    // neutral-400을 쓰면 안 된다 — 흐릿하게 두고 싶은 자리지만 실측 대비가 라이트 2.56:1로
    // 규칙 10의 하한(3:1) 아래였다. 이건 장식이 아니라 상태를 알리는 글자다.
    return (
      <span className="flex items-center gap-1 text-neutral-500">
        <Icon icon={CircleHelp} />
        활동 기록 없음
      </span>
    )
  }
  return <span className="text-neutral-500">{formatSince(secondsSince)}</span>
}
