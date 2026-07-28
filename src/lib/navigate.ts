import type { GradeResult } from './grade'
import type { Slide } from '../types/lesson'

function slideExists(slides: Slide[], id: string): boolean {
  return slides.some((s) => s.id === id)
}

/**
 * 분기 규칙이 하나도 안 맞을 때(또는 애초에 분기 설정이 없을 때) 쓰는 "보통 진행" 목적지.
 * 메인 슬라이드는 바로 뒤에 이어지는 보조 슬라이드(4-1, 4-2 …)들을 건너뛰고 다음 메인
 * 슬라이드로 간다 — 보조 슬라이드는 분기 규칙으로만 도달해야 하는 슬라이드이기 때문이다.
 * 보조 슬라이드 자신의 "보통 진행"은 배열상 바로 다음 슬라이드(다음 보조 슬라이드 또는
 * 그다음 메인 슬라이드)로 그대로 이어간다.
 */
function defaultFallback(slides: Slide[], index: number): string | null {
  let i = index + 1
  if (!slides[index].isSub) {
    while (i < slides.length && slides[i].isSub) i++
  }
  return i < slides.length ? slides[i].id : null
}

export interface BranchContext {
  /** 분기 트리거 문항의 채점 결과 (자동채점 불가 유형이면 null) */
  grade: GradeResult | null
  /** 분기 트리거 문항에 학생이 입력한 원본 답 값 (choice:옵션ID 규칙 판정용) */
  value: unknown
}

/**
 * 다음에 보여줄 슬라이드 id를 정한다. 분기 규칙을 순서대로 검사해 첫 번째로 맞는 규칙의
 * 목적지로 보내고, 아무 규칙도 안 맞으면 `default`(있으면), 그마저 없으면 "보통 진행"
 * 목적지로 간다. 목적지 슬라이드가 실제로 존재하지 않으면(교사가 슬라이드를 지운 경우 등)
 * "보통 진행" 목적지로 안전하게 대체한다.
 */
export function resolveNextSlideId(slides: Slide[], currentSlideId: string, branchContext?: BranchContext): string | null {
  const currentIndex = slides.findIndex((s) => s.id === currentSlideId)
  if (currentIndex === -1) return null
  const slide = slides[currentIndex]
  const fallback = defaultFallback(slides, currentIndex)

  if (!slide.branch) return fallback

  for (const rule of slide.branch.rules) {
    let matches = false
    if (rule.when === 'correct') matches = branchContext?.grade?.correct === true
    else if (rule.when === 'incorrect') matches = branchContext?.grade?.correct === false
    else if (rule.when.startsWith('choice:')) {
      const optionId = rule.when.slice('choice:'.length)
      const value = branchContext?.value
      matches = Array.isArray(value) ? value.includes(optionId) : value === optionId
    }
    if (matches) return slideExists(slides, rule.goTo) ? rule.goTo : fallback
  }

  if (slide.branch.default) return slideExists(slides, slide.branch.default) ? slide.branch.default : fallback
  return fallback
}

function branchEdges(slide: Slide, slides: Slide[], index: number): string[] {
  const edges = new Set<string>()
  const fallback = defaultFallback(slides, index)
  if (fallback) edges.add(fallback)
  if (slide.branch) {
    slide.branch.rules.forEach((r) => {
      if (slideExists(slides, r.goTo)) edges.add(r.goTo)
    })
    if (slide.branch.default && slideExists(slides, slide.branch.default)) edges.add(slide.branch.default)
  }
  return [...edges]
}

export interface BranchValidationResult {
  /** 첫 슬라이드에서 어떤 경로로도 도달할 수 없는 슬라이드 id 목록 (예: 분기 규칙을 안 걸어준 보조 슬라이드) */
  unreachableSlideIds: string[]
  /** 순환 분기에 포함된 슬라이드 id 목록 (무한 루프 위험 — 탈출 규칙이 있는지 교사가 확인해야 함) */
  cyclicSlideIds: string[]
}

/** 에디터에서 분기 설정을 검사해 "도달 불가 슬라이드"와 "순환 분기"를 찾는다 (docs/PLAN.md 10번 항목). */
export function validateBranchGraph(slides: Slide[]): BranchValidationResult {
  const adjacency = new Map<string, string[]>()
  slides.forEach((slide, i) => adjacency.set(slide.id, branchEdges(slide, slides, i)))

  const reachable = new Set<string>()
  if (slides.length > 0) {
    const queue = [slides[0].id]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (reachable.has(id)) continue
      reachable.add(id)
      for (const next of adjacency.get(id) ?? []) queue.push(next)
    }
  }
  const unreachableSlideIds = slides.map((s) => s.id).filter((id) => !reachable.has(id))

  const cyclicSlideIds = new Set<string>()
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function dfs(id: string, stack: string[]) {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id)
      stack.slice(cycleStart).forEach((s) => cyclicSlideIds.add(s))
      return
    }
    visiting.add(id)
    for (const next of adjacency.get(id) ?? []) dfs(next, [...stack, id])
    visiting.delete(id)
    visited.add(id)
  }
  slides.forEach((s) => dfs(s.id, []))

  return { unreachableSlideIds, cyclicSlideIds: [...cyclicSlideIds] }
}
