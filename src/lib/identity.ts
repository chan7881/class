/**
 * 학생 식별 정보(학년·반·번호·이름)를 다듬는다.
 *
 * 실제 응답에 `8반`, `2학년 8반`, `12번번`처럼 단위까지 적어 넣거나 이름 끝에 공백이 붙은
 * 사례가 많았다(2026-08-18 확인). 그대로 쌓이면 엑셀 수합에서 같은 반·같은 학생이
 * 여러 값으로 갈라진다.
 *
 * ★ **이 파일이 「누가 같은 학생인가」의 유일한 기준이다** (2026-08-19).
 *   기기가 바뀌어도 학년·반·번호·이름이 같으면 이어서 풀 수 있어야 한다는 요구를 지키려면,
 *   `studentKey`(응답 행을 가르는 열쇠)도 **반드시 여기를 거친 값**으로 만들어야 한다.
 *   예전에는 studentKey 는 `trim().toLowerCase()` 만 하고 시트 표시값만 여기서 다듬어서,
 *   `3번`/`3`, `고 승현`/`고승현` 이 **서로 다른 행이 되면서 화면에는 똑같이** 보였다.
 *
 * ⚠️ **apps-script/Code.gs 의 normalizeIdentity·identitySignature 와 같은 동작이어야 한다**(규칙 4).
 *    클라이언트에서 다듬는 것은 학생에게 즉시 보여 주기 위함이고, 서버에서도 다듬는 것은
 *    **옛 버전 화면이나 직접 호출로 들어오는 값**까지 막기 위함이다.
 */

/** 이름을 뺀 칸(학년·반·번호)은 숫자만 받는다. */
export function isNumericField(field: string): boolean {
  return field !== 'name'
}

/**
 * 숫자만 남긴다. 전각 숫자(０-９)는 반각으로 바꿔 받아 주고, **앞자리 0을 없앤다.**
 * `03`과 `3`은 같은 번호다 — 앞자리 0을 남기면 같은 학생이 두 행으로 갈린다.
 */
export function digitsOnly(raw: string): string {
  return String(raw ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '') // 03 → 3, 00 → 0, 10 → 10
}

/**
 * 이름에서 **모든 공백을 없애고** 유니코드를 NFC로 맞춘다.
 * `홍 길동` → `홍길동`. 전각 공백·탭·줄바꿈도 포함한다.
 *
 * NFC 정규화가 필요한 이유: 한글은 조합형(NFD)과 완성형(NFC)이 **화면에 똑같이 보이는데
 * 문자열로는 다르다.** 일부 기기·붙여넣기 경로에서 NFD가 들어오면 같은 이름인데도
 * 해시가 달라져 행이 갈린다.
 */
export function squashName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\s　]+/g, '')
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

/** studentKey·행 대조에 쓰는 필드 순서. 새 필드를 넣으면 키가 전부 바뀌니 함부로 바꾸지 말 것. */
export const IDENTITY_ORDER = ['grade', 'klass', 'number', 'name'] as const

/**
 * 「같은 학생인가」를 판정하는 문자열. 다듬은 값만 이어 붙인다.
 *
 * 서버가 응답 행을 대조할 때도 이 값을 쓴다 — 그래서 **열쇠(studentKey)가 달라도
 * 학년·반·번호·이름이 같으면 같은 행**으로 이어진다(기기 교체 대응).
 */
export function identitySignature(identity: Record<string, string | undefined>): string {
  const n = normalizeIdentity(identity ?? {})
  return IDENTITY_ORDER.map((f) => n[f] ?? '').join(':')
}

/**
 * 숫자 칸에 넣은 글자 중 **버려진 것이 있는지** 알려 준다.
 *
 * 숫자만 남기는 규칙은 「숫자가 아닌 글자」를 지울 뿐 **남은 숫자가 이어 붙는 것은 막지 않는다.**
 * 그래서 학생이 `2학년 3반` 을 치면 칸에는 `23` 이 뜬다 — 그럴듯해 보여 아무도 눈치채지 못하고,
 * 실제로 2026-08-20 수업에서 「23반 10번」 한 건이 그렇게 들어왔다(3반 10번 학생이었다).
 *
 * 값을 대신 고쳐 주지는 않는다 — 무엇을 의도했는지는 학생만 안다. 대신 **버린 글자를 알려 주어
 * 학생이 스스로 고치게** 한다.
 */
export function droppedNonDigits(field: string, raw: string): string {
  if (!isNumericField(field)) return ''
  const half = String(raw ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const dropped = half.replace(/[\d\s　]/g, '')
  return dropped
}
