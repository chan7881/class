import { describe, expect, it } from 'vitest'
import { stripAnswers } from './stripAnswers'
import type { Lesson, Question } from '../types/lesson'

/**
 * 학생용 `getLesson`이 내려주는 수업 JSON에 정답이 섞여 나가지 않는지 지킨다 (CLAUDE.md 규칙 3).
 * 이 파일이 지키는 건 프론트엔드(목 백엔드)뿐이다 — 실제 서버는 apps-script/Code.gs의
 * `stripQuestionAnswer`가 같은 일을 하므로, 여기에 케이스를 추가하면 Code.gs도 같이 고쳐야 한다.
 */

function lessonWith(q: Question): Lesson {
  return {
    version: 3,
    code: 'ABC123',
    title: '테스트',
    accent: '#2563eb',
    published: true,
    settings: {
      requireAnswerToAdvance: false,
      allowBackNavigation: true,
      feedbackMode: 'onFinish',
      identityFields: ['name'],
      shuffleChoices: false,
      referencePanel: { enabled: false, tabs: [] },
    },
    slides: [{ id: 's1', isSub: false, blocks: [{ id: 'b1', type: 'question', q }] }],
    updatedAt: '2026-08-06T00:00:00.000Z',
  }
}

function firstQuestion(lesson: Lesson): Question {
  const block = lesson.slides[0].blocks[0]
  if (block.type !== 'question') throw new Error('문항 블록이 아님')
  return block.q
}

describe('stripAnswers', () => {
  it('해설은 항상 제거한다', () => {
    const stripped = firstQuestion(
      stripAnswers(
        lessonWith({ id: 'q1', kind: 'short', prompt: '', required: true, points: 10, rows: 2, matchMode: 'exact', answer: ['정답'], explanation: '해설입니다' }),
      ),
    )
    expect(stripped.explanation).toBeUndefined()
  })

  it('선택형·수치형 등 answer 필드는 제거한다', () => {
    const choice = firstQuestion(
      stripAnswers(
        lessonWith({
          id: 'q1',
          kind: 'choice',
          prompt: '',
          required: true,
          points: 10,
          multiple: false,
          options: [{ id: 'a', label: '가' }],
          answer: ['a'],
        }),
      ),
    )
    expect('answer' in choice).toBe(false)
    // 보기 자체는 학생이 봐야 하므로 남아 있어야 한다
    expect(choice.kind === 'choice' && choice.options.length).toBe(1)
  })

  it('빈칸채우기는 각 빈칸의 정답만 지우고 지문 구조는 남긴다', () => {
    const cloze = firstQuestion(
      stripAnswers(
        lessonWith({
          id: 'q1',
          kind: 'cloze',
          prompt: '',
          required: true,
          points: 10,
          segments: [
            { t: 'text', v: '전압이 ' },
            { t: 'blank', mode: 'select', options: ['커', '작아'], answer: ['커'] },
            { t: 'text', v: '진다' },
          ],
        }),
      ),
    )
    if (cloze.kind !== 'cloze') throw new Error('kind가 바뀌면 안 된다')
    expect(cloze.segments).toHaveLength(3)
    const blank = cloze.segments[1]
    expect(blank.t === 'blank' && blank.answer).toBeUndefined()
    // 드롭다운 보기는 학생이 골라야 하므로 남아 있어야 한다
    expect(blank.t === 'blank' && blank.options).toEqual(['커', '작아'])
  })

  it('서답형 키워드 채점식(keywordExpr)도 제거한다 — 사실상 정답이라 노출되면 안 된다', () => {
    const short = firstQuestion(
      stripAnswers(
        lessonWith({
          id: 'q1',
          kind: 'short',
          prompt: '',
          required: true,
          points: 10,
          rows: 2,
          matchMode: 'keywords',
          keywordExpr: '지진,(흔들림, 떨림), 땅',
        }),
      ),
    )
    expect('keywordExpr' in short).toBe(false)
    // 채점 모드 자체는 정답이 아니므로 남겨도 무방하다(학생 화면 렌더링에 쓰이지 않지만 무해)
    expect(short.kind).toBe('short')
  })

  it('원본 수업 객체는 건드리지 않는다(교사 편집 화면이 같은 객체를 쓰고 있을 수 있다)', () => {
    const original = lessonWith({
      id: 'q1',
      kind: 'short',
      prompt: '',
      required: true,
      points: 10,
      rows: 2,
      matchMode: 'keywords',
      keywordExpr: '지진, 땅',
    })
    stripAnswers(original)
    const q = firstQuestion(original)
    expect(q.kind === 'short' && q.keywordExpr).toBe('지진, 땅')
  })
})
