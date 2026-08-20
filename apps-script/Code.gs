/**
 * 인터랙티브 수업 도구 — Apps Script 백엔드 (6~8단계)
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
  setLessonSlug,
  setLessonLocked,
  deleteResponse,
  uploadMedia,
  uploadStudentMedia,
  saveProgress,
  getProgress,
  gradeAnswer,
  submitResponse,
  getResults,
  getLive,
  forceSubmit,
  forceSubmitAll,
  normalizeStoredIdentities,
  mergeDuplicateResponses,
  regradeResponses,
  setViewPassword,
  getAggregate,
  listLessons,
  adminGetLesson,
  adminDeleteLesson,
  adminResetEditToken,
  adminGetStorageUsage,
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

/**
 * 구조를 바꾸는 작업(행 신규 생성, 문항 컬럼 추가)을 직렬화한다.
 *
 * ★ **`SpreadsheetApp.flush()` 두 번이 핵심이다** (2026-08-19).
 *   앞뒤로 flush 하지 않으면 락이 있어도 **같은 학생의 행이 두 개 생긴다.**
 *   실제로 났다 — 마찰전기 수업에서 1반 3번 학생의 행이 시트 83·84행에 같은
 *   `studentKey` 로 나란히 만들어졌다.
 *
 *   왜 락만으로 안 되나: Apps Script 의 시트 쓰기는 **실행이 끝날 때 커밋**된다.
 *   `releaseLock()` 은 실행이 끝나기 전에 일어나므로, 락을 넘겨받은 다음 실행이
 *   `getDataRange().getValues()` 로 읽어도 **앞 실행이 방금 만든 행이 아직 안 보인다.**
 *   그래서 「없네」 하고 `getLastRow() + 1` 에 하나 더 만든다.
 *
 *   · 들어갈 때 flush — 앞 실행이 커밋한 것을 내 읽기에 보이게 한다
 *   · 나갈 때 flush  — 내 쓰기를 커밋한 **뒤에** 락을 넘긴다
 */
/**
 * @param {number} [waitMs] 락 대기 한도. 기본 20초.
 *   학생 요청이 한꺼번에 몰려 **줄이 길어지는 곳**(행 신규 생성)은 길게 준다 —
 *   2026-08-20 실측: 12명이 동시에 입장하면 줄 끝은 20초에 닿아 **1~2명이 실패**했다.
 *   30명이면 확실히 넘는다. 기다리는 건 느릴 뿐이지만, 실패는 학생이 수업에 못 들어온다.
 */
function withLock(fn, waitMs) {
  const lock = LockService.getScriptLock()
  lock.waitLock(waitMs || 20000)
  try {
    SpreadsheetApp.flush()
    return fn()
  } finally {
    try {
      SpreadsheetApp.flush()
    } catch (e) {
      // flush 실패가 락 해제를 막으면 안 된다 — 막히면 전원이 20초 대기에 걸린다
    }
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
  ss.getActiveSheet()
    .setName('index')
    .appendRow(['code', 'editTokenHash', 'responseSpreadsheetId', 'createdAt', 'slug', 'viewPasswordHash'])
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
  // slug(5열)·viewPasswordHash(6열)는 나중에 추가된 열이라 옛 행은 비어 있다 — 없으면 빈 문자열.
  const row = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0]
  return {
    rowIndex,
    code: row[0],
    editTokenHash: row[1],
    responseSpreadsheetId: row[2],
    slug: row[4] || '',
    viewPasswordHash: row[5] || '',
  }
}

// ── 짧은 수업 주소(slug) ──────────────────────────────────────────────
// 학생이 'K3P7QF' 같은 6자리 코드 대신 '2-3전기'처럼 기억하기 쉬운 주소로 들어올 수 있게 한다.
// 코드 자체는 그대로 살아 있고 slug는 별칭일 뿐이다 — 해석은 이 함수 한 곳에서만 한다.

var SLUG_PATTERN = /^[0-9A-Za-z가-힣][0-9A-Za-z가-힣_-]{1,19}$/

/** 6자리 코드와 생김새가 같은 slug는 거부한다 — 그러면 코드 조회가 먼저 걸려 slug가 영영 안 먹는다 */
function looksLikeLessonCode(text) {
  return /^[A-Z0-9]{6}$/.test(String(text).toUpperCase())
}

function findCodeBySlug(slug) {
  const normalized = String(slug || '').toLowerCase()
  if (!normalized) return null
  const data = getIndexSheet().getSheetByName('index').getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][4] || '').toLowerCase() === normalized) return data[i][0]
  }
  return null
}

/**
 * 학생이 입력한 값(코드일 수도, slug일 수도)을 실제 수업 코드로 바꾼다.
 * 코드를 먼저 본다 — 코드는 우리가 발급한 것이라 항상 우선한다.
 */
function resolveCode(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new ApiError('수업 코드가 필요합니다')
  const upper = raw.toUpperCase()
  if (findLessonFile(upper)) return upper
  const bySlug = findCodeBySlug(raw)
  if (bySlug) return bySlug
  return upper // 없으면 그대로 넘겨 기존 "존재하지 않는 수업 코드입니다" 오류가 나게 둔다
}

function setLessonSlug(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const slug = String(payload.slug || '').trim()

    const sheet = getIndexSheet().getSheetByName('index')
    const rowIndex = findIndexRowIndex(sheet, payload.code)
    if (rowIndex === -1) throw new ApiError('존재하지 않는 수업 코드입니다: ' + payload.code)

    if (!slug) {
      sheet.getRange(rowIndex, 5).setValue('')
      return { slug: '' }
    }
    if (!SLUG_PATTERN.test(slug)) {
      throw new ApiError('주소는 한글·영문·숫자로 시작하는 2~20자여야 하고, - 와 _ 만 함께 쓸 수 있어요')
    }
    if (looksLikeLessonCode(slug)) {
      throw new ApiError('수업 코드와 같은 형식(영문 대문자·숫자 6자리)은 주소로 쓸 수 없어요')
    }
    const owner = findCodeBySlug(slug)
    if (owner && owner !== payload.code) throw new ApiError('이미 다른 수업이 쓰고 있는 주소예요')

    sheet.getRange(rowIndex, 5).setValue(slug)
    return { slug: slug }
  })
}

function requireEditToken(code, editToken) {
  const idx = findIndexRow(code)
  if (!idx) throw new ApiError('존재하지 않는 수업 코드입니다: ' + code)
  if (idx.editTokenHash !== sha256Hex(editToken)) throw new ApiError('편집 권한이 없습니다 (editToken 불일치)')
  return idx
}

