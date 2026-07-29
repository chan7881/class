import { describe, expect, it } from 'vitest'
import { matchKeywordGroups, parseKeywordGroups } from './keywordMatch'

describe('parseKeywordGroups', () => {
  it('쉼표로 구분한 단어는 각각 AND 그룹(대안 1개)이 된다', () => {
    expect(parseKeywordGroups('지진, 땅')).toEqual([['지진'], ['땅']])
  })
  it('괄호 안 쉼표는 OR 대안으로 한 그룹에 묶인다', () => {
    expect(parseKeywordGroups('지진,(흔들림, 떨림), 땅')).toEqual([['지진'], ['흔들림', '떨림'], ['땅']])
  })
  it('빈 문자열은 그룹이 없다', () => {
    expect(parseKeywordGroups('')).toEqual([])
    expect(parseKeywordGroups('   ')).toEqual([])
  })
  it('그룹이 하나뿐이어도 동작한다', () => {
    expect(parseKeywordGroups('미토콘드리아')).toEqual([['미토콘드리아']])
  })
})

describe('matchKeywordGroups', () => {
  const expr = '지진,(흔들림, 떨림), 땅'

  it('AND 그룹을 전부 만족하면(OR는 하나만) 모든 그룹이 매칭된다', () => {
    expect(matchKeywordGroups('지진이 나면 땅이 흔들림', expr)).toEqual({ totalGroups: 3, matchedGroups: 3 })
    expect(matchKeywordGroups('지진이 나면 땅이 떨림', expr)).toEqual({ totalGroups: 3, matchedGroups: 3 })
  })
  it('일부 그룹만 만족하면 그 개수만 매칭된다', () => {
    expect(matchKeywordGroups('지진이 났다', expr)).toEqual({ totalGroups: 3, matchedGroups: 1 })
  })
  it('공백·대소문자 차이는 정규화 후 비교한다', () => {
    expect(matchKeywordGroups('  지진  ', '지진')).toEqual({ totalGroups: 1, matchedGroups: 1 })
  })
})
