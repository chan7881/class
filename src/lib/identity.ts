/**
 * 학생 식별 정보(학년·반·번호·이름)를 저장하기 전에 다듬는다.
 *
 * 실제 응답에 `8반`, `2학년 8반`, `12번번`처럼 단위까지 적어 넣거나 이름 끝에 공백이 붙은
 * 사례가 많았다(2026-08-18 확인). 그대로 쌓이면 엑셀 수합에서 같은 반·같은 학생이
 * 여러 값으로 갈라진다.
 *
 * ⚠️ 이 규칙은 **apps-script/Code.gs 의 normalizeIdentity 와 같은 동작이어야 한다**(규칙 4).
 *    클라이언트에서 다듬는 것은 학생에게 즉시 보여 주기 위함이고, 서버에서도 한 번 더
 *    다듬는 것은 **옛 버전 화면이나 직접 호출로 들어오는 값**까지 막기 위함이다.
 */

/** 이름을 뺀 칸(학년·반·번호)은 숫자만 받는다. */
export function isNumericField(field: string): boolean {
  return field !== 'name'
}

/** 숫자만 남긴다. 전각 숫자(０-９)는 반각으로 바꿔 받아 준다. */
export function digitsOnly(raw: string): string {
  return String(raw ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '')
}

/**
 * 이름에서 **모든 공백을 없앤다** — 앞뒤뿐 아니라 가운데도(사용자 지시 2026-08-18).
 * `홍 길동` → `홍길동`. 전각 공백·탭·줄바꿈도 포함한다.
 */
export function squashName(raw: string): string {
  return String(raw ?? '').replace(/[\s　]+/g, '')
}

/** 칸 하나를 규칙에 맞게 다듬는다. */
export function normalizeIdentityValue(field: string, raw: string): string {
  return isNumericField(field) ? digitsOnly(raw) : squashName(raw)
}

/** 식별 정보 전체를 다듬는다. 없는 칸은 그대로 둔다. */
export function normalizeIdentity(identity: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [field, value] of Object.entries(identity ?? {})) {
    out[field] = value === undefined ? undefined : normalizeIdentityValue(field, value)
  }
  return out
}