/** isTest:true는 진짜 그 수업의 editToken이 함께 왔을 때만 인정한다 — 그 외엔 조용히 false로 낮춘다. */
function resolveIsTest(code, requestedIsTest, editToken) {
  if (!requestedIsTest || !editToken) return false
  try {
    requireEditToken(code, editToken)
    return true
  } catch (e) {
    return false
  }
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

/**
 * 학생 요청이 행을 새로 만들 때 락을 기다리는 한도. 한 학급이 동시에 입장해도 줄이 끝까지
 * 소화되도록 넉넉히 둔다(Apps Script 실행 한도 6분보다 충분히 아래).
 */
const STUDENT_LOCK_WAIT_MS = 120000

const LESSON_CACHE_SECONDS = 120
const LESSON_CACHE_MAX_BYTES = 90 * 1024 // CacheService 한 항목 한도(100KB)보다 넉넉히 아래로

/**
 * 수업 JSON 을 읽는다. **짧게 캐시한다** (2026-08-20).
 *
 * 예전에는 요청마다 Drive 폴더 검색 + 파일 다운로드 + 파싱을 했다 — 실측 **3.3초**다.
 * `gradeAnswer`·`saveProgress`·`submitResponse`·`getLesson` 이 전부 이걸 부르므로,
 * 학생이 9문항을 즉시채점으로 풀면 그 3.3초를 **아홉 번 더** 낸다.
 *
 * 캐시가 낡을 걱정은 `writeLesson` 이 지운다(수업을 고치는 유일한 통로다).
 * 캐시가 없거나(만료·축출) 너무 큰 수업이면 그냥 Drive 에서 읽는다 — 느려질 뿐 틀리지 않는다.
 */
function readLesson(code) {
  const cache = CacheService.getScriptCache()
  const hit = cache.get('lesson:' + code)
  if (hit) {
    try {
      return JSON.parse(hit)
    } catch (e) {
      // 깨진 캐시는 무시하고 원본을 읽는다
    }
  }
  const file = findLessonFile(code)
  if (!file) throw new ApiError('존재하지 않는 수업 코드입니다: ' + code)
  const raw = file.getBlob().getDataAsString()
  if (raw.length <= LESSON_CACHE_MAX_BYTES) {
    try {
      cache.put('lesson:' + code, raw, LESSON_CACHE_SECONDS)
    } catch (e) {
      // 한도 초과 등 — 캐시를 못 써도 동작은 같다
    }
  }
  return JSON.parse(raw)
}

/** 수업을 고치는 유일한 통로. **캐시를 반드시 여기서 지운다** — 다른 데서 지우면 빠뜨린다. */
function writeLesson(code, lesson) {
  const content = JSON.stringify(lesson)
  const file = findLessonFile(code)
  if (file) file.setContent(content)
  else getLessonsFolder().createFile(code + '.json', content, MimeType.PLAIN_TEXT)
  CacheService.getScriptCache().remove('lesson:' + code)
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
  } else {
    delete q.answer
    // 서답형 키워드 채점의 keywordExpr("지진,(흔들림, 떨림), 땅")은 사실상 정답 그 자체라
    // 같이 지운다 — answer만 지우면 학생 응답에 채점 기준이 그대로 실려 나간다(2026-08-06 발견).
    // src/lib/stripAnswers.ts와 반드시 같은 동작을 유지할 것.
    delete q.keywordExpr
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

// 쉼표=AND, 괄호 안 쉼표=OR (유사어). src/lib/keywordMatch.ts와 동일 로직.
function parseKeywordGroups(expr) {
  const groups = []
  const n = expr.length
  let i = 0
  while (i < n) {
    while (i < n && (expr[i] === ',' || /\s/.test(expr[i]))) i++
    if (i >= n) break
    if (expr[i] === '(') {
      let depth = 1
      let j = i + 1
      while (j < n && depth > 0) {
        if (expr[j] === '(') depth++
        else if (expr[j] === ')') depth--
        j++
      }
      const inner = expr.slice(i + 1, depth === 0 ? j - 1 : j)
      const alts = inner.split(',').map((s) => s.trim()).filter(Boolean)
      if (alts.length > 0) groups.push(alts)
      i = j
    } else {
      let j = i
      while (j < n && expr[j] !== ',' && expr[j] !== '(') j++
      const word = expr.slice(i, j).trim()
      if (word) groups.push([word])
      i = j
    }
  }
  return groups
}

function matchKeywordGroups(given, expr) {
  const groups = parseKeywordGroups(expr)
  const normalizedGiven = normalizeAnswerText(given)
  const matchedGroups = groups.filter((alts) => alts.some((alt) => normalizedGiven.indexOf(normalizeAnswerText(alt)) !== -1)).length
  return { totalGroups: groups.length, matchedGroups: matchedGroups }
}

function gradeShort(question, value) {
  if (question.matchMode === 'none') return null
  const rawGiven = typeof value === 'string' ? value : ''
  if (question.matchMode === 'keywords') {
    // 키워드식이 비어있으면 채점 대상이 아니다(자유 서술 전용 문항) — TS쪽
    // src/blocks/questions/Short.tsx와 동일하게 맞춘다(2026-07-30, docs/DECISIONS.md 참고).
    if (!(question.keywordExpr || '').trim()) return null
    const m = matchKeywordGroups(rawGiven, question.keywordExpr || '')
    if (m.matchedGroups === 0) return { correct: false, points: 0 }
    if (m.matchedGroups === m.totalGroups) return { correct: true, points: question.points }
    return { correct: false, partial: true, points: question.points / 2 }
  }
  // 정답을 하나도 안 정해뒀으면 채점 대상에서 제외한다(자유 서술 전용 문항).
  const answers = (question.answer || []).map(normalizeAnswerText)
  if (answers.length === 0) return null
  const given = normalizeAnswerText(rawGiven)
  const correct =
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

// "÷" 버튼(기본 키보드)으로 만든 a\div b를 "분수" 버튼으로 만든 \frac{a}{b}와 같은 것으로
// 본다 — 분수 키보드를 안 켠 문항에서 학생이 ÷로만 답을 만들면 개념이 맞아도 표기가 달라
// 오답 처리되는 문제가 있었다(단항 토큰·괄호·중괄호 묶음 정도의 단순한 경우만 다룸).
function divToFrac(s) {
  const token = '(?:[A-Za-z0-9]+|\\{[^{}]*\\}|\\([^()]*\\))'
  const pattern = new RegExp('(' + token + ')\\\\div(' + token + ')', 'g')
  let prev
  let out = s
  do {
    prev = out
    out = out.replace(pattern, '\\frac{$1}{$2}')
  } while (out !== prev)
  return out
}

// MathLive는 물리 키보드로 "*"를 치면 자체 inline shortcut 규칙에 따라 자동으로 "\cdot"을
// 삽입한다 — 반면 이 앱의 "×" 버튼(basic 키보드)은 "\times"를 삽입한다. 같은 곱셈인데 표기만
// 달라 물리 키보드로 입력한 학생만 오답 처리되던 버그. \cdots·\cdotp처럼 뒤에 글자가 이어지는
// 다른 명령까지 건드리지 않도록 부정 전방탐색을 둔다.
function normalizeLatex(raw) {
  let s = raw.trim().replace(/\s+/g, '')
  s = s.replace(/\\left|\\right/g, '')
  s = s.replace(/\\(?:[,;:!]|quad|qquad)/g, '')
  s = s.replace(/\\cdot(?![a-zA-Z])/g, '\\times')
  s = divToFrac(s)
  let prev
  do {
    prev = s
    s = s.replace(/\{\{([^{}]*)\}\}/g, '{$1}')
    s = s.replace(/([\^_])\{(\w)\}/g, '$1$2')
    s = s.replace(/\{\}/g, '')
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

// dataTable/drawing/photo는 정오답 개념이 없어(교사 수기 확인) GRADERS에 넣지 않는다 —
// TS 쪽(src/blocks/questions/DataTable.tsx 등)도 grade를 등록 안 함.

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
      version: 3,
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
  // 학생이 짧은 주소(slug)로 들어왔을 수 있다. 여기서 한 번만 실제 코드로 바꾸고, 이후
  // 클라이언트는 응답에 들어 있는 lesson.code를 써서 저장·제출한다.
  const code = resolveCode(payload.code)
  const lesson = readLesson(code)
  if (!lesson.published) throw new ApiError('아직 발행되지 않은 수업입니다')
  return stripAnswers(lesson)
}

function getLessonForEdit(payload) {
  const code = resolveCode(payload.code)
  const idx = requireEditToken(code, payload.editToken)
  const lesson = readLesson(code)
  // 교사 화면이 지금 설정된 짧은 주소를 보여줄 수 있게 같이 실어 보낸다(수업 JSON에는 저장하지
  // 않는다 — slug는 전역에서 유일해야 해서 index 시트가 유일한 출처다).
  lesson.slug = idx.slug || ''
  // 현황 암호는 **설정 여부만** 알려준다. 해시조차 내보내지 않는다 — 받아 가면 서버 시도
  // 제한과 무관하게 자기 기기에서 마음껏 대입해 볼 수 있다.
  lesson.hasViewPassword = !!idx.viewPasswordHash
  return lesson
}

function saveLesson(payload) {
  requireEditToken(payload.code, payload.editToken)
  const lesson = Object.assign({}, payload.lesson, { code: payload.code, updatedAt: nowIso() })
  // slug는 index 시트가 유일한 출처다. getLessonForEdit이 편의로 실어 보낸 값이 그대로 되돌아와
  // 수업 JSON에 눌러앉지 않도록 여기서 떼어낸다(두 곳에 있으면 반드시 어긋난다).
  delete lesson.slug
  delete lesson.hasViewPassword
  writeLesson(payload.code, lesson)
}

function setLessonLocked(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const lesson = readLesson(payload.code)
    lesson.settings = lesson.settings || {}
    lesson.settings.locked = !!payload.locked
    lesson.updatedAt = nowIso()
    writeLesson(payload.code, lesson)
    return { locked: lesson.settings.locked }
  })
}

/** 마감된 수업에는 학생이 더 이상 쓸 수 없다. 교사 테스트 모드는 마감과 무관하게 통과시킨다. */
function assertNotLocked(lesson, isTest) {
  if (isTest) return
  if (lesson && lesson.settings && lesson.settings.locked) {
    throw new ApiError('제출이 마감된 수업입니다. 선생님께 문의하세요.')
  }
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

function deleteLessonByCode(code) {
  const file = findLessonFile(code)
  if (file) file.setTrashed(true)
  // ★ writeLesson 을 거치지 않는 유일한 수업 변경 경로다 — 캐시를 여기서도 지운다.
  //   안 지우면 삭제된 수업이 최대 LESSON_CACHE_SECONDS 동안 살아 있는 것처럼 보인다.
  CacheService.getScriptCache().remove('lesson:' + code)

  const idx = findIndexRow(code)
  if (idx && idx.responseSpreadsheetId) {
    try {
      DriveApp.getFileById(idx.responseSpreadsheetId).setTrashed(true)
    } catch (e) {
      // 이미 지워졌으면 무시
    }
  }
  const mediaRoot = getOrCreateFolder(getRootFolder(), 'media')
  const uploadsRoot = getOrCreateFolder(getRootFolder(), 'uploads')
  ;[findFolder(mediaRoot, code), findFolder(uploadsRoot, code)].forEach((folder) => {
    if (folder) folder.setTrashed(true)
  })
  removeIndexRow(code)
  // 지운 수업의 캐시를 남겨두면 같은 코드가 다시 나왔을 때 옛 값이 섞인다
  CacheService.getScriptCache().remove('results:' + code)
  CacheService.getScriptCache().remove('lastSeen:' + code)
  CacheService.getScriptCache().remove('viewFails:' + code)
}

function deleteLesson(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    deleteLessonByCode(payload.code)
  })
}

// ── 관리자 전용 (운영자 비밀번호로만 인증, editToken과 무관) ─────────────
// 비밀번호는 코드에 커밋하지 않는다 — 배포 후 Apps Script 편집기의
// "프로젝트 설정 → 스크립트 속성"에서 ADMIN_PASSWORD를 직접 등록한다 (apps-script/SETUP.md 참고).

// 무차별 대입 방지 — 클라이언트 IP를 안정적으로 얻을 방법이 없어(Apps Script 웹앱의 구조적
// 한계) 사용자별이 아니라 스크립트 전체 공유 카운터로 막는다. 완벽한 차단은 아니지만 초당 수십
// 번씩 시도하는 자동화된 대입 공격의 속도를 실질적으로 늦춘다. 실제 관리자가 비밀번호를 여러 번
// 틀리면 다른 시도와 함께 일시적으로 잠길 수 있다는 트레이드오프를 감수한다(docs/DECISIONS.md 참고).
var ADMIN_FAIL_LIMIT = 10
var ADMIN_FAIL_WINDOW_SECONDS = 600 // 10분

function requireAdminPassword(payload) {
  var cache = CacheService.getScriptCache()
  var failKey = 'adminAuthFails'
  var fails = Number(cache.get(failKey) || '0')
  if (fails >= ADMIN_FAIL_LIMIT) {
    throw new ApiError('비밀번호 시도가 너무 많아 잠시 후 다시 시도해주세요 (약 10분 후 자동 해제)')
  }

  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD')
  if (!expected) throw new ApiError('관리자 비밀번호가 서버에 설정되어 있지 않습니다 (스크립트 속성 ADMIN_PASSWORD를 등록하세요)')
  if (!payload || payload.password !== expected) {
    cache.put(failKey, String(fails + 1), ADMIN_FAIL_WINDOW_SECONDS)
    throw new ApiError('관리자 비밀번호가 올바르지 않습니다')
  }
  cache.remove(failKey)
}

function listLessons(payload) {
  requireAdminPassword(payload)
  const sheet = getIndexSheet().getSheetByName('index')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return []
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues()
  const out = []
  rows.forEach((row) => {
    const code = row[0]
    if (!code) return
    try {
      const lesson = readLesson(code)
      out.push({
        code: code,
        title: lesson.title,
        published: !!lesson.published,
        updatedAt: lesson.updatedAt,
        createdAt: row[3],
        slideCount: lesson.slides.length,
        // 발행 전(응답 시트를 아직 안 만든 수업)엔 비어있다 — 관리자 화면 "응답 시트" 버튼이
        // 이 값 유무로 링크를 보여줄지 결정한다.
        responseSpreadsheetId: row[2] || null,
      })
    } catch (e) {
      // 인덱스엔 있지만 수업 파일이 없는 등 불일치 상태 — 목록에서 조용히 건너뜀
    }
  })
  return out
}

function adminGetLesson(payload) {
  requireAdminPassword(payload)
  return readLesson(payload.code)
}

function adminDeleteLesson(payload) {
  return withLock(() => {
    requireAdminPassword(payload)
    deleteLessonByCode(payload.code)
  })
}

/**
 * 서버는 editToken 평문을 저장하지 않으므로(해시만 보관) 관리자가 기존 수업을 열려면
 * editToken을 새로 발급해 _index의 해시를 덮어쓰는 수밖에 없다 — 이 호출 이후 교사가
 * 보관 중이던 예전 편집 링크는 더 이상 동작하지 않는다(2026-07-29 확정, docs/DECISIONS.md 참고).
 */
function adminResetEditToken(payload) {
  return withLock(() => {
    requireAdminPassword(payload)
    const sheet = getIndexSheet().getSheetByName('index')
    const rowIndex = findIndexRowIndex(sheet, payload.code)
    if (rowIndex === -1) throw new ApiError('존재하지 않는 수업 코드입니다: ' + payload.code)
    const editToken = generateEditToken()
    sheet.getRange(rowIndex, 2).setValue(sha256Hex(editToken))
    return { editToken }
  })
}

/**
 * Drive 무료 저장용량(15GB) 임박을 관리자 화면에서 미리 볼 수 있게 한다(2026-07-29, 실사용
 * 리스크 대응 — docs/ROADMAP.md 참고). DriveApp이 아니라 Drive API v3 고급 서비스(About.get)로만
 * 조회 가능 — script.google.com 편집기의 "서비스 추가"로 Drive API를 활성화해둬야 동작한다.
 */
function adminGetStorageUsage(payload) {
  requireAdminPassword(payload)
  var about = Drive.About.get({ fields: 'storageQuota' })
  var quota = about.storageQuota || {}
  return {
    usageBytes: Number(quota.usage || 0),
    limitBytes: Number(quota.limit || 0),
  }
}

function uploadFile(folder, payload) {
  const bytes = Utilities.base64Decode(payload.dataBase64)
  const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.filename || 'upload')
  const file = folder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  // 'drive.google.com/uc?export=view&id=...'는 비공식 방식이라 Google이 최근 자주 바이러스
  // 검사 경고 페이지(이미지 대신 HTML)를 돌려주면서 사진이 "파일명만 보이고 안 뜨는" 문제를
  // 일으켰다. 'lh3.googleusercontent.com/d/...'가 현재 더 안정적으로 이미지 바이트를 직접
  // 서빙한다(역시 비공식이지만 Drive 썸네일/콘텐츠 CDN이라 핫링크에 훨씬 안정적).
  return { url: 'https://lh3.googleusercontent.com/d/' + file.getId() }
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

const FIXED_COLUMNS = ['studentKey', '이름', '학년', '반', '번호', '시작시각', '제출시각', '진행경로', '잠금문항']

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

/** 헤더 아래 모든 행에서 이 3칸(답/정오/점수)에 값이 단 하나도 없으면 true — 응답 시트뿐 아니라
 * _test 시트에도 아무 기록이 없어야 안전하게 재활용할 수 있다(둘 다 같은 컬럼 배치를 쓴다). */
function isColumnEmpty(sheet, startCol) {
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return true // 헤더뿐, 응답 행 자체가 없음
  const values = sheet.getRange(2, startCol, lastRow - 1, 3).getValues()
  return values.every((row) => row.every((cell) => cell === '' || cell === null || cell === undefined))
}

/**
 * questionId가 처음 등장하면 responses/_test 양쪽에 답/정오/점수 3칸을 새로 만든다. 문항을
 * 만들었다가 아무도 답하기 전에 지우는 흔한 드래프트 시나리오에서 컬럼이 옆으로 무한히 쌓이는
 * 것을 막기 위해, 새 컬럼을 끝에 붙이기 전에 **응답이 단 하나도 기록된 적 없는(responses·_test
 * 둘 다)** 기존 컬럼이 있으면 그 자리를 재활용한다. 이미 값이 하나라도 쓰인 컬럼은 절대 재사용
 * 하지 않는다 — 과거 데이터가 새 문항의 값으로 잘못 읽히는 사고를 원천 차단하기 위한 안전 범위
 * (2026-07-29, docs/DECISIONS.md 참고).
 */
function ensureQuestionColumns(ss, questionId) {
  const meta = ss.getSheetByName('_meta')
  const data = readMetaRows(ss)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === questionId) {
      const startCol = data[i][2]
      return { answerCol: startCol, correctCol: startCol + 1, pointsCol: startCol + 2 }
    }
  }
  const responses = ss.getSheetByName('responses')
  const test = ss.getSheetByName('_test')

  for (let i = 1; i < data.length; i++) {
    const candidateCol = data[i][2]
    if (isColumnEmpty(responses, candidateCol) && isColumnEmpty(test, candidateCol)) {
      const label = '문항' + i
      const headers = [[label + '_답', label + '_정오', label + '_점수']]
      responses.getRange(1, candidateCol, 1, 3).setValues(headers)
      test.getRange(1, candidateCol, 1, 3).setValues(headers)
      meta.getRange(i + 1, 1, 1, 2).setValues([[questionId, label]])
      invalidateMetaCache(ss) // 시트를 고쳤으니 캐시를 버린다
      return { answerCol: candidateCol, correctCol: candidateCol + 1, pointsCol: candidateCol + 2 }
    }
  }

  const startCol = responses.getLastColumn() + 1
  const label = '문항' + data.length // data.length는 헤더 포함이라 1부터 시작하는 번호로 자연스럽게 이어짐
  const headers = [[label + '_답', label + '_정오', label + '_점수']]
  responses.getRange(1, startCol, 1, 3).setValues(headers)
  test.getRange(1, startCol, 1, 3).setValues(headers)
  meta.appendRow([questionId, label, startCol])
  invalidateMetaCache(ss)
  return { answerCol: startCol, correctCol: startCol + 1, pointsCol: startCol + 2 }
}

