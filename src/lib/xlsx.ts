import * as XLSX from 'xlsx'
import { listQuestionsInLesson } from './findQuestion'
import { cellForAnswer } from './resultsStats'
import type { ResponseRecord } from '../api/types'
import type { IdentityField, Lesson } from '../types/lesson'

/**
 * 응답을 SheetJS(.xlsx)로 클라이언트에서 직접 생성한다 (docs/PLAN.md 「검증」·「교사 결과」 절).
 * xlsx 패키지는 두 건의 공개 취약점(프로토타입 오염·ReDoS)이 있지만 전부 `XLSX.read`류의
 * "신뢰할 수 없는 파일 파싱" 경로에만 해당한다 — 이 파일은 워크북을 새로 만들어 쓰기만
 * 하므로(`aoa_to_sheet`/`writeFile`) 해당 취약점의 영향을 받지 않는다(docs/DECISIONS.md 참고).
 * 이 프로젝트에서 XLSX.read/readFile은 어디에도 쓰지 않는다 — 앞으로도 쓰지 말 것.
 */

const IDENTITY_LABELS: Record<IdentityField, string> = { grade: '학년', klass: '반', number: '번호', name: '이름' }

/**
 * 응답을 헤더 한 줄 + 학생 한 줄씩의 2차원 배열로 만든다.
 * .xlsx와 .csv 내보내기가 이걸 공유한다 — 두 파일의 열 구성이 갈라지면
 * "엑셀로 받은 것과 CSV로 받은 것이 다르다"는 혼란이 생긴다.
 */
export function buildResultsGrid(lesson: Lesson, records: ResponseRecord[]): (string | number)[][] {
  const questions = listQuestionsInLesson(lesson)
  const real = records.filter((r) => !r.isTest)
  const idFields = lesson.settings.identityFields

  const header = [
    ...idFields.map((f) => IDENTITY_LABELS[f]),
    '시작시각',
    '제출시각',
    '진행경로',
    ...questions.flatMap((_, i) => [`Q${i + 1}_답`, `Q${i + 1}_정오`, `Q${i + 1}_점수`]),
  ]

  const rows = real.map((r) => [
    ...idFields.map((f) => r.identity[f] ?? ''),
    r.startedAt,
    r.submittedAt ?? '',
    r.path.join(','),
    ...questions.flatMap((q) => {
      const value = r.answers[q.id]
      const score = r.scores[q.id]
      return [
        value === undefined ? '' : cellForAnswer(q, value),
        score === undefined ? '' : score.correct ? 'O' : 'X',
        score === undefined ? '' : score.points,
      ]
    }),
  ])

  return [header, ...rows]
}

export function buildResultsWorkbook(lesson: Lesson, records: ResponseRecord[]): XLSX.WorkBook {
  const sheet = XLSX.utils.aoa_to_sheet(buildResultsGrid(lesson, records))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '응답')
  return workbook
}

export function downloadResultsXlsx(lesson: Lesson, records: ResponseRecord[]): void {
  const workbook = buildResultsWorkbook(lesson, records)
  XLSX.writeFile(workbook, `${lesson.title}_응답.xlsx`)
}
