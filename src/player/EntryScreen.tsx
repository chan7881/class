import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { PageTitle } from '../components/PageTitle'
import { listQuestionsInLesson } from '../lib/findQuestion'
import { isNumericField, normalizeIdentityValue } from '../lib/identity'
import type { Identity } from '../api/types'
import type { Lesson } from '../types/lesson'

const FIELD_LABELS: Record<string, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }



export function EntryScreen({
  lesson,
  onSubmit,
  liveCode,
}: {
  lesson: Lesson
  onSubmit: (identity: Identity) => void
  /**
   * 값이 있으면 화면 맨 아래에 교사용 「수업 현황 보기」를 작게 띄운다 (홈의 「관리자」와 같은 자리·같은 크기).
   *
   * 교사가 폰으로 현황판에 들어가려면 수업 코드부터 쳐야 해서 번거롭다는 요청에서 나왔다.
   * 학생용 QR을 그대로 찍으면 코드가 주소에 들어오므로, 여기서 한 번 누르면 코드 입력 없이
   * `/live/<코드>`로 간다. 거기서 **현황 암호**를 묻는다 — 이 링크 자체는 아무 권한도 주지 않는다.
   */
  liveCode?: string
}) {
  const [values, setValues] = useState<Identity>({})

  const filled = lesson.settings.identityFields.every((field) => (values[field] ?? '').trim().length > 0)
  const hasMediaQuestion = listQuestionsInLesson(lesson).some((q) => q.kind === 'photo' || q.kind === 'drawing')
  // 학생이 코드를 잘못 입력해 엉뚱한 수업에 들어왔는지 제목만으로 헷갈릴 때가 있어 분류를 같이 보여준다
  const meta = [lesson.grade, lesson.subject, lesson.unit].filter(Boolean)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <PageTitle>{lesson.title}</PageTitle>
      {meta.length > 0 && <p className="-mt-2 text-sm text-neutral-400">{meta.join(' · ')}</p>}
      {lesson.description && <p className="text-neutral-500">{lesson.description}</p>}
      <p className="text-xs text-neutral-400">
        입력한 정보와 응답은 이 서비스를 운영하는 계정의 Google Drive·Sheets에 저장되고, 이 수업을 만든 선생님이 확인합니다.
        학번·이름은 응답을 구분하는 용도로만 쓰입니다.
        {hasMediaQuestion && ' 이 수업에는 사진·그림 문항이 있어 업로드한 파일도 같은 곳에 저장됩니다.'} 보관 기간이나 삭제
        요청은 이 수업을 만든 선생님께 문의하세요.
      </p>

      <div className="flex flex-col gap-3">
        {lesson.settings.identityFields.map((field) => {
          const numeric = isNumericField(field)
          return (
            <label key={field} className="flex flex-col gap-1 text-sm text-neutral-700">
              {FIELD_LABELS[field] ?? field}
              <input
                value={values[field] ?? ''}
                // 다듬는 규칙은 lib/identity.ts 한 곳에만 둔다 — 서버(Code.gs)도 같은 규칙을 쓴다
                onChange={(e) => setValues({ ...values, [field]: normalizeIdentityValue(field, e.target.value) })}
                // 폰에서 숫자 자판이 바로 뜨게 한다. type="number"는 쓰지 않는다 —
                // 스피너·휠 스크롤로 값이 바뀌고, 앞자리 0이 사라지는 등 부작용이 있다.
                inputMode={numeric ? 'numeric' : 'text'}
                autoComplete="off"
                placeholder={numeric ? '숫자만' : undefined}
                className="tap-target rounded-lg border border-neutral-300 px-3 outline-none focus:border-accent-500"
              />
            </label>
          )
        })}
      </div>

      <Button disabled={!filled} onClick={() => onSubmit(values)}>
        시작하기
      </Button>

      {liveCode && (
        <div className="mt-6 text-center">
          <Link to={`/live/${liveCode}`} className="tap-target inline-block text-xs text-neutral-400 underline">
            수업 현황 보기
          </Link>
        </div>
      )}
    </div>
  )
}