/*
 * ⚠️ 성능의 핵심 — _meta 시트 읽기를 **한 번의 실행 안에서 재사용**한다.
 *
 * 예전에는 rowToRecord 가 **행마다** readMetaMap 을 불러 응답 55건이면 _meta 를 55번 읽었고,
 * ensureQuestionColumns 는 **문항마다** 또 읽어 자동저장 한 번에 9번을 더 읽었다.
 * 이것이 getLive 가 17~29초 걸리고 학생 제출이 락 대기(20초)를 넘겨 실패하던 주된 원인이다
 * (2026-08-18 측정·수정).
 *
 * Apps Script 는 요청마다 새 실행이라 전역 변수는 그 요청 동안만 산다 — 캐시로 알맞다.
 * **시트를 고치는 쪽(ensureQuestionColumns)은 반드시 이 캐시를 무효화해야 한다.**
 */
var _metaCache = {}

function metaCacheKey(ss) {
  return ss.getId()
}

function invalidateMetaCache(ss) {
  delete _metaCache[metaCacheKey(ss)]
}

/** _meta 원본 행 (헤더 포함). 같은 실행 안에서는 한 번만 읽는다. */
function readMetaRows(ss) {
  const key = metaCacheKey(ss)
  if (!_metaCache[key]) _metaCache[key] = ss.getSheetByName('_meta').getDataRange().getValues()
  return _metaCache[key]
}

