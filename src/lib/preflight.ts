import { getQuestionDefinition } from '../blocks/questions/registry'
import type { Lesson, Slide } from '../types/lesson'
import { isEmbedUrlAllowed } from './embedHosts'
import { validateBranchGraph } from './navigate'
import { computeSlideNumbers } from './numbering'

/**
 * 발행 직전에 "학생이 들어갔을 때 깨질 만한 것"을 훑는다.
 *
 * 왜 필요한가: 학습지를 만들다 보면 이미지 자리만 잡아두거나(src 비움), 임베드 주소를 나중에
 * 채우려다 잊거나, 보기를 만들고 정답 지정을 빠뜨리는 일이 흔하다. 그런데 이런 건 교사가
 * 편집 화면에서 볼 땐 티가 안 나고 학생이 들어가서야 드러난다 — 수업 중에 발견하면 늦다.
 *
 * severity 구분:
 *   - 'error': 학생 화면이 실제로 비거나 잘못 채점된다. 발행을 막지는 않되(교사가 일부러
 *     반쯤 만든 상태로 나눠주는 경우가 있다) 눈에 띄게 보여준다.
 *   - 'warn': 의도적일 수도 있는 것(빈 슬라이드, 배점 0 …).
 *
 * 순수 함수다 — UI는 이 결과를 목록으로 그리기만 한다.
 */

export type PreflightSeverity = 'error' | 'warn'

export interface PreflightIssue {
  severity: PreflightSeverity
  /** 문제 설명. 어디를 고쳐야 하는지가 문장 안에 드러나야 한다 */
  message: string
  /** 해당 슬라이드가 있으면 화면에 붙일 번호(1, 4-2 …). 수업 전체 문제면 없음 */
  slideNumber?: string
  slideId?: string
}

/** 리치텍스트 HTML에 실제로 읽을 내용이 있는지 — 태그만 남은 빈 <p></p>를 걸러낸다 */
function hasText(html: string | undefined): boolean {
  if (!html) return false
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim().length > 0
}

function checkBlocks(slide: Slide, slideNumber: string, push: (issue: PreflightIssue) => void) {
  const at = { slideNumber, slideId: slide.id }

  for (const block of slide.blocks) {
    switch (block.type) {
      case 'image':
        if (!block.src.trim()) push({ severity: 'error', message: '이미지 블록에 사진이 없어요 (자리만 잡아둔 상태)', ...at })
        else if (!block.alt.trim()) push({ severity: 'warn', message: '이미지에 대체 텍스트가 없어요 (사진이 안 뜨거나 화면을 읽어주는 경우 설명이 사라져요)', ...at })
        break

      case 'video':
        if (!block.url.trim()) push({ severity: 'error', message: '동영상 블록에 주소가 없어요', ...at })
        break

      case 'embed':
        if ((block.source ?? 'url') === 'file') {
          if (!(block.html ?? '').trim()) push({ severity: 'error', message: '임베드 블록에 업로드된 HTML이 없어요', ...at })
        } else if (!block.url.trim()) {
          push({ severity: 'error', message: '임베드 블록에 주소가 없어요', ...at })
        } else if (!isEmbedUrlAllowed(block.url)) {
          push({ severity: 'error', message: `임베드 주소가 허용 목록에 없어 학생 화면에서 안 떠요: ${block.url}`, ...at })
        }
        break

      case 'text':
      case 'heading':
      case 'callout':
        if (!hasText(block.html)) push({ severity: 'warn', message: `내용이 비어 있는 ${block.type === 'heading' ? '제목' : block.type === 'callout' ? '강조' : '텍스트'} 블록이 있어요`, ...at })
        break

      case 'chart':
        if (block.spec.rows.length === 0) push({ severity: 'warn', message: '차트 블록에 데이터가 없어요', ...at })
        break

      case 'question': {
        const q = block.q
        const label = getQuestionDefinition(q.kind)?.label ?? q.kind
        if (!hasText(q.prompt)) push({ severity: 'error', message: `${label} 문항의 지문이 비어 있어요`, ...at })
        const authoring = getQuestionDefinition(q.kind)?.checkAuthoring?.(q)
        if (authoring) push({ severity: 'error', message: `${label} 문항: ${authoring}`, ...at })
        if (q.points === 0) push({ severity: 'warn', message: `${label} 문항의 배점이 0점이에요`, ...at })
        break
      }

      case 'poeGroup':
      case 'divider':
        break
    }
  }
}

export function preflightLesson(lesson: Lesson): PreflightIssue[] {
  const issues: PreflightIssue[] = []
  const push = (issue: PreflightIssue) => issues.push(issue)
  const numbers = computeSlideNumbers(lesson.slides)

  // ── 수업 전체 ──
  if (!lesson.title.trim()) push({ severity: 'error', message: '수업 제목이 비어 있어요' })
  if (lesson.settings.identityFields.length === 0) {
    push({ severity: 'error', message: '학생 식별 필드가 하나도 없어요 — 누가 낸 답인지 구분할 수 없어요' })
  }
  if (lesson.slides.length === 0) push({ severity: 'error', message: '슬라이드가 하나도 없어요' })

  const questionIds = new Set<string>()
  let questionCount = 0
  for (const slide of lesson.slides) {
    for (const block of slide.blocks) {
      if (block.type !== 'question') continue
      questionCount++
      // 복사·붙여넣기나 가져오기 과정에서 id가 겹치면 한 답이 두 문항에 저장되는 것처럼 보인다
      if (questionIds.has(block.q.id)) push({ severity: 'error', message: `문항 번호(id)가 겹쳐요: ${block.q.id} — 답안이 서로 덮어써져요` })
      questionIds.add(block.q.id)
    }
  }
  if (questionCount === 0) push({ severity: 'warn', message: '문항이 하나도 없어요 — 학생 응답이 저장되지 않아요' })

  // ── 슬라이드별 ──
  lesson.slides.forEach((slide, i) => {
    const slideNumber = numbers[i]
    if (slide.blocks.length === 0) push({ severity: 'warn', message: '빈 슬라이드예요', slideNumber, slideId: slide.id })
    checkBlocks(slide, slideNumber, push)
  })

  // ── 분기 ──
  const branch = validateBranchGraph(lesson.slides)
  const numberOf = (id: string) => numbers[lesson.slides.findIndex((s) => s.id === id)] ?? id
  for (const id of branch.unreachableSlideIds) {
    push({ severity: 'warn', message: '이 슬라이드로 가는 분기 규칙이 없어 학생이 도달할 수 없어요', slideNumber: numberOf(id), slideId: id })
  }
  for (const id of branch.cyclicSlideIds) {
    push({ severity: 'warn', message: '순환 분기에 포함돼 있어요 — 빠져나가는 규칙이 있는지 확인하세요', slideNumber: numberOf(id), slideId: id })
  }

  return issues
}

export function countBySeverity(issues: PreflightIssue[]): Record<PreflightSeverity, number> {
  return {
    error: issues.filter((i) => i.severity === 'error').length,
    warn: issues.filter((i) => i.severity === 'warn').length,
  }
}
