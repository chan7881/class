import type { MathKeyboardLayer } from '../types/lesson'

export interface MathKeyButton {
  /** 버튼에 보일 텍스트 */
  label: string
  /** 눌렀을 때 커서 위치에 넣을 LaTeX 조각 */
  latex: string
  ariaLabel?: string
}

export interface MathKeyboardLayerDef {
  label: string
  buttons: MathKeyButton[]
}

/**
 * 학생이 수식 문항에서 실제로 누르는 버튼판. 물리 키보드로 LaTeX를 직접 치는 걸
 * 전제하지 않는다는 사용자 지시에 따라, 여기 없는 기호는 애초에 입력할 방법이 없다.
 */
export const MATH_KEYBOARDS: Record<MathKeyboardLayer, MathKeyboardLayerDef> = {
  basic: {
    label: '기본',
    buttons: [
      { label: '7', latex: '7' }, { label: '8', latex: '8' }, { label: '9', latex: '9' }, { label: '÷', latex: '\\div' },
      { label: '4', latex: '4' }, { label: '5', latex: '5' }, { label: '6', latex: '6' }, { label: '×', latex: '\\times' },
      { label: '1', latex: '1' }, { label: '2', latex: '2' }, { label: '3', latex: '3' }, { label: '−', latex: '-' },
      { label: '0', latex: '0' }, { label: '.', latex: '.' }, { label: '=', latex: '=' }, { label: '+', latex: '+' },
      { label: 'x', latex: 'x' }, { label: 'y', latex: 'y' }, { label: '(', latex: '(' }, { label: ')', latex: ')' },
      { label: 'x²', latex: '^2', ariaLabel: '제곱' },
      { label: 'xⁿ', latex: '^{}', ariaLabel: '위첨자' },
      { label: 'x₁', latex: '_{}', ariaLabel: '아래첨자' },
    ],
  },
  fraction: {
    label: '분수·근호',
    buttons: [
      { label: 'a/b', latex: '\\frac{}{}', ariaLabel: '분수' },
      { label: '√', latex: '\\sqrt{}', ariaLabel: '제곱근' },
      { label: 'ⁿ√', latex: '\\sqrt[]{}', ariaLabel: 'n제곱근' },
      { label: '|x|', latex: '\\left|\\right|', ariaLabel: '절댓값' },
      { label: 'log', latex: '\\log' },
      { label: 'ln', latex: '\\ln' },
      { label: 'logₙ', latex: '\\log_{}', ariaLabel: '밑이 있는 로그' },
      { label: 'eˣ', latex: 'e^{}', ariaLabel: '자연지수' },
      { label: 'π', latex: '\\pi' },
      { label: '∞', latex: '\\infty' },
    ],
  },
  greek: {
    label: '그리스 문자',
    buttons: [
      { label: 'α', latex: '\\alpha' }, { label: 'β', latex: '\\beta' }, { label: 'γ', latex: '\\gamma' },
      { label: 'Δ', latex: '\\Delta' }, { label: 'θ', latex: '\\theta' }, { label: 'λ', latex: '\\lambda' },
      { label: 'μ', latex: '\\mu' }, { label: 'π', latex: '\\pi' }, { label: 'ρ', latex: '\\rho' },
      { label: 'σ', latex: '\\sigma' }, { label: 'ω', latex: '\\omega' },
    ],
  },
  unit: {
    label: '단위',
    buttons: [
      { label: 'm', latex: '\\,\\text{m}' }, { label: 's', latex: '\\,\\text{s}' }, { label: 'kg', latex: '\\,\\text{kg}' },
      { label: 'N', latex: '\\,\\text{N}' }, { label: 'J', latex: '\\,\\text{J}' }, { label: 'W', latex: '\\,\\text{W}' },
      { label: 'Pa', latex: '\\,\\text{Pa}' }, { label: 'mol', latex: '\\,\\text{mol}' },
      { label: '℃', latex: '\\,°\\text{C}' }, { label: 'K', latex: '\\,\\text{K}' },
      { label: 'm/s', latex: '\\,\\text{m/s}' }, { label: 'm/s²', latex: '\\,\\text{m/s}^2' },
    ],
  },
  chem: {
    label: '화학',
    buttons: [
      { label: 'X₂', latex: '_{}', ariaLabel: '아래첨자' },
      { label: 'X²', latex: '^{}', ariaLabel: '위첨자' },
      { label: '→', latex: '\\rightarrow' },
      { label: '⇌', latex: '\\rightleftharpoons' },
      { label: 'Δ', latex: '\\Delta' },
      { label: '·', latex: '\\cdot' },
      { label: '⁺', latex: '^{+}' },
      { label: '⁻', latex: '^{-}' },
    ],
  },
}
