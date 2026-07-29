import { forwardRef, useEffect, useState } from 'react'

interface CommaListInputProps {
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * 쉼표로 구분된 여러 값을 입력받는 인풋(빈칸채우기 보기·정답, 화학식 정답 등).
 * `value.join(', ')`를 그대로 화면에 보여주면 매 입력마다 빈 트레일링 항목이 걸러져
 * (예: "a,b," → ["a","b"] → "a, b") 방금 입력한 마지막 쉼표가 그 자리에서 사라지는 것처럼
 * 보여 끝에 쉼표를 넣을 수 없는 것처럼 느껴진다. 화면에 보이는 원문은 별도 로컬 상태로
 * 갖고, 부모에는 항상 파싱된(빈 값 제거) 배열만 올려보낸다.
 */
export const CommaListInput = forwardRef<HTMLInputElement, CommaListInputProps>(function CommaListInput(
  { value, onChange, placeholder, className },
  ref,
) {
  const [raw, setRaw] = useState(() => value.join(', '))

  useEffect(() => {
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!sameList(parsed, value)) setRaw(value.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      ref={ref}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value)
        onChange(
          e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }}
      placeholder={placeholder}
      className={className}
    />
  )
})
