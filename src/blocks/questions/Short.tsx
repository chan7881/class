import { registerQuestion } from './registry'
import { QuestionEditorShell } from './QuestionEditorShell'
import { matchKeywordGroups } from '../../lib/keywordMatch'
import { normalizeAnswerText } from '../../lib/textNormalize'
import type { QuestionEditorProps, QuestionViewerProps } from './types'
import type { ShortQuestion } from '../../types/lesson'

function Editor({ question, onChange }: QuestionEditorProps<ShortQuestion>) {
  const answerText = (question.answer ?? []).join('\n')
  const matchMode = question.matchMode ?? 'exact'

  return (
    <QuestionEditorShell question={question} onChange={onChange}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          입력칸 줄 수
          <input
            type="number"
            min={1}
            max={10}
            value={question.rows}
            onChange={(e) => onChange({ ...question, rows: Math.max(1, Number(e.target.value)) })}
            className="tap-target w-14 rounded border border-neutral-300 px-1 text-center"
          />
        </label>
        <label className="flex items-center gap-1">
          채점 방식
          <select
            value={matchMode}
            onChange={(e) => onChange({ ...question, matchMode: e.target.value as ShortQuestion['matchMode'] })}
            className="tap-target rounded border border-neutral-300 px-1"
          >
            <option value="exact">정확히 일치</option>
            <option value="contains">키워드 포함</option>
            <option value="keywords">필수 키워드 조합 (AND/OR)</option>
            <option value="none">채점 안함</option>
          </select>
        </label>
      </div>
      {matchMode === 'none' ? (
        <p className="mt-2 text-xs text-neutral-500">
          이 문항은 정오답을 채점하지 않아요. 결과 화면에는 맞았는지 틀렸는지 대신, 학생이 쓴 답만 중립적인 상자로 보여줘요(서술·성찰형 문항에
          적합).
        </p>
      ) : matchMode === 'keywords' ? (
        <div className="mt-2">
          <input
            value={question.keywordExpr ?? ''}
            onChange={(e) => onChange({ ...question, keywordExpr: e.target.value })}
            placeholder="예: 지진,(흔들림, 떨림), 땅"
            className="tap-target w-full rounded border border-neutral-300 px-2 text-sm outline-none focus:border-accent-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            쉼표(,)로 구분한 단어는 전부 들어가야 정답(AND), 괄호 안을 쉼표로 구분하면 그중 하나만 있어도 인정(OR, 유사어용)이에요. 일부만
            맞으면 절반 점수를 주고 오답으로 표시해요.
          </p>
        </div>
      ) : (
        <textarea
          value={answerText}
          onChange={(e) => onChange({ ...question, answer: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
          placeholder={'정답으로 인정할 답을 한 줄에 하나씩 (자동채점 없이 서답형만 쓰려면 비워두세요)'}
          rows={2}
          className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-accent-500"
        />
      )}
    </QuestionEditorShell>
  )
}

function Viewer({ question, value, onChange, disabled }: QuestionViewerProps<ShortQuestion>) {
  return (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={question.rows}
      placeholder="답을 입력하세요"
      className="tap-target w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-accent-500 disabled:bg-neutral-50"
    />
  )
}

registerQuestion<ShortQuestion>({
  kind: 'short',
  label: '서답형',
  createDefault: (id) => ({ id, kind: 'short', prompt: '', required: true, points: 10, rows: 2, matchMode: 'exact' }),
  Editor,
  Viewer,
  grade: (question, value) => {
    if (question.matchMode === 'none') return null
    const rawGiven = typeof value === 'string' ? value : ''
    if (question.matchMode === 'keywords') {
      // 키워드식을 아직 안 정해뒀으면(빈 문자열) 채점 대상이 아니다 — 항상 오답 처리하면
      // 자유 서술만 받으려던 문항까지 자동으로 틀린 걸로 나온다(2026-07-30 QA에서 발견).
      if (!(question.keywordExpr ?? '').trim()) return null
      const { totalGroups, matchedGroups } = matchKeywordGroups(rawGiven, question.keywordExpr ?? '')
      if (matchedGroups === 0) return { correct: false, points: 0 }
      if (matchedGroups === totalGroups) return { correct: true, points: question.points }
      return { correct: false, partial: true, points: question.points / 2 }
    }
    // 정답을 하나도 안 정해뒀으면(에디터 placeholder가 "자동채점 없이 서답형만 쓰려면
    // 비워두세요"라고 안내하는 바로 그 경우) 채점 대상에서 제외한다 — 이전엔 무조건
    // 오답 처리돼 자유 서술 문항까지 점수가 깎였다.
    const answers = (question.answer ?? []).map(normalizeAnswerText)
    if (answers.length === 0) return null
    const given = normalizeAnswerText(rawGiven)
    const correct = given.length > 0 && (question.matchMode === 'contains' ? answers.some((a) => given.includes(a)) : answers.includes(given))
    return { correct, points: correct ? question.points : 0 }
  },
  isAnswered: (_question, value) => typeof value === 'string' && value.trim().length > 0,
  describeAnswer: (question) => {
    if (question.matchMode === 'none') return null
    if (question.matchMode === 'keywords') return question.keywordExpr || null
    return (question.answer ?? []).length > 0 ? question.answer!.join(' 또는 ') : null
  },
})
