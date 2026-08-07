import { describe, expect, it } from 'vitest'
import { validateViewPassword } from './viewPassword'

describe('validateViewPassword', () => {
  it('평범한 암호는 통과한다', () => {
    expect(validateViewPassword('전기와자기')).toBeNull()
    expect(validateViewPassword('과학2반')).toBeNull()
    expect(validateViewPassword('sci2026')).toBeNull()
  })

  it('짧은 암호는 거부한다', () => {
    expect(validateViewPassword('과학')).toContain('4자 이상')
    expect(validateViewPassword('')).toContain('4자 이상')
  })

  it('숫자만 쓸 때는 더 길게 요구한다 — 한 자리에 10가지뿐이라', () => {
    expect(validateViewPassword('1357')).toContain('6자 이상')
    expect(validateViewPassword('135792')).toBeNull()
  })

  it('공백이 든 암호는 거부한다 — 눈에 안 보여서 다시 못 넣는다', () => {
    expect(validateViewPassword('과학 시간표')).toContain('공백')
    expect(validateViewPassword(' 과학시간표')).toContain('앞뒤 공백')
  })

  it('같은 글자만 반복하는 암호는 거부한다', () => {
    expect(validateViewPassword('111111')).toContain('같은 글자')
    expect(validateViewPassword('aaaaaa')).toContain('같은 글자')
  })

  it('이어지는 숫자는 거부한다', () => {
    expect(validateViewPassword('123456')).toContain('이어지는 숫자')
    expect(validateViewPassword('987654')).toContain('이어지는 숫자')
  })

  it('수업 코드와 같은 암호는 거부한다 — 학생이 가장 먼저 넣어 본다', () => {
    expect(validateViewPassword('7F3K9Q', '7F3K9Q')).toContain('수업 코드')
    // 대소문자만 다른 것도 같은 값으로 본다
    expect(validateViewPassword('7f3k9q', '7F3K9Q')).toContain('수업 코드')
  })

  it('코드를 안 넘기면 코드 검사는 건너뛴다', () => {
    expect(validateViewPassword('7F3K9Q')).toBeNull()
  })
})
