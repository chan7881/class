import { sha256Hex } from './hash'
import type { Identity } from '../api/types'
import type { IdentityField } from '../types/lesson'

const FIELD_ORDER: IdentityField[] = ['grade', 'klass', 'number', 'name']

/** studentKey = sha256(code + 식별필드값들) — 같은 학생의 재접속을 같은 응답 행으로 upsert하기 위함 (docs/PLAN.md). */
export async function computeStudentKey(code: string, identity: Identity): Promise<string> {
  const values = FIELD_ORDER.map((field) => identity[field]?.trim().toLowerCase() ?? '')
  return sha256Hex(`${code}:${values.join(':')}`)
}
