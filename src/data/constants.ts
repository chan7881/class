/** 중고등 과학 수업에서 자주 쓰는 상수표 — 참고자료 패널(9단계, docs/PLAN.md 7번 항목). */
export interface ScienceConstant {
  nameKo: string
  symbol: string
  value: string
  unit: string
}

export const SCIENCE_CONSTANTS: ScienceConstant[] = [
  { nameKo: '중력가속도', symbol: 'g', value: '9.8', unit: 'm/s²' },
  { nameKo: '빛의 속력', symbol: 'c', value: '3.00×10⁸', unit: 'm/s' },
  { nameKo: '아보가드로 수', symbol: 'Nₐ', value: '6.02×10²³', unit: '/mol' },
  { nameKo: '기체상수', symbol: 'R', value: '8.31', unit: 'J/(mol·K)' },
  { nameKo: '표준상태 기체 몰부피', symbol: 'Vₘ', value: '22.4', unit: 'L/mol' },
  { nameKo: '플랑크 상수', symbol: 'h', value: '6.63×10⁻³⁴', unit: 'J·s' },
  { nameKo: '전자 전하량', symbol: 'e', value: '1.60×10⁻¹⁹', unit: 'C' },
  { nameKo: '쿨롱 상수', symbol: 'k', value: '9.00×10⁹', unit: 'N·m²/C²' },
  { nameKo: '만유인력 상수', symbol: 'G', value: '6.67×10⁻¹¹', unit: 'N·m²/kg²' },
  { nameKo: '물의 비열', symbol: 'c', value: '4.18', unit: 'J/(g·℃)' },
  { nameKo: '표준 대기압', symbol: 'atm', value: '101,325', unit: 'Pa' },
  { nameKo: '절대영도', symbol: '0 K', value: '−273.15', unit: '℃' },
]
