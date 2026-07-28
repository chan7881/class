import DOMPurify from 'dompurify'

/**
 * 교사가 저장한 리치텍스트 HTML을 학생 화면에 렌더링하기 전에 반드시 거친다.
 * TipTap 자체는 안전한 HTML만 만들지만, 저장 API(mock.saveLesson, 훗날 Apps Script)를
 * 우회해 직접 조작된 값이 들어올 수 있으므로 렌더링 시점에도 한 번 더 막는다
 * (CLAUDE.md "보안 취약점을 만들지 않는다" 원칙 — XSS 방어를 저장이 아닌 렌더링 경로에 둔다).
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'span', 'sub', 'sup',
      'ul', 'ol', 'li', 'mark', 'code',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  })
}
