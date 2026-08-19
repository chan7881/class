import { sha256Hex } from './hash'
import { identitySignature } from './identity'
import type { Identity } from '../api/types'

/**
 * studentKey = sha256(code + **다듬은** 식별필드값들).
 *
 * 같은 학생의 재접속을 같은 응답 행으로 잇기 위한 열쇠다(docs/PLAN.md).
 *
 * ★ 2026-08-19: 다듬기를 `lib/identity.ts` 한 곳으로 모았다. 예전에는 여기서
 *   `trim().toLowerCase()` 만 해서, 화면에 보이는 값(서버가 normalizeIdentity 로 다듬어
 *   저장)과 행을 가르는 열쇠가 **서로 다른 규칙**을 썼다. `3번`/`3`, `고 승현`/`고승현`,
 *   `03`/`3`, NFD/NFC 가 각각 다른 행이 되면서 시트에는 똑같이 보였다.
 *
 * ⚠️ 열쇠가 바뀌면 **옛 행을 못 찾는다.** 그래서 서버는 열쇠로 못 찾으면
 *   **다듬은 식별정보로 한 번 더 대조**한다(Code.gs `findRowIndexForRecord`).
 *   그 대비책 없이 이 함수만 고치면 배포 순간 전원이 새 행을 만든다.
 */
export async function computeStudentKey(code: string, identity: Identity): Promise<string> {
  return sha256Hex(`${code}:${identitySignature(identity)}`)
}
