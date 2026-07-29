import { useState } from 'react'
import { Button } from '../components/Button'
import { listQuestionsInLesson } from '../lib/findQuestion'
import type { Identity } from '../api/types'
import type { Lesson } from '../types/lesson'

const FIELD_LABELS: Record<string, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }

export function EntryScreen({ lesson, onSubmit }: { lesson: Lesson; onSubmit: (identity: Identity) => void }) {
  const [values, setValues] = useState<Identity>({})

  const filled = lesson.settings.identityFields.every((field) => (values[field] ?? '').trim().length > 0)
  const hasMediaQuestion = listQuestionsInLesson(lesson).some((q) => q.kind === 'photo' || q.kind === 'drawing')

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <h1 className="text-2xl font-bold">{lesson.title}</h1>
      {lesson.description && <p className="text-neutral-500">{lesson.description}</p>}
      <p className="text-xs text-neutral-400">
        입력한 정보와 응답은 이 서비스를 운영하는 계정의 Google Drive·Sheets에 저장되고, 이 수업을 만든 선생님이 확인합니다.
        학번·이름은 응답을 구분하는 용도로만 쓰입니다.
        {hasMediaQuestion && ' 이 수업에는 사진·그림 문항이 있어 업로드한 파일도 같은 곳에 저장됩니다.'} 보관 기간이나 삭제
        요청은 이 수업을 만든 선생님께 문의하세요.
      </p>

      <div className="flex flex-col gap-3">
        {lesson.settings.identityFields.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-sm text-neutral-700">
            {FIELD_LABELS[field] ?? field}
            <input
              value={values[field] ?? ''}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              className="tap-target rounded-lg border border-neutral-300 px-3 outline-none focus:border-accent-500"
            />
          </label>
        ))}
      </div>

      <Button disabled={!filled} onClick={() => onSubmit(values)}>
        시작하기
      </Button>
    </div>
  )
}
