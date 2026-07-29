import type { MathKeyboardLayer } from '../types/lesson'

export interface MathKeyButton {
  /** 버튼에 보일 텍스트 */
  label: string
  /**
   * 눌렀을 때 커서 위치에 넣을 LaTeX 조각. 분수·근호·첨자처럼 학생이 채워야 할 빈 칸이
   * 있는 구조는 빈 `{}` 대신 반드시 `#?`(MathLive의 채움칸 토큰, MathLive 자체 키보드가
   * "frac": "\\frac{#?}{#?}"로 정의하는 것과 동일한 방식)를 써야 삽입 직후 그 칸이 바로
   * 선택돼 이어서 타이핑이 된다 — 빈 `{}`만 넣으면 안 채워지고 커서가 밖에 남는다.
   */
  latex: string
  ariaLabel?: string
}

export interface MathKeyboardLayerDef {
  label: string
  buttons: MathKeyButton[]
}

/**
 * 학생이 수식 문항에서 실제로 누르는 버튼판. 물리 키보드가 없거나 서식 기호를 몰라도
 * 버튼만으로 입력이 끝나야 한다는 게 기본 전제다(모바일 등). 물리 키보드는 2026-07-29부터
 * 추가 입력 수단으로 함께 허용된다(`math/MathField.tsx` 참고, docs/DECISIONS.md) — 영어
 * 알파벳처럼 버튼판이 못 채우는 부분을 보완하기 위함이며, 버튼만으로도 항상 전부 가능해야
 * 한다는 원칙 자체는 유지한다(그래서 `letters` 레이어로 알파벳도 버튼으로 넣어뒀다).
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
      { label: 'xⁿ', latex: '^{#?}', ariaLabel: '위첨자' },
      { label: 'x₁', latex: '_{#?}', ariaLabel: '아래첨자' },
    ],
  },
  letters: {
    label: '영문자',
    buttons: [
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => ({ label: c, latex: c })),
      ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => ({ label: c, latex: c })),
    ],
  },
  fraction: {
    label: '분수·근호',
    buttons: [
      { label: 'a/b', latex: '\\frac{#?}{#?}', ariaLabel: '분수' },
      { label: '√', latex: '\\sqrt{#?}', ariaLabel: '제곱근' },
      { label: 'ⁿ√', latex: '\\sqrt[#?]{#?}', ariaLabel: 'n제곱근' },
      { label: '|x|', latex: '\\left|#?\\right|', ariaLabel: '절댓값' },
      { label: 'log', latex: '\\log' },
      { label: 'ln', latex: '\\ln' },
      { label: 'logₙ', latex: '\\log_{#?}', ariaLabel: '밑이 있는 로그' },
      { label: 'eˣ', latex: 'e^{#?}', ariaLabel: '자연지수' },
      { label: 'π', latex: '\\pi' },
      { label: '∞', latex: '\\infty' },
    ],
  },
  symbols: {
    label: '기호',
    buttons: [
      { label: '≤', latex: '\\leq' }, { label: '≥', latex: '\\geq' }, { label: '≠', latex: '\\neq' },
      { label: '≈', latex: '\\approx' }, { label: '≡', latex: '\\equiv' }, { label: '∝', latex: '\\propto' },
      { label: '∼', latex: '\\sim' }, { label: '≃', latex: '\\simeq' }, { label: '≅', latex: '\\cong' },
      { label: '≑', latex: '\\Doteq' }, { label: '±', latex: '\\pm' }, { label: '∓', latex: '\\mp' },
      { label: '∘', latex: '\\circ' }, { label: '·', latex: '\\cdot' },
      { label: '∈', latex: '\\in' }, { label: '∉', latex: '\\notin' },
      { label: '⊂', latex: '\\subset' }, { label: '⊃', latex: '\\supset' },
      { label: '∀', latex: '\\forall' }, { label: '∃', latex: '\\exists' },
      { label: '∅', latex: '\\varnothing' },
      { label: '∠', latex: '\\angle' }, { label: '⊥', latex: '\\perp' }, { label: '∥', latex: '\\parallel' },
      { label: '∑', latex: '\\sum' }, { label: '∫', latex: '\\int' }, { label: '∂', latex: '\\partial' },
      { label: 'lim', latex: '\\lim' },
      { label: '→', latex: '\\rightarrow' }, { label: '⇒', latex: '\\Rightarrow' }, { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '∴', latex: '\\therefore' }, { label: '∵', latex: '\\because' },
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
      { label: 'X₂', latex: '_{#?}', ariaLabel: '아래첨자' },
      { label: 'X²', latex: '^{#?}', ariaLabel: '위첨자' },
      { label: '→', latex: '\\rightarrow' },
      { label: '⇌', latex: '\\rightleftharpoons' },
      { label: '↑', latex: '\\uparrow' },
      { label: '↓', latex: '\\downarrow' },
      { label: '↔', latex: '\\leftrightarrow' },
      { label: 'Δ', latex: '\\Delta' },
      { label: '·', latex: '\\cdot' },
      { label: '⁺', latex: '^{+}' },
      { label: '⁻', latex: '^{-}' },
    ],
  },
}
