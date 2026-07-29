import { useEffect, useRef, useState } from 'react'
import { MathfieldElement } from 'mathlive'
import { MATH_KEYBOARDS } from '../lib/mathKeyboards'
import type { MathKeyboardLayer } from '../types/lesson'

interface MathFieldProps {
  value: string
  onChange: (latex: string) => void
  keyboards: MathKeyboardLayer[]
  disabled?: boolean
}

/**
 * math-field 커스텀 엘리먼트를 JSX가 아니라 직접 DOM으로 마운트한다 — mathlive가
 * JSX.IntrinsicElements에 <math-field>를 선언해주지 않아서다. 이 방식이 ref로
 * 명령형 API(예: insert())를 다루기도 더 편하다.
 */
export function MathField({ value, onChange, keyboards, disabled }: MathFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<MathfieldElement | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const field = new MathfieldElement()
    field.value = value
    field.mathVirtualKeyboardPolicy = 'manual' // MathLive 자체 가상 키보드는 절대 안 띄운다
    field.className = 'w-full px-3 py-2 text-lg outline-none'

    // 물리 키보드 입력·붙여넣기를 전부 허용한다 — 버튼판이 기본 입력 수단이지만(특히
    // 모바일), 영어 알파벳처럼 버튼판에 없는 경우를 학생이 물리 키보드로도 보완할 수
    // 있어야 한다는 사용자 지시(2026-07-29, docs/DECISIONS.md 참고).
    const handleInput = () => onChangeRef.current(field.value)
    field.addEventListener('input', handleInput)

    container.appendChild(field)
    fieldRef.current = field

    return () => {
      field.removeEventListener('input', handleInput)
      container.removeChild(field)
      fieldRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const field = fieldRef.current
    if (field && field.value !== value) field.value = value
  }, [value])

  useEffect(() => {
    const field = fieldRef.current
    if (field) field.disabled = !!disabled
  }, [disabled])

  function insert(latex: string) {
    const field = fieldRef.current
    if (!field || disabled) return
    field.insert(latex, { focus: true })
  }

  const layers = keyboards.length > 0 ? keyboards : (['basic'] as MathKeyboardLayer[])

  return (
    <div>
      <div ref={containerRef} className="tap-target rounded-lg border border-neutral-300 bg-white focus-within:border-accent-500" />
      <MathKeyboardPanel layers={layers} onPress={insert} disabled={disabled} />
    </div>
  )
}

function MathKeyboardPanel({
  layers,
  onPress,
  disabled,
}: {
  layers: MathKeyboardLayer[]
  onPress: (latex: string) => void
  disabled?: boolean
}) {
  const [active, setActive] = useState<MathKeyboardLayer>(layers[0])
  const useTabs = layers.length > 1
  const current = MATH_KEYBOARDS[layers.includes(active) ? active : layers[0]]

  return (
    <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
      {useTabs && (
        <div className="mb-2 flex flex-wrap gap-1">
          {layers.map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setActive(layer)}
              className={`tap-target rounded px-2 text-xs ${active === layer ? 'bg-accent-500 text-white' : 'bg-white text-neutral-600'}`}
            >
              {MATH_KEYBOARDS[layer].label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
        {current.buttons.map((btn) => (
          <button
            key={btn.label + btn.latex}
            type="button"
            disabled={disabled}
            onClick={() => onPress(btn.latex)}
            aria-label={btn.ariaLabel ?? btn.label}
            className="tap-target rounded border border-neutral-200 bg-white text-base disabled:opacity-50"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}
