/**
 * 현황 암호 — 교사가 직접 정하는, **진행 상황 화면 전용** 암호.
 *
 * 왜 편집 키를 짧게 하지 않고 이걸 따로 두는가: 편집 키는 이 앱의 유일한 인증 수단이라
 * 짧게 만들면 수업을 고치거나 지울 권한까지 통째로 약해진다. 대신 **권한이 낮은 열쇠**를
 * 하나 더 두면, 새더라도 할 수 있는 일이 `getLive` 하나뿐이다.
 *
 * 다만 사람이 정하는 암호는 짐작당하기 쉽다. 게다가 수업 코드는 학생에게 알려주는 값이라
 * **공격자가 대상 수업을 이미 알고 있다고 봐야 한다.** 그래서 서버의 시도 횟수 제한과 별개로
 * 여기서 최소 길이와 뻔한 값을 걸러낸다. (규칙은 `apps-script/Code.gs`에도 손으로 옮겨 적혀
 * 있다 — CLAUDE.md 규칙 4에 따라 한쪽만 고치면 안 된다.)
 */

/**
 * 최소 길이를 글자 종류에 따라 다르게 잡는다.
 *
 * 숫자만 쓰면 한 자리에 10가지뿐이라 6자(100만 가지)는 돼야 시도 제한과 합쳐 버틴다.
 * 반면 한글은 한 글자에 1만 가지가 넘어서 4자면 이미 숫자 6자보다 훨씬 넓다 —
 * 여기까지 6자를 요구하면 '전기와자기' 같은 자연스러운 암호가 막혀 쓰기만 불편해진다.
 */
export const VIEW_PASSWORD_MIN_LENGTH = 4
export const VIEW_PASSWORD_MIN_LENGTH_DIGITS_ONLY = 6

/**
 * 쓸 수 없는 암호면 이유를, 괜찮으면 null을 돌려준다.
 * `code`를 넘기면 "수업 코드와 같은 암호"도 거른다 — 학생이 제일 먼저 넣어 볼 값이다.
 */
export function validateViewPassword(password: string, code?: string): string | null {
  const value = String(password ?? '')

  if (value !== value.trim()) return '앞뒤 공백은 넣을 수 없습니다'
  if (/\s/.test(value)) return '공백은 넣을 수 없습니다'

  const digitsOnly = /^\d+$/.test(value)
  const min = digitsOnly ? VIEW_PASSWORD_MIN_LENGTH_DIGITS_ONLY : VIEW_PASSWORD_MIN_LENGTH
  if (value.length < min) {
    return digitsOnly
      ? `숫자만 쓸 때는 ${VIEW_PASSWORD_MIN_LENGTH_DIGITS_ONLY}자 이상으로 정해주세요`
      : `${VIEW_PASSWORD_MIN_LENGTH}자 이상으로 정해주세요`
  }

  // 같은 글자만 반복(aaaaaa, 111111)
  if (new Set(value).size === 1) return '같은 글자만 반복할 수는 없습니다'

  // 연속된 숫자(123456, 987654) — 자릿수와 상관없이 전부 이어지는 경우만 막는다
  if (/^\d+$/.test(value) && isSequential(value)) return '123456처럼 이어지는 숫자는 쓸 수 없습니다'

  if (code && value.toLowerCase() === String(code).toLowerCase()) {
    return '수업 코드와 같은 암호는 쓸 수 없습니다 (학생이 가장 먼저 넣어 봅니다)'
  }
  return null
}

function isSequential(digits: string): boolean {
  let up = true
  let down = true
  for (let i = 1; i < digits.length; i++) {
    const diff = digits.charCodeAt(i) - digits.charCodeAt(i - 1)
    if (diff !== 1) up = false
    if (diff !== -1) down = false
  }
  return up || down
}
