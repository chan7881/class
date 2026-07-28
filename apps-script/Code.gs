/**
 * 인터랙티브 수업 도구 — Apps Script 백엔드 (6~7단계)
 *
 * 단일 doPost 라우터. docs/PLAN.md 「Apps Script API」 표, src/api/types.ts의
 * ApiClient 인터페이스, src/api/mock.ts의 동작을 그대로 따른다 — mock과 이 파일
 * 둘 다 같은 계약을 만족해야 VITE_API_MODE를 mock↔live로 바꿔도 호출부가 안 바뀐다.
 *
 * 요청은 반드시 { action: string, payload: object } 형태의 JSON을
 * Content-Type: text/plain으로 보내야 한다 (CORS preflight 회피 — docs/PLAN.md 참고).
 * 응답은 항상 HTTP 200 + { ok: true, data } 또는 { ok: false, error }.
 *
 * ⚠️ mock.ts와 마찬가지로 채점 로직(gradeQuestion 이하)은 프런트엔드 src/blocks/questions/*
 *   가 등록하는 채점기를 그대로 옮겨 적은 것이다 — 새 문항 유형을 추가하면(7~8단계)
 *   반드시 이 파일에도 gradeXxx 함수와 GRADERS 매핑을 추가해야 한다. 두 언어(TS/GAS)
 *   사이라 자동으로 동기화되지 않는다.
 */

// ── 라우터 ────────────────────────────────────────────────────────────

const ACTIONS = {
  createLesson,
  getLesson,
  getLessonForEdit,
  saveLesson,
  publishLesson,
  deleteLesson,
  uploadMedia,
  uploadStudentMedia,
  saveProgress,
  getProgress,
  gradeAnswer,
  submitResponse,
  getResults,
  getAggregate,
}

/** 배포 URL을 브라우저 주소창에 직접 열어봤을 때 응답하는 간단한 상태 확인용 (앱은 doPost만 쓴다). */
function doGet() {
  return jsonOutput({ ok: true, data: { status: 'InteractiveClass 백엔드가 정상 동작 중입니다.' } })
}

function doPost(e) {
  let body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return jsonOutput({ ok: false, error: '잘못된 요청 형식입니다' })
  }

  const handler = ACTIONS[body.action]
  if (!handler) return jsonOutput({ ok: false, error: '알 수 없는 action: ' + body.action })

  try {
    const data = handler(body.payload || {})
    return jsonOutput({ ok: true, data: data === undefined ? null : data })
  } catch (err) {
    return jsonOutput({ ok: false, error: (err && err.message) || String(err) })
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

function withLock(fn) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// ── 공용 유틸 ─────────────────────────────────────────────────────────

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ' // I,O,L,0,1 제외 (docs/PLAN.md)

function generateLessonCode() {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length))
  return code
}

/** UUID 두 개를 이어 붙여 256비트급 무작위 문자열을 만든다 (Math.random보다 안전). */
function generateEditToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
}

function sha256Hex(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8)
  return bytes
    .map((b) => {
      const v = b < 0 ? b + 256 : b
      return ('0' + v.toString(16)).slice(-2)
    })
    .join('')
}

function nowIso() {
  return new Date().toISOString()
}

class ApiError extends Error {}

// ── Drive 폴더 구조 ───────────────────────────────────────────────────

const ROOT_FOLDER_NAME = 'InteractiveClass'

function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

/** getOrCreateFolder와 달리 없으면 만들지 않고 null을 준다 — deleteLesson처럼 "있으면 지운다"에 쓴다. */
function findFolder(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : null
}

function getRootFolder() {
  const it = DriveApp.getFoldersByName(ROOT_FOLDER_NAME)
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER_NAME)
}

function getLessonsFolder() {
  return getOrCreateFolder(getRootFolder(), 'lessons')
}
function getMediaFolder(code) {
  return getOrCreateFolder(getOrCreateFolder(getRootFolder(), 'media'), code)
}
function getUploadsFolder(code) {
  return getOrCreateFolder(getOrCreateFolder(getRootFolder(), 'uploads'), code)
}
function getResponsesFolder() {
  return getOrCreateFolder(getRootFolder(), 'responses')
}

// ── _index 스프레드시트: code -> editTokenHash / 응답 스프레드시트 ID ────