function readMetaMap(ss) {
  const data = readMetaRows(ss)
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

/** 「같은 학생인가」 판정 문자열. src/lib/identity.ts 의 identitySignature 와 같아야 한다(규칙 4). */
function identitySignature(identity) {
  const n = normalizeIdentity(identity || {})
  return ['grade', 'klass', 'number', 'name'].map(function (f) { return n[f] == null ? '' : String(n[f]) }).join(':')
}

/** 시트 한 행(2~5열 = 이름·학년·반·번호)에서 같은 판정 문자열을 만든다. */
function rowIdentitySignature(row) {
  return identitySignature({ name: row[1], grade: row[2], klass: row[3], number: row[4] })
}

/**
 * 이 학생의 행을 찾는다 — **열쇠로 먼저, 없으면 다듬은 식별정보로.**
 *
 * ★ 식별정보 대조가 있어야 「기기가 바뀌어도 학년·반·번호·이름이 같으면 이어서 푼다」가
 *   성립한다(사용자 요구 2026-08-19). 열쇠 계산 규칙을 고치면 옛 행의 열쇠와 안 맞는데,
 *   이 대조가 그 옛 행까지 이어 준다 — 덕분에 기존 응답을 손대지 않고 배포할 수 있다.
 *
 * 식별칸이 하나도 없는(전부 빈) 행은 대조하지 않는다 — 빈 값끼리 우연히 같아
 * 남의 행을 덮어쓰는 사고를 막는다.
 */
function findRowIndexForRecord(sheet, studentKey, identity) {
  // ★ `getDataRange()` 로 시트 전체를 읽지 않는다 — 필요한 건 1~5열(열쇠·이름·학년·반·번호)뿐이다.
  //   이 함수는 **락 안에서도** 불리므로, 문항 컬럼까지 통째로 읽으면 임계구역이 그만큼 길어져
  //   동시 제출이 20초 락 대기를 넘긴다(2026-08-20 실측: 12명 동시 신규행 생성에서 2건 실패).
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1
  const data = sheet.getRange(1, 1, lastRow, 5).getValues()
  const want = identity ? identitySignature(identity) : ''
  let byIdentity = -1
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === studentKey) return i + 1 // 열쇠가 맞으면 그게 정답
    if (byIdentity === -1 && want && want.replace(/:/g, '') !== '' && rowIdentitySignature(data[i]) === want) {
      byIdentity = i + 1
    }
  }
  return byIdentity
}

/**
 * 학생 식별 정보를 저장 전에 다듬는다.
 * ⚠️ **src/lib/identity.ts 와 같은 동작이어야 한다**(규칙 4) — 한쪽만 고치면 클라이언트가
 *    다듬은 값과 서버가 다듬은 값이 달라진다.
 *   · 이름을 뺀 칸: 숫자만 (전각 숫자는 반각으로)
 *   · 이름: 앞뒤·가운데 **모든 공백 제거**
 */
function normalizeIdentity(identity) {
  const out = {}
  Object.keys(identity || {}).forEach(function (field) {
    const raw = identity[field]
    if (raw === undefined || raw === null) {
      out[field] = raw
      return
    }
    const s = String(raw)
    if (field === 'name') {
      // NFC 로 맞춘다 — 조합형/완성형은 화면에 똑같이 보이는데 문자열로는 다르다
      out[field] = s.normalize('NFC').replace(/[\s　]+/g, '')
    } else {
      out[field] = s
        .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0) })
        .replace(/\D/g, '')
        .replace(/^0+(?=\d)/, '') // 03 → 3
    }
  })
  return out
}

/**
 * 이미 저장된 응답의 식별 정보를 규칙에 맞게 한 번 정리한다 (일회성 정비용).
 * 무엇이 바뀌었는지 돌려주므로 확인하고 쓸 수 있다. 편집 키가 필요하다.
 */
function normalizeStoredIdentities(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return { changed: 0, details: [] }
    const details = []
    let changed = 0
    ;['responses', '_test'].forEach(function (name) {
      const sheet = ss.getSheetByName(name)
      if (!sheet) return
      const lastRow = sheet.getLastRow()
      for (let row = 2; row <= lastRow; row++) {
        try {
          // 이름·학년·반·번호는 2~5열 (upsertResponseRow 의 fixedValues 배치와 같다)
          const cur = sheet.getRange(row, 2, 1, 4).getValues()[0]
          const before = { name: cur[0], grade: cur[1], klass: cur[2], number: cur[3] }
          const after = normalizeIdentity(before)
          const diff = ['name', 'grade', 'klass', 'number'].filter(function (f) {
            return String(before[f] == null ? '' : before[f]) !== String(after[f] == null ? '' : after[f])
          })
          if (diff.length === 0) continue
          sheet.getRange(row, 2, 1, 4).setValues([[after.name, after.grade, after.klass, after.number]])
          changed++
          if (details.length < 50) details.push({ sheet: name, row: row, before: before, after: after, fields: diff })
        } catch (e) {
          // 한 행이 이상해도 나머지는 정리한다
        }
      }
    })
    if (changed > 0) CacheService.getScriptCache().remove('results:' + payload.code)
    return { changed: changed, details: details }
  })
}

/**
 * 이미 생긴 중복 행을 합친다 (일회성 정비용, 편집 키 필요).
 *
 * 2026-08-19 이전의 `withLock` 은 flush 를 하지 않아 **같은 학생의 행이 둘 생길 수 있었다.**
 * 그렇게 남은 행을 여기서 정리한다. 판정 기준은 다듬은 식별정보(identitySignature)이므로
 * 열쇠가 갈린 옛 중복(`3번`/`3` 같은 경우)도 함께 합쳐진다.
 *
 * 합치는 규칙 — **답을 잃지 않는 쪽으로만 움직인다.**
 *   · 남길 행: 제출한 행 > 답이 많은 행 > 먼저 시작한 행
 *   · 남길 행의 **빈 칸만** 다른 행의 값으로 채운다 (덮어쓰지 않는다)
 *   · 시작 시각은 가장 이른 것, 제출 시각은 남아 있는 것 중 가장 이른 것
 *   · 나머지 행은 삭제 (뒤에서부터 — 앞에서 지우면 행 번호가 밀린다)
 */
