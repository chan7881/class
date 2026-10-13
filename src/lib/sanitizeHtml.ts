import DOMPurify from 'dompurify'
import { adaptTextColor } from './richTextColor'

/**
 * 교사가 저장한 리치텍스트 HTML을 학생 화면에 렌더링하기 전에 반드시 거친다.
 * TipTap 자체는 안전한 HTML만 만들지만, 저장 API(mock.saveLesson, 훗날 Apps Script)를
 * 우회해 직접 조작된 값이 들어올 수 있으므로 렌더링 시점에도 한 번 더 막는다
 * (CLAUDE.md "보안 취약점을 만들지 않는다" 원칙 — XSS 방어를 저장이 아닌 렌더링 경로에 둔다).
 *
 * 여기서 다크모드 대응도 같이 한다: 저장된 HTML에 박혀 있는 글자색은 토큰이 아니라 값 그대로라
 * 다크모드에서 배경과 같은 색이 되어 안 보일 수 있다. `lib/richTextColor.ts`의 규칙에 따라
 * 그런 색만 토큰으로 바꿔 끼운다(자세한 이유는 그 파일 주석 참고).
 */
/*
 * 같은 입력은 같은 결과라 기억해 둔다 (2026-10-13).
 * 학생 화면은 글자 하나 칠 때마다 슬라이드 전체를 다시 그리는데, 그때마다 지문·안내문 전부를
 * DOMPurify 로 다시 파싱했다 — 블록이 많은 슬라이드에서 저사양 폰의 입력이 끊기는 원인이 된다.
 * 결과는 입력 문자열에만 달려 있다(`adaptTextColor` 도 순수 함수). 편집 중 계속 바뀌는 값이
 * 쌓이지 않게 개수를 묶는다.
 */
const CACHE_LIMIT = 500
const cache = new Map<string, string>()

export function sanitizeHtml(html: string): string {
  const hit = cache.get(html)
  if (hit !== undefined) return hit
  const out = sanitizeUncached(html)
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(html, out)
  return out
}

function sanitizeUncached(html: string): string {
  const root = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'span', 'sub', 'sup',
      'ul', 'ol', 'li', 'mark', 'code',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    // 문자열 대신 DOM으로 받아 색만 손보고 다시 직렬화한다 — 정규식으로 style 속성을
    // 헤집는 것보다 안전하고, 이미 정화된 트리라 여기서 새 위험이 들어올 여지가 없다.
    RETURN_DOM_FRAGMENT: true,
  }) as unknown as DocumentFragment

  for (const el of root.querySelectorAll<HTMLElement>('[style]')) {
    const color = el.style.color
    if (!color) continue
    const adapted = adaptTextColor(color)
    if (adapted !== color) el.style.color = adapted
  }

  const wrapper = document.createElement('div')
  wrapper.appendChild(root)
  return wrapper.innerHTML
}
