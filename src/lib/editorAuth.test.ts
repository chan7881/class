import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearViewPassword,
  loadEditToken,
  loadViewPassword,
  looksLikeEditToken,
  saveLiveSecret,
} from './editorAuth'

/**
 * 진행 상황 화면의 열쇠를 **맞는 자리에** 저장하는지 검증한다.
 *
 * 왜 테스트가 필요한가: 이 판단이 홈 화면과 진행 상황 화면 두 곳에 흩어져 있던 탓에, 홈에서
 * 현황 암호를 넣으면 그 값이 *편집 키 자리*에 저장돼 서버가 조용히 거부하는 버그가 있었다
 * (2026-08-08 사용자 신고: "여전히 메인 화면에선 편집키를 넣으라고 안내한다").
 */

const EDIT_TOKEN = 'a'.repeat(64)

/**
 * 테스트는 node 환경에서 돌아 `localStorage`가 없다. jsdom을 끌어오는 대신 필요한 부분만
 * 흉내 낸다 — 이 파일이 쓰는 건 get/set/remove/clear 넷뿐이다.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  }
}
globalThis.localStorage = memoryStorage()
globalThis.sessionStorage = memoryStorage()

describe('looksLikeEditToken', () => {
  it('편집 키는 64자 16진수다', () => {
    expect(looksLikeEditToken(EDIT_TOKEN)) .toBe(true)
    expect(looksLikeEditToken('0123456789abcdef'.repeat(4))).toBe(true)
    expect(looksLikeEditToken('  ' + EDIT_TOKEN + '  ')).toBe(true) // 붙여넣기 공백은 무시
  })

  it('사람이 정한 암호는 편집 키로 보지 않는다', () => {
    expect(looksLikeEditToken('전기와자기')).toBe(false)
    expect(looksLikeEditToken('sci2026')).toBe(false)
    expect(looksLikeEditToken('a'.repeat(63))).toBe(false) // 한 글자 모자람
    expect(looksLikeEditToken('g'.repeat(64))).toBe(false) // 16진수가 아님
  })
})

describe('saveLiveSecret', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('편집 키 모양이면 편집 키 자리에 넣는다', () => {
    expect(saveLiveSecret('ABC123', EDIT_TOKEN)).toBe('editToken')
    expect(loadEditToken('ABC123')).toBe(EDIT_TOKEN)
    expect(loadViewPassword('ABC123')).toBeNull()
  })

  it('★ 그 외에는 현황 암호 자리에 넣는다 (편집 키 자리에 넣으면 서버가 거부한다)', () => {
    expect(saveLiveSecret('ABC123', '전기와자기')).toBe('viewPassword')
    expect(loadViewPassword('ABC123')).toBe('전기와자기')
    expect(loadEditToken('ABC123')).toBeNull()
  })

  it('remember를 끄면 탭을 닫을 때 사라지는 자리에 넣는다 (공용 PC)', () => {
    saveLiveSecret('ABC123', '전기와자기', false)
    expect(sessionStorage.getItem('class:live:viewPassword:ABC123')).toBe('전기와자기')
    expect(localStorage.getItem('class:live:viewPassword:ABC123')).toBeNull()
    // 그래도 읽기는 된다 — 저장 위치가 달라도 화면은 똑같이 동작해야 한다
    expect(loadViewPassword('ABC123')).toBe('전기와자기')
  })

  it('저장 위치를 바꾸면 예전 자리에 남아 있지 않는다', () => {
    saveLiveSecret('ABC123', '전기와자기', true)
    saveLiveSecret('ABC123', '전기와자기', false)
    expect(localStorage.getItem('class:live:viewPassword:ABC123')).toBeNull()

    saveLiveSecret('ABC123', '전기와자기', true)
    expect(sessionStorage.getItem('class:live:viewPassword:ABC123')).toBeNull()
  })

  it('앞뒤 공백은 떼고 저장한다', () => {
    saveLiveSecret('ABC123', '  전기와자기  ')
    expect(loadViewPassword('ABC123')).toBe('전기와자기')
  })

  it('지우면 양쪽 저장소에서 다 사라진다', () => {
    saveLiveSecret('ABC123', '전기와자기', true)
    saveLiveSecret('XYZ789', '전기와자기', false)
    clearViewPassword('ABC123')
    clearViewPassword('XYZ789')
    expect(loadViewPassword('ABC123')).toBeNull()
    expect(loadViewPassword('XYZ789')).toBeNull()
  })
})