function getIndexSheet() {
  const root = getRootFolder()
  const it = root.getFilesByName('_index')
  if (it.hasNext()) return SpreadsheetApp.open(it.next())
  const ss = SpreadsheetApp.create('_index')
  ss.getActiveSheet().setName('index').appendRow(['code', 'editTokenHash', 'responseSpreadsheetId', 'createdAt'])
  DriveApp.getFileById(ss.getId()).moveTo(root)
  return ss
}

function findIndexRowIndex(sheet, code) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === code) return i + 1 // 1-based row
  }
  return -1
}

function findIndexRow(code) {
  const sheet = getIndexSheet().getSheetByName('index')
  const rowIndex = findIndexRowIndex(sheet, code)
  if (rowIndex === -1) return null
  const row = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0]
  return { rowIndex, code: row[0], editTokenHash: row[1], responseSpreadsheetId: row[2] }
}

function requireEditToken(code, editToken) {
  const idx = findIndexRow(code)
  if (!idx) throw new ApiError('존재하지 않는 수업 코드입니다: ' + code)
  if (idx.editTokenHash !== sha256Hex(editToken)) throw new ApiError('편집 권한이 없습니다 (editToken 불일치)')
  return idx
}

function updateIndexResponseSheetId(code, spreadsheetId) {
  const sheet = getIndexSheet().getSheetByName('index')
  const rowIndex = findIndexRowIndex(sheet, code)
  if (rowIndex !== -1) sheet.getRange(rowIndex, 3).setValue(spreadsheetId)
}

function removeIndexRow(code) {
  const sheet = getIndexSheet().getSheetByName('index')
  const rowIndex = findIndexRowIndex(sheet, code)
  if (rowIndex !== -1) sheet.deleteRow(rowIndex)
}

// ── 수업 JSON (Drive 파일) ────────────────────────────────────────────

function findLessonFile(code) {
  const it = getLessonsFolder().getFilesByName(code + '.json')
  return it.hasNext() ? it.next() : null
}

function readLesson(code) {
  const file = findLessonFile(code)
  if (!file) throw new ApiError('존재하지 않는 수업 코드입니다: ' + code)
  return JSON.parse(file.getBlob().getDataAsString())
}

function writeLesson(code, lesson) {
  const content = JSON.stringify(lesson)
  const file = findLessonFile(code)
  if (file) file.setContent(content)
  else getLessonsFolder().createFile(code + '.json', content, MimeType.PLAIN_TEXT)
}

// ── 정답 제거 (학생용 getLesson) ──────────────────────────────────────

function stripAnswers(lesson) {
  const clone = JSON.parse(JSON.stringify(lesson))
  clone.slides.forEach((slide) => {
    slide.blocks.forEach((block) => {
      if (block.type === 'question') stripQuestionAnswer(block.q)
    })
  })
  return clone
}

function stripQuestionAnswer(q) {
  delete q.explanation
  if (q.kind === 'cloze') {
    q.segments.forEach((seg) => {
      if (seg.t === 'blank') delete seg.answer
    })
  } else if (q.kind === 'dataTable') {
    delete q.answerTargets
  } else {
    delete q.answer
  }
}

// ── 채점 (src/blocks/questions/*.tsx의 grade와 반드시 같은 로직을 유지할 것) ──