function mergeDuplicateResponses(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return { merged: 0, removed: 0, details: [] }
    const dryRun = payload.dryRun === true
    const details = []
    let merged = 0
    let removed = 0

    ;['responses', '_test'].forEach(function (name) {
      const sheet = ss.getSheetByName(name)
      if (!sheet) return
      const lastRow = sheet.getLastRow()
      const lastCol = sheet.getLastColumn()
      if (lastRow < 3 || lastCol < 9) return
      const data = sheet.getRange(1, 1, lastRow, lastCol).getValues()

      // 식별정보별로 행 번호를 모은다 (식별칸이 전부 빈 행은 건너뛴다)
      const groups = {}
      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue
        const sig = rowIdentitySignature(data[i])
        if (sig.replace(/:/g, '') === '') continue
        if (!groups[sig]) groups[sig] = []
        groups[sig].push(i) // 0-based 배열 인덱스
      }

      const toDelete = []
      Object.keys(groups).forEach(function (sig) {
        const idxs = groups[sig]
        if (idxs.length < 2) return
        const answerCount = function (i) {
          let n = 0
          for (let c = 9; c < lastCol; c += 3) if (data[i][c] !== '' && data[i][c] !== null) n++
          return n
        }
        // 남길 행 고르기: 제출한 쪽 → 답 많은 쪽 → 먼저 시작한 쪽
        const winner = idxs.slice().sort(function (a, b) {
          const sa = data[a][6] ? 1 : 0
          const sb = data[b][6] ? 1 : 0
          if (sa !== sb) return sb - sa
          const ca = answerCount(a)
          const cb = answerCount(b)
          if (ca !== cb) return cb - ca
          return String(data[a][5]).localeCompare(String(data[b][5]))
        })[0]
        const losers = idxs.filter(function (i) { return i !== winner })

        const row = data[winner].slice()
        losers.forEach(function (i) {
          // 시작 시각은 가장 이른 것으로
          if (data[i][5] && (!row[5] || String(data[i][5]) < String(row[5]))) row[5] = data[i][5]
          // 제출 시각은 남아 있는 것 중 가장 이른 것
          if (data[i][6] && (!row[6] || String(data[i][6]) < String(row[6]))) row[6] = data[i][6]
          // path·lockedQuestionIds 는 더 긴 쪽을 남긴다
          for (const c of [7, 8]) {
            if (String(data[i][c] || '').length > String(row[c] || '').length) row[c] = data[i][c]
          }
          // 답·정오답·점수는 **빈 칸만** 채운다
          for (let c = 9; c < lastCol; c++) {
            if ((row[c] === '' || row[c] === null) && data[i][c] !== '' && data[i][c] !== null) row[c] = data[i][c]
          }
        })

        details.push({
          sheet: name,
          identity: sig,
          keptRow: winner + 1,
          removedRows: losers.map(function (i) { return i + 1 }),
          answersAfter: (function () { let n = 0; for (let c = 9; c < lastCol; c += 3) if (row[c] !== '' && row[c] !== null) n++; return n })(),
        })
        merged++
        if (!dryRun) sheet.getRange(winner + 1, 1, 1, lastCol).setValues([row])
        losers.forEach(function (i) { toDelete.push(i + 1) })
      })

      if (!dryRun) {
        toDelete.sort(function (a, b) { return b - a }) // 뒤에서부터 지운다
        toDelete.forEach(function (r) { sheet.deleteRow(r); removed++ })
      } else {
        removed += toDelete.length
      }
    })

    if (merged > 0 && !dryRun) CacheService.getScriptCache().remove('results:' + payload.code)
    return { merged: merged, removed: removed, dryRun: dryRun, details: details }
  })
}

/**
 * 응답 한 행을 쓴다.
 *
 * ⚠️ **한 번의 setValues 로 행 전체를 쓴다.** 예전에는 고정 칸 1회 + 문항마다 최대 3회의
 *    개별 setValue 였다 — 문항 9개면 쓰기 호출이 28번이고, 그 전부가 전역 락 안에서 돌아
 *    학생 자동저장이 서로 밀리며 20초 락 대기를 넘겨 제출이 실패했다(2026-08-18 수정).
 *
 * @param opts.rowIndex     이미 찾아 둔 행 번호 (없으면 여기서 찾는다)
 * @param opts.existingRow  그 행의 현재 값 배열 (없으면 필요할 때 한 번 읽는다).
 *                          **이번에 안 건드리는 칸을 지우지 않으려면 반드시 있어야 한다.**
 */
function upsertResponseRow(ss, sheet, record, opts) {
  opts = opts || {}
  let rowIndex = opts.rowIndex
  if (rowIndex === undefined || rowIndex === null || rowIndex === -1) {
    rowIndex = findRowIndexForRecord(sheet, record.studentKey, record.identity)
  }
  const isNew = rowIndex === -1
  if (isNew) rowIndex = sheet.getLastRow() + 1

  // 어떤 경로로 들어오든(옛 화면·직접 호출 포함) 저장 전에 한 번 더 다듬는다
  const identity = normalizeIdentity(record.identity || {})
  // ★ 기존 행의 열쇠는 **그대로 지킨다.** 식별정보로 찾아낸 행이면 클라이언트가 보낸 열쇠와
  //   다를 수 있는데(옛 화면·기기 교체), 여기서 덮어쓰면 그 학생의 다른 기기가 들고 있는
  //   열쇠와 어긋나 행이 또 갈린다. 열쇠는 「처음 만든 값」으로 고정하고, 이어 주는 일은
  //   findRowIndexForRecord 의 식별정보 대조가 맡는다.
  const existingKey = !isNew && opts.existingRow ? opts.existingRow[0] : ''
  const fixedValues = [
    existingKey || record.studentKey,
    identity.name || '',
    identity.grade || '',
    identity.klass || '',
    identity.number || '',
    record.startedAt,
    record.submittedAt || '',
    (record.path || []).join(','),
    (record.lockedQuestionIds || []).join(','),
  ]

  // 문항 컬럼을 **먼저 전부 확보**한다 (필요하면 시트에 새 컬럼을 만든다)
  const questionIds = Object.keys(record.answers || {})
  const colsById = {}
  let maxCol = fixedValues.length
  questionIds.forEach(function (questionId) {
    const cols = ensureQuestionColumns(ss, questionId)
    colsById[questionId] = cols
    if (cols.pointsCol > maxCol) maxCol = cols.pointsCol
  })

  // 기존 값을 바탕에 깔고 이번에 바뀐 칸만 덮는다 — 안 그러면 손대지 않은 칸이 지워진다.
  let base = []
  if (!isNew) {
    base = opts.existingRow || sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0]
  }
  const values = []
  for (let c = 0; c < maxCol; c++) values.push(base[c] === undefined ? '' : base[c])
  for (let i = 0; i < fixedValues.length; i++) values[i] = fixedValues[i]

  questionIds.forEach(function (questionId) {
    const cols = colsById[questionId]
    values[cols.answerCol - 1] = JSON.stringify(record.answers[questionId])
    const score = record.scores && record.scores[questionId]
    if (score) {
      values[cols.correctCol - 1] = score.correct ? '정답' : '오답'
      values[cols.pointsCol - 1] = score.points
    }
  })

  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values])
}

/** metaMap 을 넘기면 그걸 쓴다 — 여러 행을 도는 쪽은 반드시 넘겨서 _meta 재조회를 없앨 것. */
function rowToRecord(sheet, row, ss, metaMap) {
  metaMap = metaMap || readMetaMap(ss)
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
    lockedQuestionIds: row[8] ? String(row[8]).split(',') : [],
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

/**
 * POE 예측처럼 lockAfterSubmit로 한 번 잠근 문항은 클라이언트가 무엇을 보내든 서버가
 * 이전에 저장해둔 답 값을 그대로 유지한다(재수정 거부 — docs/PLAN.md 9번 항목, src/api/mock.ts와 동일 로직).
 */
function enforceLocks(previous, incoming) {
  if (!previous || !previous.lockedQuestionIds || previous.lockedQuestionIds.length === 0) return incoming
  const answers = Object.assign({}, incoming.answers)
  previous.lockedQuestionIds.forEach((id) => {
    if (Object.prototype.hasOwnProperty.call(previous.answers, id)) answers[id] = previous.answers[id]
  })
  const lockedSet = {}
  ;(previous.lockedQuestionIds || []).concat(incoming.lockedQuestionIds || []).forEach((id) => { lockedSet[id] = true })
  const merged = {}
  for (const k in incoming) merged[k] = incoming[k]
  merged.answers = answers
  merged.lockedQuestionIds = Object.keys(lockedSet)
  return merged
}

/**
 * 학생 자동저장.
 *
 * ⚠️ **전역 락을 통째로 잡지 않는다** (2026-08-18 구조 변경).
 *
 * 예전에는 이 함수 전체가 `withLock` 안에 있었다. LockService 의 스크립트 락은
 * **모든 수업·모든 학생이 공유하는 하나뿐인 락**이라, 한 명이 5초를 잡으면 나머지가 줄을 섰다.
 * 12명이 동시에 저장하자 **6명이 20초 락 대기를 넘겨 실패**하는 것을 실측으로 재현했다.
 *
 * 락이 정말 필요한 곳은 **구조를 바꾸는 두 경우**뿐이다:
 *   · 새 학생의 **행을 새로 만들 때** — 두 명이 같은 `getLastRow()+1` 을 집으면 서로 덮어쓴다
 *   · 새 문항의 **컬럼을 만들 때** — `_meta` 와 두 시트를 함께 고친다
 * 학생마다 자기 행 하나만 쓰므로, **이미 있는 행을 갱신하는 흔한 경우는 락이 필요 없다.**
 * 같은 학생의 요청끼리 겹치면 나중 것이 이기는데, 이는 락이 있던 시절과 결과가 같다.
 */
function saveProgress(payload) {
  const lesson = readLesson(payload.code) // 존재 확인 (미발행이어도 테스트 모드는 통과시킨다)
  const isTest = resolveIsTest(payload.code, payload.record.isTest, payload.editToken)
  assertNotLocked(lesson, isTest)
  const record = Object.assign({}, payload.record, { isTest: isTest })
  const ss = ensureResponseSpreadsheet(payload.code)
  const sheetName = isTest ? '_test' : 'responses'
  const sheet = ss.getSheetByName(sheetName)
  const rowIndex = findRowIndexForRecord(sheet, record.studentKey, record.identity)
  // 행을 한 번만 읽어 previous 판정과 저장에 함께 쓴다
  const existingRow = rowIndex !== -1 ? sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] : null
  const previous = existingRow ? rowToRecord(sheet, existingRow, ss) : null
  // 이미 제출된 응답에 뒤늦게 도착한 자동저장(디바운스)이 덮어써서 "미제출"로 되돌리는 것을 막는다
  // (saveProgress 페이로드에는 submittedAt이 아예 없어 그대로 덮어쓰면 제출 기록이 사라진다).
  if (previous && previous.submittedAt) return
  const merged = enforceLocks(previous, record)

  if (rowIndex === -1 || needsNewQuestionColumns(ss, merged)) {
    // 구조가 바뀌는 경우에만 락을 잡고, **안에서 행 번호를 다시 찾는다**
    // (기다리는 동안 다른 요청이 그 학생의 행을 만들었을 수 있다).
    withLock(() => {
      const freshIndex = findRowIndexForRecord(sheet, merged.studentKey, merged.identity)
      const freshRow = freshIndex !== -1 ? sheet.getRange(freshIndex, 1, 1, sheet.getLastColumn()).getValues()[0] : null
      upsertResponseRow(ss, sheet, merged, { rowIndex: freshIndex, existingRow: freshRow })
    }, STUDENT_LOCK_WAIT_MS)
  } else {
    upsertResponseRow(ss, sheet, merged, { rowIndex: rowIndex, existingRow: existingRow })
  }

  touchLastSeen(payload.code, record.studentKey, isTest)
  // 결과 캐시가 방금 저장된 응답을 곧바로 반영하도록 무효화한다 —
  // isTest 응답은 애초에 getResults가 읽지 않는 시트라 캐시를 건드릴 필요가 없다.
  if (!isTest) CacheService.getScriptCache().remove('results:' + payload.code)
}

