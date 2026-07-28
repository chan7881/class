/**
 * mock 백엔드(mock.ts)가 쓰는 최소 키-값 저장소 인터페이스.
 * 브라우저에서는 localStorage를 쓰고, localStorage가 없는 환경(Vitest 등)에서는
 * 메모리 Map으로 자동 대체한다 — jsdom 같은 무거운 의존성을 추가하지 않고도
 * mock.ts를 순수 함수처럼 테스트할 수 있게 하기 위함.
 */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** 주어진 접두사로 시작하는 키를 전부 반환한다 (예: 'responses:CODE:' 로 한 수업의 응답을 모을 때) */
  keysWithPrefix(prefix: string): string[]
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  keysWithPrefix(prefix: string): string[] {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix))
  }
}

class BrowserLocalStorageStore implements KeyValueStore {
  getItem(key: string): string | null {
    return localStorage.getItem(key)
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value)
  }

  removeItem(key: string): void {
    localStorage.removeItem(key)
  }

  keysWithPrefix(prefix: string): string[] {
    return Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  }
}

export function createDefaultStore(): KeyValueStore {
  if (typeof localStorage !== 'undefined') return new BrowserLocalStorageStore()
  return new MemoryStore()
}