function normalizeAnswerText(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function sameSet(a, b) {
  if (a.length !== b.length) return false
  const setB = {}
  b.forEach((x) => (setB[x] = true))
  return a.every((x) => setB[x])
}

function gradeChoice(question, value) {
  const given = Array.isArray(value) ? value : []
  const correct = sameSet(given, question.answer || [])
  return { correct, points: correct ? question.points : 0 }
}

function gradeShort(question, value) {
  const given = normalizeAnswerText(typeof value === 'string' ? value : '')
  const answers = (question.answer || []).map(normalizeAnswerText)
  const correct =
    answers.length > 0 &&
    given.length > 0 &&
    (question.matchMode === 'contains' ? answers.some((a) => given.indexOf(a) !== -1) : answers.indexOf(given) !== -1)
  return { correct, points: correct ? question.points : 0 }
}

function gradeCloze(question, value) {
  const values = Array.isArray(value) ? value : []
  const blanks = question.segments.filter((s) => s.t === 'blank')
  const correct =
    blanks.length > 0 &&
    blanks.every((blank, i) => {
      const given = normalizeAnswerText(values[i] || '')
      const accepted = (blank.answer || []).map(normalizeAnswerText)
      return accepted.length > 0 && accepted.indexOf(given) !== -1
    })
  return { correct, points: correct ? question.points : 0 }
}

function gradeCombo(question, value) {
  const correct = typeof value === 'string' && value.length > 0 && value === question.answer
  return { correct, points: correct ? question.points : 0 }
}

function gradeOrder(question, value) {
  const given = Array.isArray(value) ? value : []
  const answer = question.answer || []
  const correct = given.length === answer.length && given.every((id, i) => id === answer[i])
  return { correct, points: correct ? question.points : 0 }
}

function gradeMatch(question, value) {
  const given = Array.isArray(value) ? value : []
  const answer = question.answer || []
  const correct = given.length === answer.length && answer.every((pair) => given.some((g) => g[0] === pair[0] && g[1] === pair[1]))
  return { correct, points: correct ? question.points : 0 }
}

// ── numeric 채점 (src/lib/units.ts, sigfigs.ts, numericInput.ts와 동일 로직) ──

const UNIT_TABLE = {
  m: { base: 'm', factor: 1 }, km: { base: 'm', factor: 1000 }, cm: { base: 'm', factor: 0.01 }, mm: { base: 'm', factor: 0.001 },
  s: { base: 's', factor: 1 }, ms: { base: 's', factor: 0.001 }, min: { base: 's', factor: 60 }, h: { base: 's', factor: 3600 },
  kg: { base: 'kg', factor: 1 }, g: { base: 'kg', factor: 0.001 }, mg: { base: 'kg', factor: 1e-6 },
  N: { base: 'N', factor: 1 }, J: { base: 'J', factor: 1 }, kJ: { base: 'J', factor: 1000 }, cal: { base: 'J', factor: 4.184 }, kcal: { base: 'J', factor: 4184 },
  W: { base: 'W', factor: 1 }, kW: { base: 'W', factor: 1000 }, Pa: { base: 'Pa', factor: 1 }, kPa: { base: 'Pa', factor: 1000 }, atm: { base: 'Pa', factor: 101325 },
  V: { base: 'V', factor: 1 }, A: { base: 'A', factor: 1 }, C: { base: 'C', factor: 1 }, ohm: { base: 'ohm', factor: 1 }, 'Ω': { base: 'ohm', factor: 1 }, Hz: { base: 'Hz', factor: 1 },
  L: { base: 'L', factor: 1 }, mL: { base: 'L', factor: 0.001 }, mol: { base: 'mol', factor: 1 }, 'mol/L': { base: 'mol/L', factor: 1 }, M: { base: 'mol/L', factor: 1 },
  K: { base: 'K', factor: 1 }, '°C': { base: '°C', factor: 1 }, '℃': { base: '°C', factor: 1 },
  'm/s': { base: 'm/s', factor: 1 }, 'km/h': { base: 'm/s', factor: 1 / 3.6 },
  'm/s^2': { base: 'm/s^2', factor: 1 }, 'm/s²': { base: 'm/s^2', factor: 1 },
  'g/mL': { base: 'g/mL', factor: 1 }, 'g/cm^3': { base: 'g/mL', factor: 1 }, 'g/cm³': { base: 'g/mL', factor: 1 },
  'kg/m^3': { base: 'g/mL', factor: 0.001 }, 'kg/m³': { base: 'g/mL', factor: 0.001 },
}

function normalizeUnitString(raw) {
  return (raw == null ? '' : raw).trim()
}
function lookupUnit(raw) {
  const key = normalizeUnitString(raw)
  return key ? UNIT_TABLE[key] || null : null
}
function unitsAreCompatible(a, b) {
  const ea = lookupUnit(a)
  const eb = lookupUnit(b)
  return !!ea && !!eb && ea.base === eb.base
}
function toBaseValue(value, unit) {
  const entry = lookupUnit(unit)
  return entry ? value * entry.factor : null
}

function countSigFigs(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const normalized = trimmed.replace(/[×xX]\s*10\s*\^?/, 'e').replace(/e\+/, 'e')
  const mantissa = normalized.split(/e/i)[0].replace(/^[-+]/, '')
  if (!/\d/.test(mantissa)) return 0
  if (mantissa.indexOf('.') !== -1) {
    const parts = mantissa.split('.')
    const intPart = parts[0]
    const fracPart = parts[1] || ''
    const intDigits = intPart.replace(/^0+/, '')
    if (intDigits) return intDigits.length + fracPart.length
    const sigFrac = fracPart.replace(/^0+/, '')
    return sigFrac.length || 1
  }
  const stripped = mantissa.replace(/^0+/, '').replace(/0+$/, '')
  return stripped.length || 1
}

function parseNumericInput(raw) {
  const cleaned = raw.trim().replace(/,/g, '').replace(/[×xX]\s*10\s*\^?/, 'e').replace(/e\+/, 'e')
  if (!cleaned) return null
  const num = Number(cleaned)
  return isFinite(num) ? num : null
}

function withinTolerance(given, answer, tolerance) {
  if (!tolerance) return given === answer
  const allowed = tolerance.mode === 'pct' ? Math.abs(answer) * (tolerance.value / 100) : tolerance.value
  return Math.abs(given - answer) <= allowed
}

function gradeNumeric(question, value) {
  const input = value
  if (!input || question.answer === undefined) return { correct: false, points: 0 }

  const parsed = parseNumericInput(input.raw || '')
  if (parsed === null) return { correct: false, points: 0 }

  if (question.sigFigs !== undefined && countSigFigs(input.raw || '') !== question.sigFigs) {
    return { correct: false, points: 0 }
  }

  let comparisonValue = parsed
  let comparisonAnswer = question.answer

  if (question.unitMode === 'required') {
    if (normalizeUnitString(input.unit) !== normalizeUnitString(question.unit)) return { correct: false, points: 0 }
  } else if (question.unitMode === 'convertible') {
    if (!unitsAreCompatible(input.unit, question.unit)) return { correct: false, points: 0 }
    const givenBase = toBaseValue(parsed, input.unit)
    const answerBase = toBaseValue(question.answer, question.unit)
    if (givenBase === null || answerBase === null) return { correct: false, points: 0 }
    comparisonValue = givenBase
    comparisonAnswer = answerBase
  }

  const correct = withinTolerance(comparisonValue, comparisonAnswer, question.tolerance)
  return { correct, points: correct ? question.points : 0 }
}

// ── chem 채점 (src/lib/chemNormalize.ts와 동일 로직) ──

const CHEM_SUBSCRIPT_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const CHEM_SUPERSCRIPT_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' }

function normalizeChemFormula(raw) {
  let s = raw.trim().replace(/\s+/g, '')
  s = s.replace(/<-->|<->/g, '⇌').replace(/-->|->/g, '→')
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => CHEM_SUBSCRIPT_MAP[c] || c)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, (c) => CHEM_SUPERSCRIPT_MAP[c] || c)
  s = s.replace(/(^|\+)1(?=[A-Za-z(])/g, '$1')
  return s
}