/** 이 응답을 쓰려면 _meta 에 없는 문항 컬럼을 새로 만들어야 하는가 (= 락이 필요한가) */
function needsNewQuestionColumns(ss, record) {
  const metaMap = readMetaMap(ss)
  const ids = Object.keys(record.answers || {})
  for (let i = 0; i < ids.length; i++) {
    if (metaMap[ids[i]] === undefined) return true
  }
  return false
}

/**
 * 학생이 진입 화면에서 자기 진행상황을 이어받는다.
 * ★ `identity` 를 함께 받는다 — 다른 기기·다른 브라우저로 옮겨 열쇠가 달라져도
 *   학년·반·번호·이름이 같으면 같은 행을 찾아 이어서 풀 수 있어야 한다(2026-08-19).
 */
function getProgress(payload) {
  const ss = tryOpenResponseSpreadsheet(payload.code)
  if (!ss) return null
  const mainRowIndex = findRowIndexForRecord(ss.getSheetByName('responses'), payload.studentKey, payload.identity)
  if (mainRowIndex !== -1) {
    const sheet = ss.getSheetByName('responses')
    return rowToRecord(sheet, sheet.getRange(mainRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0], ss)
  }
  const testRowIndex = findRowIndexForRecord(ss.getSheetByName('_test'), payload.studentKey, payload.identity)
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

/**
 * 학생 제출. saveProgress 와 같은 이유로 **전역 락을 통째로 잡지 않는다**(2026-08-18).
 * 제출은 수업이 끝날 무렵 여러 명이 한꺼번에 누르는 동작이라, 여기서 줄을 서면
 * 가장 실패하면 안 되는 순간에 실패한다.
 */
function submitResponse(payload) {
  const lesson = readLesson(payload.code)
  const isTest = resolveIsTest(payload.code, payload.record.isTest, payload.editToken)
  assertNotLocked(lesson, isTest)
  const incoming = Object.assign({}, payload.record, { isTest: isTest })
  const ss = ensureResponseSpreadsheet(payload.code)
  const sheetName = isTest ? '_test' : 'responses'
  const sheet = ss.getSheetByName(sheetName)
  const rowIndex = findRowIndexForRecord(sheet, incoming.studentKey, incoming.identity)
  const existingRow = rowIndex !== -1 ? sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] : null
  const previous = existingRow ? rowToRecord(sheet, existingRow, ss) : null
  const record = enforceLocks(previous, incoming)

  const scores = {}
  Object.keys(record.answers || {}).forEach((questionId) => {
    const question = findQuestionInLesson(lesson, questionId)
    if (!question) return
    const result = gradeQuestion(question, record.answers[questionId])
    if (result) scores[questionId] = result
  })
  record.submittedAt = nowIso()
  record.scores = scores

  if (rowIndex === -1 || needsNewQuestionColumns(ss, record)) {
    withLock(() => {
      const freshIndex = findRowIndexForRecord(sheet, record.studentKey, record.identity)
      const freshRow = freshIndex !== -1 ? sheet.getRange(freshIndex, 1, 1, sheet.getLastColumn()).getValues()[0] : null
      upsertResponseRow(ss, sheet, record, { rowIndex: freshIndex, existingRow: freshRow })
    }, STUDENT_LOCK_WAIT_MS)
  } else {
    upsertResponseRow(ss, sheet, record, { rowIndex: rowIndex, existingRow: existingRow })
  }

  touchLastSeen(payload.code, record.studentKey, isTest)
  if (!isTest) CacheService.getScriptCache().remove('results:' + payload.code)

  return { scores: scores }
}

/**
 * 짧은 TTL로 결과를 캐싱한다 — 교사가 결과 화면을 열어두고 실시간에 가깝게 갱신되길 기다리는
 * 동안(세션4 후속, docs/ROADMAP.md 참고) 매번 스프레드시트 전체를 다시 읽지 않게 하기 위함.
 * PLAN.md는 원래 getAggregate에 "CacheService 10초 캐시"를 문서화해뒀지만 실제로는 구현된 적이
 * 없었다 — 이번에 getResults를 캐싱하면서 getAggregate도 같이 실제로 캐싱해 문서와 맞춘다.
 * 캐시 값이 CacheService의 100KB 한도를 넘으면(응답이 아주 많은 수업) put이 조용히 실패할 수
 * 있으므로 try/catch로 감싼다 — 캐싱만 포기될 뿐 기능 자체는 매번 재계산으로 정상 동작한다.
 */
/*
 * 결과 캐시 수명. 예전 6초는 **계산이 그보다 오래 걸려(17~29초) 쓰이기도 전에 만료**됐다.
 * 쓰기(saveProgress·submitResponse·강제제출·재채점)가 캐시를 즉시 무효화하므로,
 * 수명을 늘려도 낡은 값이 보이지 않는다.
 */
var RESULTS_CACHE_SECONDS = 60

function withCache(key, ttlSeconds, compute) {
  const cache = CacheService.getScriptCache()
  const hit = cache.get(key)
  if (hit) {
    try {
      return JSON.parse(hit)
    } catch (e) {
      // 캐시 값이 손상됐으면 무시하고 새로 계산
    }
  }
  const value = compute()
  try {
    cache.put(key, JSON.stringify(value), ttlSeconds)
  } catch (e) {
    // 100KB 한도 초과 등 — 캐싱만 포기, 값은 정상 반환
  }
  return value
}

/**
 * 학생 한 명의 응답만 지운다 — 잘못된 이름으로 들어와 중복 행이 생겼거나, 학생이 다시 풀고
 * 싶다고 요청하는 경우에 쓴다. 수업 전체 삭제(deleteLesson)와 달리 되돌릴 수 있는 범위가
 * 좁아, 교사가 결과 화면에서 바로 쓸 수 있게 별도 액션으로 뒀다.
 * 업로드한 사진·그림 파일까지 지우지는 않는다 — 어느 파일이 이 학생 것인지 시트에 남는 건
 * URL뿐이고, 그 URL은 여러 문항이 공유할 수 있어 성급히 지우면 남의 답안이 깨진다.
 */
function deleteResponse(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return { deleted: 0 }
    let deleted = 0
    ;['responses', '_test'].forEach(function (name) {
      const sheet = ss.getSheetByName(name)
      if (!sheet) return
      const rowIndex = findRowIndexByStudentKey(sheet, payload.studentKey)
      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex)
        deleted++
      }
    })
    CacheService.getScriptCache().remove('results:' + payload.code)
    return { deleted: deleted }
  })
}

