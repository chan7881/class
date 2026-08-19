import { beforeEach, describe, expect, it } from 'vitest'
import { registerGrader } from '../lib/grade'
import type { ChoiceQuestion, Lesson } from '../types/lesson'
import { ApiError, MockApiClient, VIEW_FAIL_LIMIT } from './mock'

// choice 문항 채점기를 테스트용으로 등록해둔다 (실제 채점기는 4단계에서 구현)
registerGrader('choice', (question: ChoiceQuestion, value) => {
  const given = Array.isArray(value) ? value : [value]
  const answer = question.answer ?? []
  const correct = given.length === answer.length && given.every((v) => answer.includes(v as string))
  return { correct, points: correct ? question.points : 0 }
})

function choiceLesson(): Lesson {
  return {
    version: 3,
    code: 'PLACEHOLDER',
    title: '중력 단원',
    accent: '#2563eb',
    published: false,
    settings: {
      requireAnswerToAdvance: true,
      allowBackNavigation: true,
      feedbackMode: 'onFinish',
      identityFields: ['name'],
      shuffleChoices: false,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [
      {
        id: 's1',
        isSub: false,
        blocks: [
          {
            id: 'b1',
            type: 'question',
            q: {
              id: 'q1',
              kind: 'choice',
              prompt: '지구의 중력가속도는?',
              required: true,
              points: 10,
              explanation: '표준 중력가속도는 약 9.8 m/s² 이다.',
              options: [
                { id: 'a', label: '9.8 m/s²' },
                { id: 'b', label: '3.7 m/s²' },
              ],
              multiple: false,
              answer: ['a'],
            },
          },
        ],
      },
    ],
    updatedAt: '2026-07-28T00:00:00.000Z',
  }
}

describe('MockApiClient', () => {
  let api: MockApiClient

  beforeEach(() => {
    api = new MockApiClient() // 매 테스트마다 새 메모리 스토어 (localStorage 없는 node 환경)
  })

  it('createLesson은 code와 editToken을 발급하고, getLessonForEdit로 다시 불러올 수 있다', async () => {
    const { code, editToken } = await api.createLesson({ title: '새 수업', identityFields: ['name'] })
    expect(code).toHaveLength(6)
    expect(editToken).toHaveLength(64)

    const lesson = await api.getLessonForEdit(code, editToken)
    expect(lesson.title).toBe('새 수업')
    expect(lesson.published).toBe(false)
  })

  it('틀린 editToken으로는 편집 API를 전혀 쓸 수 없다', async () => {
    const { code } = await api.createLesson({ title: '새 수업', identityFields: ['name'] })
    await expect(api.getLessonForEdit(code, 'wrong-token')).rejects.toThrow(ApiError)
    await expect(api.publishLesson(code, 'wrong-token')).rejects.toThrow(ApiError)
    await expect(api.deleteLesson(code, 'wrong-token')).rejects.toThrow(ApiError)
  })

  it('미발행 수업은 학생용 getLesson이 거부한다', async () => {
    const { code, editToken } = await api.createLesson({ title: '새 수업', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await expect(api.getLesson(code)).rejects.toThrow(ApiError)
  })

  it('발행 후 getLesson은 정답·해설을 제거하고 내려준다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    const studentLesson = await api.getLesson(code)
    const block = studentLesson.slides[0].blocks[0]
    if (block.type !== 'question' || block.q.kind !== 'choice') throw new Error('테스트 픽스처가 잘못됐습니다')
    expect(block.q.answer).toBeUndefined()
    expect(block.q.explanation).toBeUndefined()
    // 교사용은 여전히 정답을 볼 수 있어야 한다
    const teacherLesson = await api.getLessonForEdit(code, editToken)
    const teacherBlock = teacherLesson.slides[0].blocks[0]
    if (teacherBlock.type !== 'question' || teacherBlock.q.kind !== 'choice') throw new Error('테스트 픽스처가 잘못됐습니다')
    expect(teacherBlock.q.answer).toEqual(['a'])
  })

  it('gradeAnswer는 정답 자체를 노출하지 않고 채점 결과만 준다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    const correct = await api.gradeAnswer(code, 'q1', ['a'])
    expect(correct).toEqual({ correct: true, points: 10 })

    const wrong = await api.gradeAnswer(code, 'q1', ['b'])
    expect(wrong).toEqual({ correct: false, points: 0 })
  })

  // 수업 도중 기기가 바뀌는 상황 (사용자 요구 2026-08-19).
  // 열쇠는 다듬은 식별정보에서 나오므로 원래 같아야 하지만, 옛 화면이 캐시된 기기나
  // 열쇠 규칙이 바뀐 뒤에는 달라질 수 있다 — 그때도 학년·반·번호·이름이 같으면 이어져야 한다.
  it('열쇠가 달라도 학년·반·번호·이름이 같으면 같은 학생으로 이어받는다', async () => {
    const { code, editToken } = await api.createLesson({ title: '마찰전기', identityFields: ['klass', 'number', 'name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    await api.saveProgress(code, {
      studentKey: '옛-기기-열쇠',
      identity: { klass: '1', number: '3', name: '고승현' },
      startedAt: '2026-08-19T05:52:14.124Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    // 새 기기: 열쇠가 다르고, 식별정보를 사람이 조금 다르게 적었다
    const resumed = await api.getProgress(code, '새-기기-열쇠', { klass: '01', number: '03', name: '고 승현' })
    expect(resumed?.answers).toEqual({ q1: ['a'] })
    expect(resumed?.startedAt).toBe('2026-08-19T05:52:14.124Z')

    // 다른 학생은 이어받지 못한다
    expect(await api.getProgress(code, '남의-열쇠', { klass: '1', number: '4', name: '고승현' })).toBeNull()
    // 식별정보를 안 주면 열쇠로만 찾는다 (옛 호출 방식이 그대로 동작해야 한다)
    expect(await api.getProgress(code, '새-기기-열쇠')).toBeNull()
  })

  it('getProgress는 studentKey만으로 (편집 권한 없이도) 자기 진행상황을 이어받을 수 있다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    expect(await api.getProgress(code, 'student-1')).toBeNull()

    await api.saveProgress(code, {
      studentKey: 'student-1',
      identity: { name: '홍길동' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    const progress = await api.getProgress(code, 'student-1')
    expect(progress?.answers).toEqual({ q1: ['a'] })
  })

  it('POE 잠금 문항은 클라이언트가 새 값을 보내도 서버가 이전 값을 그대로 유지한다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    await api.saveProgress(code, {
      studentKey: 'student-1',
      identity: { name: '홍길동' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
      lockedQuestionIds: ['q1'], // 예측 제출 후 잠금
    })

    // 잠긴 뒤 클라이언트가 다른 값을 보내도(개발자도구로 우회 시도 등) 서버는 잠금 당시 값을 유지한다
    await api.saveProgress(code, {
      studentKey: 'student-1',
      identity: { name: '홍길동' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['b'] },
      scores: {},
      isTest: false,
      lockedQuestionIds: [],
    })

    const progress = await api.getProgress(code, 'student-1')
    expect(progress?.answers).toEqual({ q1: ['a'] })
    expect(progress?.lockedQuestionIds).toEqual(['q1']) // 클라이언트가 목록에서 빼도 서버는 잠금을 유지한다
  })

  it('submitResponse는 응답을 저장하고 getResults로 교사만 조회할 수 있다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    await api.submitResponse(code, {
      studentKey: 'student-1',
      identity: { name: '홍길동' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    const results = await api.getResults(code, editToken)
    expect(results).toHaveLength(1)
    expect(results[0].scores.q1).toEqual({ correct: true, points: 10 })
    await expect(api.getResults(code, 'wrong-token')).rejects.toThrow(ApiError)
  })

  it('제출 후 뒤늦게 도착한 자동저장(saveProgress)이 submittedAt을 지우지 못한다 (실배포 검증 중 발견한 경쟁 조건)', async () => {
    // Player.tsx의 디바운스 자동저장이 "제출하기" 클릭보다 늦게 서버에 도착하면, saveProgress
    // 페이로드에는 submittedAt이 아예 없어서 그대로 덮어쓰면 이미 제출된 응답이 "미제출"로
    // 되돌아간다. 실제 Apps Script 배포에서 겪은 지연(수 초) 때문에 실제로 재현됐다.
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    await api.submitResponse(code, {
      studentKey: 'student-race',
      identity: { name: '레이스' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    // 제출 직전에 예약돼 있던 자동저장이 뒤늦게 도착한 상황을 재현 — submittedAt이 없는 페이로드.
    await api.saveProgress(code, {
      studentKey: 'student-race',
      identity: { name: '레이스' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    const results = await api.getResults(code, editToken)
    expect(results).toHaveLength(1)
    expect(results[0].submittedAt).toBeTruthy()
  })

  it('editToken과 함께 온 테스트 모드 응답은 getResults(정식 결과)에 섞이지 않는다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    await api.submitResponse(
      code,
      {
        studentKey: 'teacher-test-1',
        identity: {},
        startedAt: '2026-07-28T00:00:00.000Z',
        path: ['s1'],
        answers: { q1: ['a'] },
        scores: {},
        isTest: true,
      },
      editToken,
    )

    const results = await api.getResults(code, editToken)
    expect(results).toHaveLength(0)
  })

  it('editToken 없이(또는 틀린 editToken으로) isTest:true를 보내면 서버가 조용히 정식 응답으로 저장한다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    const record = {
      studentKey: 'sneaky-student',
      identity: {},
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: true,
    }
    await api.submitResponse(code, record) // editToken 안 보냄
    await api.submitResponse(code, { ...record, studentKey: 'sneaky-student-2' }, 'wrong-token') // 틀린 editToken

    const results = await api.getResults(code, editToken)
    expect(results).toHaveLength(2)
    expect(results.every((r) => !r.isTest)).toBe(true)
  })

  it('deleteLesson은 수업·토큰·응답을 전부 지워 재접근을 막는다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)
    await api.submitResponse(code, {
      studentKey: 'student-1',
      identity: { name: '홍길동' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    await api.deleteLesson(code, editToken)

    await expect(api.getLesson(code)).rejects.toThrow(ApiError)
    await expect(api.getLessonForEdit(code, editToken)).rejects.toThrow(ApiError)
  })

  it('getAggregate는 학생 식별 정보 없이 응답 분포만 집계한다', async () => {
    const { code, editToken } = await api.createLesson({ title: '중력 단원', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code })
    await api.publishLesson(code, editToken)

    await api.submitResponse(code, {
      studentKey: 's1',
      identity: { name: '학생1' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })
    await api.submitResponse(code, {
      studentKey: 's2',
      identity: { name: '학생2' },
      startedAt: '2026-07-28T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['b'] },
      scores: {},
      isTest: false,
    })

    const agg = await api.getAggregate(code, 'q1')
    expect(agg.totalResponses).toBe(2)
    expect(agg.counts).toEqual({ a: 1, b: 1 })
    expect(JSON.stringify(agg)).not.toMatch(/학생1|학생2/)
  })

  it('listLessons/adminGetLesson/adminDeleteLesson은 editToken 없이도 전체 수업을 관리한다(관리자 화면용)', async () => {
    const a = await api.createLesson({ title: '수업A', identityFields: ['name'] })
    const b = await api.createLesson({ title: '수업B', identityFields: ['name'] })
    await api.saveLesson(a.code, a.editToken, { ...choiceLesson(), code: a.code, title: '수업A' })

    const list = await api.listLessons('아무-비밀번호')
    const codes = list.map((l) => l.code)
    expect(codes).toEqual(expect.arrayContaining([a.code, b.code]))
    // mock은 실제 Google Sheets가 없어 응답 시트 링크가 항상 비어있다(live에서만 값이 채워짐)
    expect(list.every((l) => l.responseSpreadsheetId === null)).toBe(true)

    const fetchedA = await api.adminGetLesson(a.code, '아무-비밀번호')
    expect(fetchedA.title).toBe('수업A')

    await api.adminDeleteLesson(a.code, '아무-비밀번호')
    const listAfter = await api.listLessons('아무-비밀번호')
    expect(listAfter.map((l) => l.code)).not.toContain(a.code)
    // b는 그대로 남아있어야 한다
    expect(listAfter.map((l) => l.code)).toContain(b.code)
  })

  it('adminGetStorageUsage는 mock에서 항상 고정값을 반환한다(실제 Drive 용량 개념이 없음)', async () => {
    const usage = await api.adminGetStorageUsage('아무-비밀번호')
    expect(usage.usageBytes).toBe(0)
    expect(usage.limitBytes).toBeGreaterThan(0)
  })

  it('adminResetEditToken은 새 editToken을 발급하고 기존 editToken은 무효화한다', async () => {
    const { code, editToken: oldToken } = await api.createLesson({ title: '수업', identityFields: ['name'] })

    const { editToken: newToken } = await api.adminResetEditToken(code, '아무-비밀번호')
    expect(newToken).not.toBe(oldToken)

    // 새 토큰으로는 편집 가능
    await expect(api.getLessonForEdit(code, newToken)).resolves.toMatchObject({ code })
    // 옛 토큰은 더 이상 통하지 않는다
    await expect(api.getLessonForEdit(code, oldToken)).rejects.toThrow()
  })

  // ── 짧은 주소(slug) ──────────────────────────────────────────────
  // 이 규칙들은 apps-script/Code.gs의 setLessonSlug/resolveCode에도 같은 내용으로 있다.
  // 한쪽만 고치면 로컬(mock)과 실서버가 어긋나니 반드시 같이 고칠 것.

  async function publishedLesson(api: MockApiClient) {
    const { code, editToken } = await api.createLesson({ title: '전기와 자기', identityFields: ['name'] })
    await api.saveLesson(code, editToken, { ...choiceLesson(), code, published: true })
    await api.publishLesson(code, editToken)
    return { code, editToken }
  }

  it('짧은 주소로도 학생이 수업에 들어올 수 있다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonSlug(code, editToken, '2-3전기')

    const lesson = await api.getLesson('2-3전기')
    expect(lesson.code).toBe(code) // 실제 코드로 해석돼야 이후 저장·제출이 맞는 수업으로 간다
  })

  it('짧은 주소는 대소문자를 가리지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonSlug(code, editToken, 'Grade2-Elec')
    await expect(api.getLesson('grade2-elec')).resolves.toMatchObject({ code })
  })

  it('이미 다른 수업이 쓰는 짧은 주소는 거부한다', async () => {
    const first = await publishedLesson(api)
    const second = await publishedLesson(api)
    await api.setLessonSlug(first.code, first.editToken, '전기')
    await expect(api.setLessonSlug(second.code, second.editToken, '전기')).rejects.toThrow(ApiError)
  })

  it('같은 수업이 자기 주소를 다시 지정하는 건 허용한다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonSlug(code, editToken, '전기')
    await expect(api.setLessonSlug(code, editToken, '전기')).resolves.toEqual({ slug: '전기' })
  })

  it('수업 코드와 같은 형식(대문자·숫자 6자리)은 짧은 주소로 못 쓴다 — 코드 조회가 먼저라 영영 안 걸린다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await expect(api.setLessonSlug(code, editToken, 'ABC123')).rejects.toThrow(ApiError)
  })

  it('빈 값을 주면 짧은 주소가 해제된다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonSlug(code, editToken, '전기')
    await api.setLessonSlug(code, editToken, '')
    await expect(api.getLesson('전기')).rejects.toThrow(ApiError)
  })

  it('짧은 주소는 수업 JSON에 저장되지 않는다 — index가 유일한 출처', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonSlug(code, editToken, '전기')
    const loaded = await api.getLessonForEdit(code, editToken)
    expect(loaded.slug).toBe('전기') // 편의로 실려 오지만

    await api.saveLesson(code, editToken, loaded) // 되돌려 저장해도
    expect(await api.getLesson('전기')).toMatchObject({ code }) // 주소는 그대로 살아 있고
    await api.setLessonSlug(code, editToken, '') // 해제하면 실제로 해제된다
    await expect(api.getLesson('전기')).rejects.toThrow(ApiError)
  })

  // ── 제출 마감 ────────────────────────────────────────────────────

  it('마감된 수업에는 학생이 저장·제출할 수 없다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonLocked(code, editToken, true)

    const record = { studentKey: 'sk1', identity: { name: '홍길동' }, startedAt: '2026-08-06T00:00:00.000Z', path: ['s1'], answers: { q1: ['a'] }, scores: {}, isTest: false }
    await expect(api.saveProgress(code, record)).rejects.toThrow(/마감/)
    await expect(api.submitResponse(code, { ...record, submittedAt: '2026-08-06T00:10:00.000Z' })).rejects.toThrow(/마감/)
  })

  it('마감을 다시 열면 제출이 정상 동작한다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setLessonLocked(code, editToken, true)
    await api.setLessonLocked(code, editToken, false)

    const record = { studentKey: 'sk1', identity: { name: '홍길동' }, startedAt: '2026-08-06T00:00:00.000Z', path: ['s1'], answers: { q1: ['a'] }, scores: {}, isTest: false, submittedAt: '2026-08-06T00:10:00.000Z' }
    await expect(api.submitResponse(code, record)).resolves.toMatchObject({ scores: { q1: { correct: true } } })
  })

  // ── 개별 응답 삭제 · 보관기간 ─────────────────────────────────────

  it('학생 한 명의 응답만 지운다', async () => {
    const { code, editToken } = await publishedLesson(api)
    const base = { startedAt: '2026-08-06T00:00:00.000Z', path: ['s1'], answers: { q1: ['a'] }, scores: {}, isTest: false }
    await api.saveProgress(code, { ...base, studentKey: 'sk1', identity: { name: '가' } })
    await api.saveProgress(code, { ...base, studentKey: 'sk2', identity: { name: '나' } })

    expect(await api.deleteResponse(code, editToken, 'sk1')).toEqual({ deleted: 1 })
    const remaining = await api.getResults(code, editToken)
    expect(remaining.map((r) => r.studentKey)).toEqual(['sk2'])
  })

  it('보관기간이 지난 응답은 결과를 열 때 정리되고, 기간 내 응답은 남는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
    const base = { path: ['s1'], answers: { q1: ['a'] }, scores: {}, isTest: false }
    await api.saveProgress(code, { ...base, studentKey: 'old', identity: { name: '옛날' }, startedAt: daysAgo(100) })
    await api.saveProgress(code, { ...base, studentKey: 'recent', identity: { name: '최근' }, startedAt: daysAgo(3) })

    const lesson = await api.getLessonForEdit(code, editToken)
    await api.saveLesson(code, editToken, { ...lesson, settings: { ...lesson.settings, retentionDays: 30 } })

    const records = await api.getResults(code, editToken)
    expect(records.map((r) => r.studentKey)).toEqual(['recent'])
  })

  it('보관기간을 정하지 않은 수업의 응답은 아무리 오래돼도 지우지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    const longAgo = new Date(Date.now() - 3650 * 24 * 60 * 60 * 1000).toISOString()
    await api.saveProgress(code, { studentKey: 'old', identity: { name: '옛날' }, startedAt: longAgo, path: ['s1'], answers: { q1: ['a'] }, scores: {}, isTest: false })

    expect(await api.getResults(code, editToken)).toHaveLength(1)
  })

  // ── getLive (수업 중 실시간 모니터링) ─────────────────────────────────────────
  // 이 묶음이 Code.gs의 getLive/touchLastSeen 명세 역할을 한다(CLAUDE.md 규칙 4) —
  // Code.gs는 테스트가 안 돌아가므로 규칙이 갈라지지 않게 여기에 못 박아 둔다.

  const progressOf = (studentKey: string, name: string) => ({
    studentKey,
    identity: { name },
    startedAt: '2026-08-08T00:00:00.000Z',
    path: ['s1'],
    answers: { q1: ['a'] },
    scores: {},
    isTest: false,
  })

  it('getLive는 자동저장한 학생의 마지막 활동 시각을 남긴다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.saveProgress(code, progressOf('k1', '민수'))

    const live = await api.getLive(code, { editToken })
    expect(live.records.map((r) => r.studentKey)).toEqual(['k1'])
    expect(live.lastSeen.k1).toBeTruthy()
    expect(Number.isNaN(Date.parse(live.lastSeen.k1))).toBe(false)
  })

  it('getLive는 서버 시각을 같이 준다 — 경과 시간을 교사 기기 시계로 재면 안 되기 때문', async () => {
    const { code, editToken } = await publishedLesson(api)
    const live = await api.getLive(code, { editToken })
    expect(Number.isNaN(Date.parse(live.serverNow))).toBe(false)
  })

  it('제출해도 마지막 활동 시각이 갱신된다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.submitResponse(code, { ...progressOf('k1', '민수'), scores: {} })

    const live = await api.getLive(code, { editToken })
    expect(live.lastSeen.k1).toBeTruthy()
    expect(live.records[0].submittedAt).toBeTruthy()
  })

  it('교사 테스트 응답은 기록도 활동 시각도 남기지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.saveProgress(code, { ...progressOf('t1', '교사'), isTest: true }, editToken)

    const live = await api.getLive(code, { editToken })
    expect(live.records).toHaveLength(0)
    expect(live.lastSeen.t1).toBeUndefined()
  })

  it('editToken이 없거나 틀리면 getLive를 거부한다', async () => {
    const { code } = await publishedLesson(api)
    await expect(api.getLive(code, { editToken: 'wrong-token' })).rejects.toBeInstanceOf(ApiError)
  })

  // ── 현황 암호 ────────────────────────────────────────────────────────────
  // 편집 키를 짧게 만드는 대신 권한이 낮은 열쇠를 따로 뒀다. **핵심은 "권한이 낮다"는 것**이라,
  // 이 암호로 다른 걸 못 한다는 사실을 여기서 못 박는다(Code.gs도 같은 규칙 — 규칙 4).

  it('현황 암호를 설정하면 그 암호만으로 getLive에 들어갈 수 있다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')

    const live = await api.getLive(code, { viewPassword: '전기와자기' })
    expect(live.records).toBeDefined()
    expect(live.lesson).toBeDefined()
  })

  it('★ 현황 암호로는 수정·발행·삭제·결과조회를 할 수 없다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    const pw = '전기와자기'

    await expect(api.getLessonForEdit(code, pw)).rejects.toThrow(ApiError)
    await expect(api.getResults(code, pw)).rejects.toThrow(ApiError)
    await expect(api.publishLesson(code, pw)).rejects.toThrow(ApiError)
    await expect(api.deleteLesson(code, pw)).rejects.toThrow(ApiError)
    await expect(api.deleteResponse(code, pw, 'k1')).rejects.toThrow(ApiError)
    await expect(api.setLessonLocked(code, pw, true)).rejects.toThrow(ApiError)
    await expect(api.setViewPassword(code, pw, '다른암호')).rejects.toThrow(ApiError)
  })

  it('미제출자 전체 제출은 아직 안 낸 학생만 처리하고 이미 낸 학생은 건드리지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    for (const k of ['k1', 'k2', 'k3']) {
      await api.saveProgress(code, {
      studentKey: `${k}`,
      identity: { name: `학생${k}` },
      startedAt: '2026-08-18T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
      })
    }
    // k3 는 미리 제출해 둔다
    await api.forceSubmit(code, { viewPassword: '전기와자기' }, 'k3')
    const submittedAtBefore = (await api.getLive(code, { viewPassword: '전기와자기' })).records.find((r) => r.studentKey === 'k3')?.submittedAt

    const r = await api.forceSubmitAll(code, { viewPassword: '전기와자기' })
    expect(r.submitted).toBe(2)
    expect(r.skipped).toBe(1)

    const after = await api.getLive(code, { viewPassword: '전기와자기' })
    expect(after.records.every((x) => x.submittedAt)).toBe(true)
    // 이미 낸 학생의 제출 시각은 밀리지 않는다
    expect(after.records.find((x) => x.studentKey === 'k3')?.submittedAt).toBe(submittedAtBefore)
  })

  it('미제출자가 없으면 아무것도 하지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    expect(await api.forceSubmitAll(code, { viewPassword: '전기와자기' })).toEqual({ submitted: 0, skipped: 0, failed: 0 })
  })

  it('틀린 암호로는 전체 제출을 할 수 없다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    await expect(api.forceSubmitAll(code, { viewPassword: '아무거나' })).rejects.toThrow(ApiError)
  })

  // ── 재채점 ───────────────────────────────────────────────────────────────
  // 교사가 정답을 고쳐 재발행하면, 이미 제출된 응답의 점수는 옛 정답으로 매겨진 채 남는다.

  it('정답을 고친 뒤 재채점하면 이미 제출된 점수가 새 정답 기준으로 바뀐다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.submitResponse(code, {
      studentKey: 'k1',
      identity: { name: '홍길동' },
      startedAt: '2026-08-18T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['b'] },
      scores: {},
      isTest: false,
    })
    const first = await api.getResults(code, editToken)
    expect(first[0].scores.q1?.correct).toBe(false)

    // 정답을 b 로 고쳐 저장 (자동저장과 같은 경로)
    const lesson = await api.getLessonForEdit(code, editToken)
    const q = lesson.slides[0].blocks.find((b) => b.type === 'question')
    if (q && q.type === 'question') (q.q as { answer: string[] }).answer = ['b']
    await api.saveLesson(code, editToken, lesson)

    const r = await api.regradeResponses(code, editToken)
    expect(r.regraded).toBe(1)

    const after = await api.getResults(code, editToken)
    expect(after[0].scores.q1?.correct).toBe(true)
    // 학생이 쓴 답은 그대로다 — 점수만 다시 계산한다
    expect(after[0].answers.q1).toEqual(['b'])
  })

  it('아직 제출하지 않은 학생은 재채점 대상이 아니다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.saveProgress(code, {
      studentKey: 'k1',
      identity: { name: '홍길동' },
      startedAt: '2026-08-18T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })
    expect((await api.regradeResponses(code, editToken)).regraded).toBe(0)
  })

  it('재채점은 편집 키가 있어야 한다 — 현황 암호로는 못 한다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    await expect(api.regradeResponses(code, '전기와자기')).rejects.toThrow(ApiError)
  })

  // ── 강제 제출 ────────────────────────────────────────────────────────────
  // 답을 지우거나 고치지 않고 **마감만** 하므로 현황 암호로도 되게 했다(2026-08-18 사용자 결정).
  // 삭제류는 여전히 편집 키 전용이다 — 위 ★ 테스트가 그것을 못 박는다.

  it('강제 제출은 현황 암호로도 된다 — 저장된 답 그대로 채점하고 제출 시각만 찍는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    await api.saveProgress(code, {
      studentKey: 'k1',
      identity: { name: '홍길동' },
      startedAt: '2026-08-18T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    const before = await api.getLive(code, { viewPassword: '전기와자기' })
    expect(before.records[0].submittedAt).toBeUndefined()

    const r = await api.forceSubmit(code, { viewPassword: '전기와자기' }, 'k1')
    expect(r.alreadySubmitted).toBe(false)

    const after = await api.getLive(code, { viewPassword: '전기와자기' })
    expect(after.records[0].submittedAt).toBeTruthy()
    // 답은 그대로 남아 있어야 한다 — 마감만 하는 기능이다
    expect(after.records[0].answers).toEqual(before.records[0].answers)
  })

  it('이미 제출한 학생을 다시 눌러도 제출 시각이 밀리지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    await api.saveProgress(code, {
      studentKey: 'k1',
      identity: { name: '홍길동' },
      startedAt: '2026-08-18T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })

    const first = await api.forceSubmit(code, { viewPassword: '전기와자기' }, 'k1')
    const second = await api.forceSubmit(code, { viewPassword: '전기와자기' }, 'k1')
    expect(second.alreadySubmitted).toBe(true)
    expect(second.submittedAt).toBe(first.submittedAt)
  })

  it('틀린 암호로는 강제 제출을 할 수 없다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    await api.saveProgress(code, {
      studentKey: 'k1',
      identity: { name: '홍길동' },
      startedAt: '2026-08-18T00:00:00.000Z',
      path: ['s1'],
      answers: { q1: ['a'] },
      scores: {},
      isTest: false,
    })
    await expect(api.forceSubmit(code, { viewPassword: '아무거나' }, 'k1')).rejects.toThrow(ApiError)
  })

  it('없는 학생을 강제 제출하면 거부한다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    await expect(api.forceSubmit(code, { viewPassword: '전기와자기' }, '없는키')).rejects.toThrow(ApiError)
  })

  it('getLive가 주는 수업에는 정답이 들어 있지 않다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')

    const live = await api.getLive(code, { viewPassword: '전기와자기' })
    const block = live.lesson.slides[0].blocks[0]
    if (block.type !== 'question' || block.q.kind !== 'choice') throw new Error('테스트 픽스처가 잘못됐습니다')
    expect(block.q.answer).toBeUndefined()
  })

  it('암호를 설정하지 않았으면 아무 암호로도 못 들어간다 (편집 키만이 길이다)', async () => {
    const { code } = await publishedLesson(api)
    await expect(api.getLive(code, { viewPassword: '아무거나' })).rejects.toThrow(ApiError)
  })

  it('틀린 암호는 거부하고, 맞으면 통과한다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')

    await expect(api.getLive(code, { viewPassword: '틀린암호' })).rejects.toThrow(ApiError)
    await expect(api.getLive(code, { viewPassword: '전기와자기' })).resolves.toBeDefined()
  })

  it('약한 암호는 애초에 설정되지 않는다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await expect(api.setViewPassword(code, editToken, '123456')).rejects.toThrow(ApiError)
    await expect(api.setViewPassword(code, editToken, '과학')).rejects.toThrow(ApiError)
    await expect(api.setViewPassword(code, editToken, code)).rejects.toThrow(ApiError)
  })

  it('해제하면 다시 편집 키로만 들어갈 수 있다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')
    const cleared = await api.setViewPassword(code, editToken, '')
    expect(cleared.hasViewPassword).toBe(false)

    await expect(api.getLive(code, { viewPassword: '전기와자기' })).rejects.toThrow(ApiError)
    await expect(api.getLive(code, { editToken })).resolves.toBeDefined()
  })

  it('설정 여부는 교사에게만, 그것도 여부만 알려준다 (해시는 절대 안 나간다)', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')

    const forEdit = await api.getLessonForEdit(code, editToken)
    expect(forEdit.hasViewPassword).toBe(true)
    // 학생용 응답에는 흔적조차 없어야 한다 — 해시가 나가면 자기 기기에서 마음껏 대입해 볼 수 있다
    expect(JSON.stringify(await api.getLesson(code))).not.toContain('ViewPassword')
    expect(JSON.stringify(await api.getLesson(code))).not.toContain('전기와자기')
  })

  it('틀린 암호를 반복하면 잠긴다 (사람이 정한 값이라 대입 속도를 서버가 눌러야 한다)', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.setViewPassword(code, editToken, '전기와자기')

    for (let i = 0; i < VIEW_FAIL_LIMIT; i++) {
      await expect(api.getLive(code, { viewPassword: '틀림' })).rejects.toThrow(ApiError)
    }
    // 이제는 맞는 암호를 넣어도 잠금 때문에 막힌다
    await expect(api.getLive(code, { viewPassword: '전기와자기' })).rejects.toThrow(/시도가 너무 많아/)
    // 편집 키는 잠금과 무관하다 — 남이 일부러 틀려서 교사를 못 들어오게 만들면 안 된다
    await expect(api.getLive(code, { editToken })).resolves.toBeDefined()
  })

  it('수업을 지우면 활동 시각도 같이 사라진다', async () => {
    const { code, editToken } = await publishedLesson(api)
    await api.saveProgress(code, progressOf('k1', '민수'))
    await api.deleteLesson(code, editToken)

    // 같은 코드가 다시 발급돼도 옛 활동 기록이 섞이면 안 된다
    await expect(api.getLive(code, { editToken })).rejects.toBeInstanceOf(ApiError)
  })
})