function chemFormulasMatch(raw, accepted) {
  const normalized = normalizeChemFormula(raw)
  return accepted.some((acc) => normalizeChemFormula(acc) === normalized)
}

function gradeChem(question, value) {
  const given = typeof value === 'string' ? value : ''
  const correct = given.trim().length > 0 && chemFormulasMatch(given, question.answer || [])
  return { correct, points: correct ? question.points : 0 }
}

// ── math 채점 (src/lib/mathNormalize.ts와 동일 로직 — normalized 비교만, symbolic은 미구현) ──

function normalizeLatex(raw) {
  let s = raw.trim().replace(/\s+/g, '')
  s = s.replace(/\\left|\\right/g, '')
  let prev
  do {
    prev = s
    s = s.replace(/\{\{([^{}]*)\}\}/g, '{$1}')
    s = s.replace(/([\^_])\{(\w)\}/g, '$1$2')
  } while (s !== prev)
  return s
}

function latexMatches(raw, accepted) {
  const normalized = normalizeLatex(raw)
  return accepted.some((acc) => normalizeLatex(acc) === normalized)
}

function gradeMath(question, value) {
  const given = typeof value === 'string' ? value : ''
  const correct = given.trim().length > 0 && latexMatches(given, question.answer || [])
  return { correct, points: correct ? question.points : 0 }
}

