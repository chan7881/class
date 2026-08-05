/**
 * URL 임베드 블록(EmbedBlock)이 iframe으로 띄우는 걸 허용하는 도메인 목록 — 임의 사이트를
 * 통째로 iframe에 넣으면 안 되므로(피싱·클릭재킹 위험) 화이트리스트만 허용한다.
 * 여기 없는 사이트는 대부분 X-Frame-Options/CSP frame-ancestors로 프레임 삽입 자체를
 * 막아두고 있어(그 사이트의 정책이라 우리 쪽에서 우회할 수 없음), 목록에 넣어봐야 안 뜬다 —
 * 그래서 "실제로 뜨는 걸 확인한 사이트"만 추가한다(2026-07-30 조사, docs/DECISIONS.md 참고).
 */
export const EMBED_ALLOWED_HOSTS = [
  'geogebra.org',
  'www.geogebra.org',
  'phet.colorado.edu',
  'www.desmos.com',
  'scratch.mit.edu',
  'codap.concord.org',
  'netlogoweb.org',
  'observablehq.com',
  'codepen.io',
  'glitch.me',
  'mw.concord.org',
  'chan7881.github.io', // 전기회로 실험실(circuit) 등 우리가 직접 만들어 올린 정적 시뮬레이터
]

/** 교사가 URL 입력칸 위에서 볼 안내 목록 — 사이트명과 "일반 링크 그대로 되는지 vs 별도 임베드
 *  링크가 필요한지"를 같이 보여준다. */
export const EMBED_SITE_HINTS: { name: string; note: string }[] = [
  { name: 'PhET(phet.colorado.edu)', note: '시뮬레이션 실행 페이지 링크를 그대로 붙여넣으면 됩니다' },
  { name: 'GeoGebra(geogebra.org)', note: '자료의 공유 메뉴에 있는 "포함(embed)" 링크를 쓰세요' },
  { name: 'Desmos(desmos.com)', note: '계산기 화면의 공유 링크' },
  { name: 'Scratch(scratch.mit.edu)', note: '프로젝트 페이지의 "Embed" 버튼으로 받는 링크' },
  { name: 'CODAP(codap.concord.org)', note: '데이터 분석 — 공유 링크' },
  { name: 'Observable(observablehq.com)', note: '노트북의 임베드 빌더에서 받는 링크' },
  { name: 'CodePen(codepen.io) · Glitch(glitch.me)', note: '직접 만든 HTML/JS 시뮬레이션을 올려두고 이 링크를 붙여넣으면, 파일 업로드 없이도 커스텀 시뮬레이션을 쓸 수 있어요' },
  { name: '전기회로 실험실(chan7881.github.io/circuit)', note: '전지·전구·저항·전류계·전압계 회로 시뮬레이터 — 주소를 그대로 붙여넣으면 됩니다' },
]

export function isEmbedUrlAllowed(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url)
    return protocol === 'https:' && EMBED_ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}