// ── 응답 보관기간 ─────────────────────────────────────────────────────
// settings.retentionDays가 있으면 그보다 오래된 응답 행을 지운다. 학생 개인정보(이름·학번)와
// 답안을 필요 이상으로 오래 들고 있지 않기 위한 것이다. 값이 없거나 0이면 무기한 — 기존 수업의
// 응답이 이 기능 때문에 갑자기 사라지는 일이 없어야 한다.
//
// 별도 트리거 없이 교사가 결과 화면을 열 때(getResults) 함께 정리한다. Apps Script의 시간 기반
// 트리거는 배포와 별개로 사람이 한 번 설치해야 해서, 설치를 잊으면 아무 일도 안 일어나는 쪽보다
// 이 방식이 확실하다. 다만 "아무도 결과를 안 보는 수업은 정리도 안 된다"는 한계가 있어,
// 트리거를 걸고 싶을 때 쓰라고 purgeAllExpiredResponses()를 같이 둔다.

function purgeExpiredResponses(code, lesson) {
  const days = lesson && lesson.settings && lesson.settings.retentionDays
  if (!days || days <= 0) return 0
  const ss = tryOpenResponseSpreadsheet(code)
  if (!ss) return 0
  const cutoff = new Date().getTime() - days * 24 * 60 * 60 * 1000
  let removed = 0
  ;['responses', '_test'].forEach(function (name) {
    const sheet = ss.getSheetByName(name)
    if (!sheet) return
    const lastRow = sheet.getLastRow()
    if (lastRow < 2) return
    // 시작시각(6열) 기준. 뒤에서부터 지워야 행 번호가 밀리지 않는다.
    const startedAt = sheet.getRange(2, 6, lastRow - 1, 1).getValues()
    for (let i = startedAt.length - 1; i >= 0; i--) {
      const raw = startedAt[i][0]
      if (!raw) continue
      const t = new Date(raw).getTime()
      if (!isNaN(t) && t < cutoff) {
        sheet.deleteRow(i + 2)
        removed++
      }
    }
  })
  if (removed > 0) CacheService.getScriptCache().remove('results:' + code)
  return removed
}

/** 시간 기반 트리거로 하루 한 번 돌리고 싶을 때 쓰는 함수(선택). 모든 수업을 훑는다. */
function purgeAllExpiredResponses() {
  const data = getIndexSheet().getSheetByName('index').getDataRange().getValues()
  let total = 0
  for (let i = 1; i < data.length; i++) {
    const code = data[i][0]
    if (!code) continue
    try {
      total += purgeExpiredResponses(code, readLesson(code))
    } catch (e) {
      // 수업 파일이 이미 지워진 행 등은 건너뛴다
    }
  }
  return total
}

function getResults(payload) {
  requireEditToken(payload.code, payload.editToken)
  // 캐시보다 먼저 — 만료된 행을 지운 뒤의 상태가 캐시에 담겨야 한다.
  try {
    purgeExpiredResponses(payload.code, readLesson(payload.code))
  } catch (e) {
    // 정리 실패가 결과 조회 자체를 막으면 안 된다
  }
  return withCache('results:' + payload.code, RESULTS_CACHE_SECONDS, function () {
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return []
    const sheet = ss.getSheetByName('responses')
    const data = sheet.getDataRange().getValues()
    const metaMap = readMetaMap(ss)
    const records = []
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue
      records.push(rowToRecord(sheet, data[i], ss, metaMap))
    }
    return records
  })
}

/**
 * 수업 중 실시간 모니터링 화면(/live/:code)용. getResults와 같은 응답에 마지막 활동 시각을 얹는다.
 * 8초마다 폴링하는 화면이라 왕복을 하나로 합쳤고, 시트 읽기는 getResults의 6초 캐시를 그대로 탄다.
 */
// ── 현황 암호 ────────────────────────────────────────────────────────
// 교사가 직접 정하는, **진행 상황 화면 전용** 암호. 편집 키를 짧게 만드는 대신 권한이 낮은
// 열쇠를 따로 둔다 — 새더라도 할 수 있는 일이 getLive 하나뿐이라 수업을 고치거나 지울 수 없다.
// 규칙(최소 길이·뻔한 값 거부)은 src/lib/viewPassword.ts에도 있다 — 한쪽만 고치면 안 된다(규칙 4).

var VIEW_FAIL_LIMIT = 10
var VIEW_FAIL_WINDOW_SECONDS = 600

function validateViewPassword(password, code) {
  const value = String(password == null ? '' : password)
  if (value !== value.trim()) return '앞뒤 공백은 넣을 수 없습니다'
  if (/\s/.test(value)) return '공백은 넣을 수 없습니다'

  const digitsOnly = /^\d+$/.test(value)
  const min = digitsOnly ? 6 : 4
  if (value.length < min) {
    return digitsOnly ? '숫자만 쓸 때는 6자 이상으로 정해주세요' : '4자 이상으로 정해주세요'
  }
  // 같은 글자만 반복
  let allSame = true
  for (let i = 1; i < value.length; i++) if (value.charAt(i) !== value.charAt(0)) allSame = false
  if (allSame) return '같은 글자만 반복할 수는 없습니다'
  // 이어지는 숫자(123456 / 987654)
  if (digitsOnly) {
    let up = true
    let down = true
    for (let i = 1; i < value.length; i++) {
      const diff = value.charCodeAt(i) - value.charCodeAt(i - 1)
      if (diff !== 1) up = false
      if (diff !== -1) down = false
    }
    if (up || down) return '123456처럼 이어지는 숫자는 쓸 수 없습니다'
  }
  if (code && value.toLowerCase() === String(code).toLowerCase()) {
    return '수업 코드와 같은 암호는 쓸 수 없습니다 (학생이 가장 먼저 넣어 봅니다)'
  }
  return null
}

function setViewPassword(payload) {
  return withLock(() => {
    const idx = requireEditToken(payload.code, payload.editToken)
    const sheet = getIndexSheet().getSheetByName('index')
    const value = String(payload.password == null ? '' : payload.password)
    const cache = CacheService.getScriptCache()

    if (!value) {
      sheet.getRange(idx.rowIndex, 6).setValue('')
      cache.remove('viewFails:' + payload.code) // 해제하면 잠금도 같이 푼다
      return { hasViewPassword: false }
    }
    const problem = validateViewPassword(value, payload.code)
    if (problem) throw new ApiError(problem)
    sheet.getRange(idx.rowIndex, 6).setValue(sha256Hex(value))
    cache.remove('viewFails:' + payload.code)
    return { hasViewPassword: true }
  })
}

/**
 * 진행 상황 화면의 문지기. 편집 키와 현황 암호 **둘 중 하나만** 맞으면 통과한다.
 *
 * 시도 제한은 **현황 암호 쪽에만** 건다 — 사람이 정하는 값이라 짐작당할 수 있어서다.
 * 편집 키는 256비트 무작위라 대입이 무의미하고, 여기에 잠금을 걸면 남이 일부러 틀려서
 * 교사를 못 들어오게 만드는 수단이 된다.
 */
function requireLiveAccess(code, editToken, viewPassword) {
  const idx = findIndexRow(code)
  if (!idx) throw new ApiError('존재하지 않는 수업 코드입니다: ' + code)

  if (editToken && idx.editTokenHash === sha256Hex(editToken)) return idx
  if (!idx.viewPasswordHash) throw new ApiError('편집 권한이 없습니다 (editToken 불일치)')

  const cache = CacheService.getScriptCache()
  const failKey = 'viewFails:' + code
  const fails = Number(cache.get(failKey) || '0')
  if (fails >= VIEW_FAIL_LIMIT) {
    throw new ApiError('암호 시도가 너무 많아 잠시 후 다시 시도해주세요 (약 10분 후 자동 해제)')
  }
  if (!viewPassword || sha256Hex(viewPassword) !== idx.viewPasswordHash) {
    cache.put(failKey, String(fails + 1), VIEW_FAIL_WINDOW_SECONDS)
    throw new ApiError('암호가 올바르지 않습니다')
  }
  cache.remove(failKey)
  return idx
}

function getLive(payload) {
  requireLiveAccess(payload.code, payload.editToken, payload.viewPassword)
  // 시트 읽기·만료 정리·6초 캐시는 getResults가 이미 하고 있다. 다만 requireEditToken을
  // 다시 타면 현황 암호로 들어온 교사가 막히므로, 여기서 통과시킨 뒤 캐시 계산만 빌려 쓴다.
  // ⚠️ 수업을 **한 번만** 읽는다. 예전엔 정리용·응답용으로 두 번 읽어 Drive 왕복이 두 번이었다.
  const lesson = readLesson(payload.code)
  try {
    purgeExpiredResponses(payload.code, lesson)
  } catch (e) {
    // 정리 실패가 조회 자체를 막으면 안 된다
  }
  const records = withCache('results:' + payload.code, RESULTS_CACHE_SECONDS, function () {
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return []
    const sheet = ss.getSheetByName('responses')
    const data = sheet.getDataRange().getValues()
    const metaMap = readMetaMap(ss) // 행마다 읽지 않는다
    const out = []
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue
      out.push(rowToRecord(sheet, data[i], ss, metaMap))
    }
    return out
  })
  return {
    // 정답을 제거해서 보낸다 — 현황 화면은 지문·슬라이드 구조만 있으면 되고,
    // 현황 암호로 들어온 사람에게 정답까지 줄 이유가 없다.
    lesson: stripAnswers(lesson),
    records: records,
    lastSeen: readLastSeen(payload.code),
    // 경과 시간은 반드시 서버 시각 기준으로 재야 한다 — 교사 기기 시계가 틀어져 있으면
    // 클라이언트 시계로는 "-3분 전" 같은 값이 나오거나 멀쩡한 학생이 전부 멈춤으로 보인다.
    serverNow: nowIso(),
  }
}

