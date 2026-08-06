import { buildResultsGrid } from './xlsx'
import type { ResponseRecord } from '../api/types'
import type { Lesson } from '../types/lesson'

/**
 * .xlsx와 같은 내용을 CSV로도 내보낸다.
 *
 * 왜 둘 다 두나: 학교에서 쓰는 성적 처리 프로그램이나 구글 스프레드시트로 옮길 때 CSV만
 * 받는 곳이 있고, 반대로 셀 서식이 필요할 땐 xlsx가 편하다. 열 구성은 buildResultsGrid로
 * 공유해 두 파일이 갈라지지 않게 한다.
 */

/**
 * RFC 4180 인용 규칙: 쉼표·큰따옴표·줄바꿈이 들어 있으면 통째로 큰따옴표로 감싸고,
 * 안쪽 큰따옴표는 두 번 겹쳐 쓴다. 서답형 답안에 줄바꿈과 쉼표가 흔해서 반드시 필요하다.
 */
export function escapeCsvCell(value: string | number): string {
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(grid: (string | number)[][]): string {
  return grid.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
}

export function downloadResultsCsv(lesson: Lesson, records: ResponseRecord[]): void {
  // 앞의 BOM(﻿)이 없으면 엑셀이 CSV를 시스템 기본 인코딩으로 읽어 한글이 전부 깨진다.
  const csv = '﻿' + buildCsv(buildResultsGrid(lesson, records))
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lesson.title}_응답.csv`
  a.click()
  URL.revokeObjectURL(url)
}
