import * as XLSX from 'xlsx'

/**
 * 교사가 차트 블록에 엑셀/CSV를 업로드해 데이터를 가져올 때만 쓰는 `XLSX.read` 예외 경로다.
 * `lib/xlsx.ts`에 남긴 "XLSX.read/readFile은 어디에도 쓰지 않는다"는 결정과 어긋나 보이지만,
 * 그 결정이 막으려던 위험(신뢰할 수 없는 파일을 파싱해 다른 사용자에게 영향이 번지는 것)과는
 * 성격이 다르다: 여기서 업로드하는 사람과 그 결과를 보는 사람이 같은 교사 본인의 브라우저
 * 세션이고, 파싱 결과는 곧바로 숫자/문자열 원시값 배열(ChartSpec.rows)로만 변환해 저장하며
 * 원본 파일이나 파싱 트리는 어디에도 보관·재파싱하지 않는다. 예외 근거는 docs/DECISIONS.md 참고.
 */

export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024 // 5MB

export class SpreadsheetTooLargeError extends Error {}
export class SpreadsheetParseError extends Error {}

/** 첫 시트를 원시 셀 값의 2차원 배열로 돌려준다(헤더 여부 판단은 호출부가 한다). */
export async function parseSpreadsheetFile(file: File): Promise<(string | number)[][]> {
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new SpreadsheetTooLargeError('파일이 너무 큽니다 (5MB 이하만 업로드할 수 있어요).')
  }
  const buffer = await file.arrayBuffer()
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch {
    throw new SpreadsheetParseError('엑셀/CSV 파일을 읽을 수 없습니다.')
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' })
  return grid.map((row) => row.map((cell) => (typeof cell === 'number' ? cell : String(cell))))
}