/**
 * **아직 제출하지 않은 학생 전원**을 한 번에 제출 처리한다 (현황판의 「미제출자 전체 제출」).
 *
 * 한 명씩 forceSubmit 을 부르면 요청당 10초 넘게 걸려 20명이면 몇 분이 된다 —
 * 그래서 **서버에서 한 바퀴 돌고 한 번에 끝낸다.**
 * 권한·동작은 forceSubmit 과 같다(현황 암호로도 되고, 답은 건드리지 않는다).
 */
function forceSubmitAll(payload) {
  return withLock(() => {
    requireLiveAccess(payload.code, payload.editToken, payload.viewPassword)
    const lesson = readLesson(payload.code)
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return { submitted: 0, skipped: 0 }
    const sheet = ss.getSheetByName('responses')
    if (!sheet) return { submitted: 0, skipped: 0 }

    // 시트와 _meta 를 **한 번만** 읽는다 (예전엔 행마다 둘 다 다시 읽었다)
    const all = sheet.getDataRange().getValues()
    const metaMap = readMetaMap(ss)
    const lastRow = all.length
    let submitted = 0
    let skipped = 0
    let failed = 0
    for (let row = 2; row <= lastRow; row++) {
      // ⚠️ 한 행이 이상해도 **나머지는 처리돼야 한다.** 통째로 던지면 앞서 저장된 학생은
      //    이미 반영됐는데 교사에게는 실패로만 보인다(부분 적용 + 실패 보고).
      try {
        const values = all[row - 1]
        if (!values[0]) continue
        const record = rowToRecord(sheet, values, ss, metaMap)
        if (record.submittedAt) {
          skipped++
          continue
        }
        const scores = {}
        Object.keys(record.answers || {}).forEach((questionId) => {
          const question = findQuestionInLesson(lesson, questionId)
          if (!question) return
          const result = gradeQuestion(question, record.answers[questionId])
          if (result) scores[questionId] = result
        })
        record.submittedAt = nowIso()
        record.scores = scores
        upsertResponseRow(ss, sheet, record, { rowIndex: row, existingRow: values })
        submitted++
      } catch (e) {
        failed++ // 몇 명이 실패했는지는 반드시 돌려준다 — 조용히 삼키지 않는다
      }
    }
    CacheService.getScriptCache().remove('results:' + payload.code)
    return { submitted: submitted, skipped: skipped, failed: failed }
  })
}

/**
 * 이미 제출된 응답을 **현재 정답으로 다시 채점**한다. 교사가 정답을 고쳐 재발행할 때 쓴다.
 *
 * 답은 건드리지 않는다 — 점수(scores)만 다시 계산해 덮어쓴다. 아직 제출하지 않은 학생은
 * 그대로 둔다(제출할 때 어차피 새 정답으로 채점된다).
 * 편집 키가 필요하다 — 점수를 바꾸는 일이라 현황 암호로는 못 하게 한다.
 */
function regradeResponses(payload) {
  return withLock(() => {
    requireEditToken(payload.code, payload.editToken)
    const lesson = readLesson(payload.code)
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) return { regraded: 0 }
    const sheet = ss.getSheetByName('responses')
    if (!sheet) return { regraded: 0 }

    const lastRow = sheet.getLastRow()
    let regraded = 0
    let failed = 0
    const all = sheet.getDataRange().getValues()
    const metaMap = readMetaMap(ss)
    for (let row = 2; row <= all.length; row++) {
      // 한 명의 응답이 이상해도 나머지는 다시 채점돼야 한다(forceSubmitAll 과 같은 이유).
      try {
        const values = all[row - 1]
        if (!values[0]) continue
        const record = rowToRecord(sheet, values, ss, metaMap)
        if (!record.submittedAt) continue // 아직 제출 전이면 둔다

        const scores = {}
        Object.keys(record.answers || {}).forEach((questionId) => {
          const question = findQuestionInLesson(lesson, questionId)
          if (!question) return
          const result = gradeQuestion(question, record.answers[questionId])
          if (result) scores[questionId] = result
        })
        record.scores = scores
        upsertResponseRow(ss, sheet, record, { rowIndex: row, existingRow: values })
        regraded++
      } catch (e) {
        failed++
      }
    }
    CacheService.getScriptCache().remove('results:' + payload.code)
    return { regraded: regraded, failed: failed }
  })
}

/**
 * 교사가 학생 한 명을 **대신 제출 처리**한다 (현황판의 학생 카드 메뉴).
 *
 * 학생이 답을 남긴 채 제출을 안 하고 나가버리는 일이 잦아서, 교사가 수업을 닫기 전에 마무리할
 * 수단이 필요했다. 학생이 「제출하기」를 누른 것과 **같은 처리**를 서버에서 한다 —
 * 이미 저장돼 있는 답을 그대로 채점하고 submittedAt 을 찍는다. **답은 건드리지 않는다.**
 *
 * 권한은 getLive 와 같다(현황 암호로도 된다) — 사용자가 폰에서 쓰려고 명시적으로 고른 것이다
 * (2026-08-18). 답을 지우거나 고치지 않고 마감만 하므로 삭제류보다 피해 범위가 작다.
 */
function forceSubmit(payload) {
  return withLock(() => {
    requireLiveAccess(payload.code, payload.editToken, payload.viewPassword)
    const lesson = readLesson(payload.code)
    const ss = tryOpenResponseSpreadsheet(payload.code)
    if (!ss) throw new ApiError('아직 아무도 응답하지 않았습니다')
    const sheet = ss.getSheetByName('responses')
    const rowIndex = findRowIndexByStudentKey(sheet, payload.studentKey)
    if (rowIndex === -1) throw new ApiError('그 학생의 기록을 찾지 못했습니다')

    const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0]
    const record = rowToRecord(sheet, existingRow, ss)
    // 이미 제출한 학생을 다시 누르면 아무 일도 하지 않는다 — 제출 시각이 밀리면 안 된다.
    if (record.submittedAt) return { alreadySubmitted: true, submittedAt: record.submittedAt }

    const scores = {}
    Object.keys(record.answers || {}).forEach((questionId) => {
      const question = findQuestionInLesson(lesson, questionId)
      if (!question) return
      const result = gradeQuestion(question, record.answers[questionId])
      if (result) scores[questionId] = result
    })
    record.submittedAt = nowIso()
    record.scores = scores

    upsertResponseRow(ss, sheet, record, { rowIndex: rowIndex, existingRow: existingRow })
    CacheService.getScriptCache().remove('results:' + payload.code)
    return { alreadySubmitted: false, submittedAt: record.submittedAt }
  })
}

/**
 * 학생이 방금 활동했음을 기록한다. saveProgress·submitResponse의 **withLock 안에서만** 부른다
 * (전역 락이 직렬화해 주므로 읽기-수정-쓰기 경합이 없다).
 *
 * 왜 시트가 아니라 캐시인가: 응답 시트에는 고정 컬럼을 못 넣는다. _meta가 문항마다 **절대 컬럼
 * 번호**를 들고 있어서 10번째 고정 컬럼을 끼우면 기존 수업의 문항 답이 전부 한 칸씩 밀린다.
 * 게다가 이 값은 수업 시간 동안만 의미가 있고, 자동저장은 1.5초 디바운스라 꽤 잦은데 전역 락을
 * 공유하는 구조에서 시트 쓰기를 더 얹는 건 위험하다. (docs/DECISIONS.md 참고)
 */
function touchLastSeen(code, studentKey, isTest) {
  if (isTest) return // 교사 테스트 응답은 학급 명단이 아니다
  try {
    const map = readLastSeen(code)
    map[studentKey] = nowIso()
    CacheService.getScriptCache().put('lastSeen:' + code, JSON.stringify(map), 7200) // 2시간
  } catch (e) {
    // 100KB 한도 초과 등 — 활동 기록만 포기한다. 저장 자체를 실패시키면 안 된다.
  }
}

function readLastSeen(code) {
  const hit = CacheService.getScriptCache().get('lastSeen:' + code)
  if (!hit) return {} // 캐시 만료·축출은 정상 — 화면은 "활동 기록 없음"으로 표시한다
  try {
    return JSON.parse(hit)
  } catch (e) {
    return {}
  }
}

function getAggregate(payload) {
  return withCache('aggregate:' + payload.code + ':' + payload.questionId, 10, function () {
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
  })
}
