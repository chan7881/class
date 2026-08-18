import { describe, expect, it } from 'vitest'
import { digitsOnly, isNumericField, normalizeIdentity, normalizeIdentityValue, squashName } from './identity'

describe('학생 식별 정보 다듬기', () => {
  it('이름만 자유 입력이다', () => {
    expect(isNumericField('name')).toBe(false)
    for (const f of ['grade', 'klass', 'number']) expect(isNumericField(f)).toBe(true)
  })

  it('단위를 적어도 숫자만 남는다', () => {
    expect(digitsOnly('8반')).toBe('8')
    expect(digitsOnly('2학년 8반')).toBe('28')
    expect(digitsOnly('12번번')).toBe('12')
  })

  it('전각 숫자도 반각으로 받아 준다', () => {
    expect(digitsOnly('１２번')).toBe('12')
  })

  it('이름은 앞뒤뿐 아니라 가운데 공백도 없앤다', () => {
    expect(squashName('한현아 ')).toBe('한현아')
    expect(squashName(' 이유림')).toBe('이유림')
    expect(squashName('홍 길동')).toBe('홍길동')
    expect(squashName('김　서연')).toBe('김서연') // 전각 공백
    expect(squashName('박\t지은\n')).toBe('박지은')
  })

  it('칸마다 다른 규칙이 적용된다', () => {
    expect(normalizeIdentityValue('klass', '8반')).toBe('8')
    expect(normalizeIdentityValue('name', '한현아 ')).toBe('한현아')
  })

  it('식별 정보 전체를 한 번에 다듬는다', () => {
    expect(normalizeIdentity({ klass: '8반', number: '17번', name: '한현아 ' })).toEqual({ klass: '8', number: '17', name: '한현아' })
  })

  it('없는 칸은 undefined 로 그대로 둔다 — 빈 문자열로 만들지 않는다', () => {
    expect(normalizeIdentity({ klass: '8', grade: undefined })).toEqual({ klass: '8', grade: undefined })
  })
})
