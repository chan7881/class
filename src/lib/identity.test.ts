import { describe, expect, it } from 'vitest'
import { digitsOnly, identitySignature, normalizeIdentity, squashName } from './identity'
import { computeStudentKey } from './studentKey'

describe('digitsOnly', () => {
  it('숫자만 남기고 전각도 받아 준다', () => {
    expect(digitsOnly('8반')).toBe('8')
    expect(digitsOnly('2학년 8반')).toBe('28')
    expect(digitsOnly('１２')).toBe('12')
  })
  // 03 과 3 이 다른 행이 되던 문제 (2026-08-19)
  it('앞자리 0을 없앤다 — 다만 0 자체는 남긴다', () => {
    expect(digitsOnly('03')).toBe('3')
    expect(digitsOnly('003')).toBe('3')
    expect(digitsOnly('10')).toBe('10')
    expect(digitsOnly('0')).toBe('0')
    expect(digitsOnly('00')).toBe('0')
    expect(digitsOnly('')).toBe('')
  })
})

describe('squashName', () => {
  it('가운데 공백까지 전부 없앤다', () => {
    expect(squashName(' 고 승현 ')).toBe('고승현')
    expect(squashName('고　승현')).toBe('고승현')
  })
  // 화면에는 똑같이 보이는데 문자열이 달라 행이 갈리던 문제 (2026-08-19)
  it('조합형(NFD)을 완성형(NFC)으로 맞춘다', () => {
    const nfd = '고승현'.normalize('NFD')
    expect(nfd).not.toBe('고승현')
    expect(squashName(nfd)).toBe('고승현')
  })
})

describe('identitySignature', () => {
  const canonical = { grade: '1', klass: '1', number: '3', name: '고승현' }
  // 「기기가 바뀌어도 학년·반·번호·이름이 같으면 이어서 푼다」는 요구를 고정한다
  it.each([
    ['옛 화면이 보낸 단위 포함', { grade: '1학년', klass: '1반', number: '3번', name: '고승현' }],
    ['앞자리 0', { grade: '01', klass: '01', number: '03', name: '고승현' }],
    ['이름 가운데 공백', { grade: '1', klass: '1', number: '3', name: '고 승현' }],
    ['조합형 이름', { grade: '1', klass: '1', number: '3', name: '고승현'.normalize('NFD') }],
    ['전각 숫자', { grade: '１', klass: '１', number: '３', name: '고승현' }],
  ])('%s 도 같은 학생으로 본다', (_label, variant) => {
    expect(identitySignature(variant)).toBe(identitySignature(canonical))
  })

  it('다른 학생은 갈라 놓는다', () => {
    expect(identitySignature({ ...canonical, number: '4' })).not.toBe(identitySignature(canonical))
    expect(identitySignature({ ...canonical, klass: '2' })).not.toBe(identitySignature(canonical))
    expect(identitySignature({ ...canonical, name: '고승헌' })).not.toBe(identitySignature(canonical))
  })

  it('없는 칸은 빈 값으로 두되 자리는 지킨다 — 이름만 쓰는 수업도 갈라지지 않게', () => {
    expect(identitySignature({ name: '고승현' })).toBe(':::고승현')
  })
})

describe('computeStudentKey', () => {
  it('다듬어서 같아지는 식별정보는 같은 열쇠가 된다', async () => {
    const a = await computeStudentKey('F6YZ6C', { klass: '1반', number: '03', name: '고 승현' })
    const b = await computeStudentKey('F6YZ6C', { klass: '1', number: '3', name: '고승현' })
    expect(a).toBe(b)
  })
  it('수업이 다르면 열쇠도 다르다', async () => {
    const a = await computeStudentKey('AAAAAA', { klass: '1', number: '3', name: '고승현' })
    const b = await computeStudentKey('BBBBBB', { klass: '1', number: '3', name: '고승현' })
    expect(a).not.toBe(b)
  })
})

describe('normalizeIdentity', () => {
  it('없는 칸은 undefined 그대로 둔다', () => {
    expect(normalizeIdentity({ name: '고 승현', klass: undefined })).toEqual({ name: '고승현', klass: undefined })
  })
})