const GRADERS = {
  choice: gradeChoice,
  short: gradeShort,
  cloze: gradeCloze,
  combo: gradeCombo,
  order: gradeOrder,
  match: gradeMatch,
  numeric: gradeNumeric,
  chem: gradeChem,
  math: gradeMath,
  // drawing/photo/dataTable은 8단계에서 여기 추가 (서버 자동채점 대상이 아니면 생략 가능)
}

function gradeQuestion(question, value) {
  const grader = GRADERS[question.kind]
  return grader ? grader(question, value) : null
}

function findQuestionInLesson(lesson, questionId) {
  for (const slide of lesson.slides) {
    for (const block of slide.blocks) {
      if (block.type === 'question' && block.q.id === questionId) return block.q
    }
  }
  return null
}

// ── 액션 구현 ─────────────────────────────────────────────────────────

function createLesson(payload) {
  return withLock(() => {
    let code = generateLessonCode()
    while (findLessonFile(code)) code = generateLessonCode() // 충돌 시 재시도 (극히 드묾)

    const editToken = generateEditToken()
    const lesson = {
      version: 1,
      code,
      title: payload.title,
      accent: '#2563eb',
      published: false,
      settings: {
        requireAnswerToAdvance: true,
        allowBackNavigation: true,
        feedbackMode: 'onFinish',
        identityFields: payload.identityFields,
        shuffleChoices: false,
        referencePanel: { enabled: false, tabs: [] },
      },
      slides: [{ id: Utilities.getUuid(), isSub: false, blocks: [] }],
      updatedAt: nowIso(),
    }

    writeLesson(code, lesson)
    const sheet = getIndexSheet().getSheetByName('index')
    sheet.appendRow([code, sha256Hex(editToken), '', nowIso()])

    return { code, editToken }
  })
}

function getLesson(payload) {
  const lesson = readLesson(payload.code)
  if (!lesson.published) throw new ApiError('아직 발행되지 않은 수업입니다')
  return stripAnswers(lesson)
}

function getLessonForEdit(payload) {
  requireEditToken(payload.code, payload.editToken)
  return readLesson(payload.code)
}

function saveLesson(payload) {
  requireEditToken(payload.code, payload.editToken)
  writeLesson(payload.code, Object.assign({}, payload.lesson, { code: payload.code, updatedAt: nowIso() }))
}

function publishLesson(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const lesson = readLesson(payload.code)
    lesson.published = true
    lesson.updatedAt = nowIso()
    writeLesson(payload.code, lesson)
    ensureResponseSpreadsheet(payload.code)
  })
}

function deleteLesson(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const file = findLessonFile(payload.code)
    if (file) file.setTrashed(true)

    const idx = findIndexRow(payload.code)
    if (idx && idx.responseSpreadsheetId) {
      try {
        DriveApp.getFileById(idx.responseSpreadsheetId).setTrashed(true)
      } catch (e) {
        // 이미 지워졌으면 무시
      }
    }
    const mediaRoot = getOrCreateFolder(getRootFolder(), 'media')
    const uploadsRoot = getOrCreateFolder(getRootFolder(), 'uploads')
    ;[findFolder(mediaRoot, payload.code), findFolder(uploadsRoot, payload.code)].forEach((folder) => {
      if (folder) folder.setTrashed(true)
    })
    removeIndexRow(payload.code)
  })
}

function uploadFile(folder, payload) {
  const bytes = Utilities.base64Decode(payload.dataBase64)
  const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.filename || 'upload')
  const file = folder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  return { url: 'https://drive.google.com/uc?export=view&id=' + file.getId() }
}

function uploadMedia(payload) {
  requireEditToken(payload.code, payload.editToken)
  return uploadFile(getMediaFolder(payload.code), payload)
}

function uploadStudentMedia(payload) {
  readLesson(payload.code) // 수업 존재 확인
  return uploadFile(getUploadsFolder(payload.code), payload)
}

// ── 응답 스프레드시트 ─────────────────────────────────────────────────

const FIXED_COLUMNS = ['studentKey', '이름', '학년', '반', '번호', '시작시각', '제출시각', '진행경로']

