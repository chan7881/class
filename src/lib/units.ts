/**
 * 소규모 단위 레지스트리 — 범용 차원해석 엔진이 아니다(docs/PLAN.md 2번 항목: "과잉 구현").
 * 자주 쓰는 단위 문자열을 직접 등록해두고, 등록 안 된 조합(예: 희귀한 접두어 조합)은
 * 그냥 "인식 못 함"으로 처리한다 — SI 접두어를 체계적으로 조합하는 파서 대신 명시적 표를 쓴다.
 * 온도(K/℃)는 배율이 아니라 오프셋이 있는 변환이라 서로 다른 base로 두고 변환은 하지 않는다.
 */

export interface UnitEntry {
  /** 같은 물리량을 나타내는 표준 기준 단위 이름 (이 값이 같아야 서로 변환 가능) */
  base: string
  /** 이 단위 1개 = base 단위로 몇 개인지 */
  factor: number
}

const UNIT_TABLE: Record<string, UnitEntry> = {
  // 길이
  m: { base: 'm', factor: 1 },
  km: { base: 'm', factor: 1000 },
  cm: { base: 'm', factor: 0.01 },
  mm: { base: 'm', factor: 0.001 },

  // 시간
  s: { base: 's', factor: 1 },
  ms: { base: 's', factor: 0.001 },
  min: { base: 's', factor: 60 },
  h: { base: 's', factor: 3600 },

  // 질량
  kg: { base: 'kg', factor: 1 },
  g: { base: 'kg', factor: 0.001 },
  mg: { base: 'kg', factor: 1e-6 },

  // 힘·에너지·일률·압력
  N: { base: 'N', factor: 1 },
  J: { base: 'J', factor: 1 },
  kJ: { base: 'J', factor: 1000 },
  cal: { base: 'J', factor: 4.184 },
  kcal: { base: 'J', factor: 4184 },
  W: { base: 'W', factor: 1 },
  kW: { base: 'W', factor: 1000 },
  Pa: { base: 'Pa', factor: 1 },
  kPa: { base: 'Pa', factor: 1000 },
  atm: { base: 'Pa', factor: 101325 },

  // 전기
  V: { base: 'V', factor: 1 },
  A: { base: 'A', factor: 1 },
  C: { base: 'C', factor: 1 },
  ohm: { base: 'ohm', factor: 1 },
  Ω: { base: 'ohm', factor: 1 },
  Hz: { base: 'Hz', factor: 1 },

  // 부피·농도
  L: { base: 'L', factor: 1 },
  mL: { base: 'L', factor: 0.001 },
  mol: { base: 'mol', factor: 1 },
  'mol/L': { base: 'mol/L', factor: 1 },
  M: { base: 'mol/L', factor: 1 },

  // 온도 — 배율 변환이 성립하지 않아 서로 다른 base로 둔다(즉 서로 "호환"되지 않음)
  K: { base: 'K', factor: 1 },
  '°C': { base: '°C', factor: 1 },
  '℃': { base: '°C', factor: 1 },

  // 속도·가속도·밀도
  'm/s': { base: 'm/s', factor: 1 },
  'km/h': { base: 'm/s', factor: 1 / 3.6 },
  'm/s^2': { base: 'm/s^2', factor: 1 },
  'm/s²': { base: 'm/s^2', factor: 1 },
  'g/mL': { base: 'g/mL', factor: 1 },
  'g/cm^3': { base: 'g/mL', factor: 1 },
  'g/cm³': { base: 'g/mL', factor: 1 },
  'kg/m^3': { base: 'g/mL', factor: 0.001 },
  'kg/m³': { base: 'g/mL', factor: 0.001 },
}

/** 자주 쓰는 단위를 버튼으로 노출할 때 쓰는 목록 (numeric 문항 에디터·입력 UI 공용) */
export const COMMON_UNITS = [
  'm', 'km', 'cm', 'mm', 's', 'min', 'h', 'kg', 'g',
  'N', 'J', 'W', 'Pa', 'atm', 'V', 'A', 'C', 'Ω', 'Hz',
  'L', 'mL', 'mol', 'mol/L', 'K', '°C', 'm/s', 'km/h', 'm/s²', 'g/mL',
] as const

export function normalizeUnitString(raw: string | undefined | null): string {
  return (raw ?? '').trim()
}

export function lookupUnit(raw: string | undefined | null): UnitEntry | null {
  const key = normalizeUnitString(raw)
  return key ? (UNIT_TABLE[key] ?? null) : null
}

/** 두 단위가 서로 환산 가능한(같은 물리량의) 단위인지. 등록 안 된 단위는 항상 false. */
export function unitsAreCompatible(a: string | undefined, b: string | undefined): boolean {
  const ea = lookupUnit(a)
  const eb = lookupUnit(b)
  return !!ea && !!eb && ea.base === eb.base
}

/** value(unit 단위)를 그 물리량의 기준 단위 수치로 바꾼다. 등록 안 된 단위면 null. */
export function toBaseValue(value: number, unit: string | undefined): number | null {
  const entry = lookupUnit(unit)
  return entry ? value * entry.factor : null
}
