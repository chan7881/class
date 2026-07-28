import { useState } from 'react'
import { Button } from '../components/Button'
import type { Identity } from '../api/types'
import type { Lesson } from '../types/lesson'

const FIELD_LABELS: Record<string, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }

export function EntryScreen({ lesson, onSubmit }: { lesson: Lesson; onSubmit: (identity: Identity) => void }) {
  const [values, setValues] = useState<Identity>({})

  const filled = lesson.settings.identityFields.every((field) => (values[field] ?? '').trim().length > 0)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <h1 className="text-2xl font-bold">{lesson.title}</h1>
      {lesson.description && <p className="text-neutral-500">{lesson.description}</p>}
      <p className="text-xs text-neutral-400">
        입력한 정보와 응답은 이 수업을 만든 교사에게 전달됩니다. 학번·이름은 응답을 구분하는 용도로만 쓰입니다.
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