function initResponseHeader(sheet) {
  sheet.getRange(1, 1, 1, FIXED_COLUMNS.length).setValues([FIXED_COLUMNS])
}

function ensureResponseSpreadsheet(code) {
  const idx = findIndexRow(code)
  if (idx.responseSpreadsheetId) {
    try {
      return SpreadsheetApp.openById(idx.responseSpreadsheetId)
    } catch (e) {
      // 파일이 지워졌으면 새로 만든다
    }
  }
  const ss = SpreadsheetApp.create('응답 - ' + code)
  const responses = ss.getActiveSheet()
  responses.setName('responses')
  initResponseHeader(responses)
  const test = ss.insertSheet('_test')
  initResponseHeader(test)
  const meta = ss.insertSheet('_meta')
  meta.appendRow(['questionId', 'label', 'startColumn'])
  DriveApp.getFileById(ss.getId()).moveTo(getResponsesFolder())
  updateIndexResponseSheetId(code, ss.getId())
  return ss
}

function openResponseSpreadsheet(code) {
  const idx = findIndexRow(code)
  if (!idx || !idx.responseSpreadsheetId) throw new ApiError('아직 발행되지 않은 수업입니다')
  return SpreadsheetApp.openById(idx.responseSpreadsheetId)
}

function tryOpenResponseSpreadsheet(code) {
  const idx = findIndexRow(code)
  if (!idx || !idx.responseSpreadsheetId) return null
  try {
    return SpreadsheetApp.openById(idx.responseSpreadsheetId)
  } catch (e) {
    return null
  }
}

/** questionId가 처음 등장하면 responses/_test 양쪽에 답/정오/점수 3칸을 새로 만든다. */
function ensureQuestionColumns(ss, questionId) {
  const meta = ss.getSheetByName('_meta')
  const data = meta.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === questionId) {
      const startCol = data[i][2]
      return { answerCol: startCol, correctCol: startCol + 1, pointsCol: startCol + 2 }
    }
  }
  const responses = ss.getSheetByName('responses')
  const test = ss.getSheetByName('_test')
  const startCol = responses.getLastColumn() + 1
  const label = '문항' + data.length // data.length는 헤더 포함이라 1부터 시작하는 번호로 자연스럽게 이어짐
  const headers = [[label + '_답', label + '_정오', label + '_점수']]
  responses.getRange(1, startCol, 1, 3).setValues(headers)
  test.getRange(1, startCol, 1, 3).setValues(headers)
  meta.appendRow([questionId, label, startCol])
  return { answerCol: startCol, correctCol: startCol + 1, pointsCol: startCol + 2 }
}

function readMetaMap(ss) {
  const data = ss.getSheetByName('_meta').getDataRange().getValues()
  const map = {}
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) map[data[i][0]] = data[i][2]
  }
  return map
}

function findRowIndexByStudentKey(sheet, studentKey) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === studentKey) return i + 1
  }
  return -1
}

function upsertResponseRow(ss, sheet, record) {
  let rowIndex = findRowIndexByStudentKey(sheet, record.studentKey)
  if (rowIndex === -1) rowIndex = sheet.getLastRow() + 1

  const identity = record.identity || {}
  const fixedValues = [
    record.studentKey,
    identity.name || '',
    identity.grade || '',
    identity.klass || '',
    identity.number || '',
    record.startedAt,
    record.submittedAt || '',
    (record.path || []).join(','),
  ]
  sheet.getRange(rowIndex, 1, 1, fixedValues.length).setValues([fixedValues])

  Object.keys(record.answers || {}).forEach((questionId) => {
    const cols = ensureQuestionColumns(ss, questionId)
    sheet.getRange(rowIndex, cols.answerCol).setValue(JSON.stringify(record.answers[questionId]))
    const score = record.scores && record.scores[questionId]
    if (score) {
      sheet.getRange(rowIndex, cols.correctCol).setValue(score.correct ? '정답' : '오답')
      sheet.getRange(rowIndex, cols.pointsCol).setValue(score.points)
    }
  })
}

