import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { countBySeverity, type PreflightIssue } from '../lib/preflight'

interface PreflightDialogProps {
  issues: PreflightIssue[]
  /** 이미 한 번 발행한 수업인지 — 버튼 문구를 "다시 발행"으로 바꾼다 */
  published: boolean
  publishing: boolean
  onGoToSlide: (slideId: string) => void
  onPublish: () => void
  onClose: () => void
}

/**
 * 발행 버튼을 누르면 먼저 뜨는 점검 목록.
 *
 * 문제가 있어도 발행 자체는 막지 않는다 — 수업을 반쯤 만든 상태로 미리 나눠주거나, 이미지·
 * 임베드를 일부러 나중에 채우는 진행 방식이 실제로 있기 때문이다. 대신 무엇이 비어 있는지
 * 반드시 한 번은 보게 만들고, 항목을 누르면 그 슬라이드로 바로 이동시킨다.
 */
export function PreflightDialog({ issues, published, publishing, onGoToSlide, onPublish, onClose }: PreflightDialogProps) {
  const counts = countBySeverity(issues)
  const clean = issues.length === 0

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-label="점검 창 닫기" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="발행 전 점검"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border border-neutral-200 bg-neutral-0 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:w-[32rem] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-lg font-semibold">발행 전 점검</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {clean
              ? '학생 화면에서 비어 보일 만한 곳을 찾지 못했어요.'
              : `고쳐야 할 것 ${counts.error}개 · 확인할 것 ${counts.warn}개`}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {clean ? (
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <Icon icon={CircleCheck} className="text-success" />
              바로 발행해도 됩니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {issues.map((issue, i) => {
                const isError = issue.severity === 'error'
                const body = (
                  <>
                    <Icon
                      icon={isError ? CircleAlert : TriangleAlert}
                      className={`mt-0.5 shrink-0 ${isError ? 'text-danger' : 'text-warn'}`}
                    />
                    <span className="min-w-0">
                      {issue.slideNumber && <span className="mr-1 font-medium text-neutral-500">슬라이드 {issue.slideNumber}</span>}
                      {issue.message}
                    </span>
                  </>
                )
                return (
                  <li key={`${issue.slideId ?? ''}-${i}`}>
                    {issue.slideId ? (
                      <button
                        type="button"
                        onClick={() => onGoToSlide(issue.slideId as string)}
                        className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex items-start gap-2 px-2 py-1.5 text-sm">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            더 고치기
          </Button>
          <Button size="sm" onClick={onPublish} disabled={publishing}>
            {publishing ? '발행 중…' : published ? '이대로 다시 발행' : '이대로 발행'}
          </Button>
        </div>
      </div>
    </>
  )
}
