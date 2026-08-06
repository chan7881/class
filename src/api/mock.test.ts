import { beforeEach, describe, expect, it } from 'vitest'
import { registerGrader } from '../lib/grade'
import type { ChoiceQuestion, Lesson } from '../types/lesson'
import { ApiError, MockApiClient } from './mock'

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
})