function rowToRecord(sheet, row, ss) {
  const metaMap = readMetaMap(ss)
  const record = {
    studentKey: row[0],
    identity: {
      name: row[1] || undefined,
      grade: row[2] || undefined,
      klass: row[3] || undefined,
      number: row[4] || undefined,
    },
    startedAt: row[5],
    submittedAt: row[6] || undefined,
    path: row[7] ? String(row[7]).split(',') : [],
    answers: {},
    scores: {},
    isTest: sheet.getName() === '_test',
  }
  Object.keys(metaMap).forEach((questionId) => {
    const col = metaMap[questionId] - 1 // 0-based 배열 인덱스로 변환
    const rawAnswer = row[col]
    if (rawAnswer !== '' && rawAnswer !== undefined && rawAnswer !== null) {
      try {
        record.answers[questionId] = JSON.parse(rawAnswer)
      } catch (e) {
        record.answers[questionId] = rawAnswer
      }
    }
    const correctText = row[col + 1]
    if (correctText === '정답' || correctText === '오답') {
      record.scores[questionId] = { correct: correctText === '정답', points: Number(row[col + 2]) || 0 }
    }
  })
  return record
}

function saveProgress(payload) {
  withLock(() => {
    readLesson(payload.code) // 존재 확인 (미발행이어도 테스트 모드는 통과시킨다)
    const ss = ensureResponseSpreadsheet(payload.code)
    const sheetName = payload.record.isTest ? '_test' : 'responses'
    upsertResponseRow(ss, ss.getSheetByName(sheetName), payload.record)
  })
}

function getProgress(payload) {
  const ss = tryOpenResponseSpreadsheet(payload.code)
  if (!ss) return null
  const mainRowIndex = findRowIndexByStudentKey(ss.getSheetByName('responses'), payload.studentKey)
  if (mainRowIndex !== -1) {
    const sheet = ss.getSheetByName('responses')
    return rowToRecord(sheet, sheet.getRange(mainRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0], ss)
  }
  const testRowIndex = findRowIndexByStudentKey(ss.getSheetByName('_test'), payload.studentKey)
  if (testRowIndex !== -1) {
    const sheet = ss.getSheetByName('_test')
    return rowToRecord(sheet, sheet.getRange(testRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0], ss)
  }
  return null
}

function gradeAnswer(payload) {
  const lesson = readLesson(payload.code)
  const question = findQuestionInLesson(lesson, payload.questionId)
  if (!question) throw new ApiError('존재하지 않는 문항입니다: ' + payload.questionId)
  return gradeQuestion(question, payload.value)
}

function submitResponse(payload) {
  return withLock(() => {
    const lesson = readLesson(payload.code)
    const record = payload.record
    const scores = {}
    Object.keys(record.answers || {}).forEach((questionId) => {
      const question = findQuestionInLesson(lesson, questionId)
      if (!question) return
      const result = gradeQuestion(question, record.answers[questionId])
      if (result) scores[questionId] = result
    })
    record.submittedAt = nowIso()
    record.scores = scores

    const ss = ensureResponseSpreadsheet(payload.code)
    const sheetName = record.isTest ? '_test' : 'responses'
    upsertResponseRow(ss, ss.getSheetByName(sheetName), record)

    return { scores }
  })
}

function getResults(payload) {
  requireEditToken(payload.code, payload.editToken)
  const ss = tryOpenResponseSpreadsheet(payload.code)
  if (!ss) return []
  const sheet = ss.getSheetByName('responses')
  const data = sheet.getDataRange().getValues()
  const records = []
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue
    records.push(rowToRecord(sheet, data[i], ss))
  }
  return records
}

function getAggregate(payload) {
  const ss = tryOpenResponseSpreadsheet(payload.code)
  const counts = {}
  let totalResponses = 0
  if (ss) {
    const metaMap = readMetaMap(ss)
    const col = metaMap[payload.questionId]
    if (col) {
      const sheet = ss.getSheetByName('responses')
      const data = sheet.getDataRange().getValues()
      for (let i = 1; i < data.length; i++) {
        const raw = data[i][col - 1]
        if (raw === '' || raw === undefined || raw === null) continue
        let value
        try {
          value = JSON.parse(raw)
        } catch (e) {
          value = raw
        }
        totalResponses += 1
        const bucket = Array.isArray(value) ? value : [value]
        bucket.forEach((v) => {
          const key = String(v)
          counts[key] = (counts[key] || 0) + 1
        })
      }
    }
  }
  return { questionId: payload.questionId, totalResponses, counts }
}
