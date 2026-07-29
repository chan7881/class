import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { CSSProperties } from 'react'

/** value(링크)로 QR 데이터 URL(PNG)을 만든다. 외부 QR 생성 API를 쓰지 않는 이유는
 *  docs/DECISIONS.md 참고(네트워크 의존·수업 코드 노출을 피하려고 클라이언트에서 직접 그린다). */
function useQrDataUrl(value: string, size: number): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])
  return url
}

/**
 * 작은 QR 썸네일 — 클릭하면 화면 가득 채우는 확대 모달을 연다(학생이 스캔하기 쉽게).
 * 학생용 직접 입장 링크(수업 코드 없이 QR/링크로 바로 입장)에 쓴다.
 */
export function QrCodeButton({ value, label }: { value: string; label: string }) {
  const [expanded, setExpanded] = useState(false)
  const thumbUrl = useQrDataUrl(value, 96)
  const bigUrl = useQrDataUrl(value, 512)

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="tap-target flex items-center gap-2 rounded border border-neutral-300 bg-neutral-0 px-2 text-sm text-neutral-600 hover:bg-neutral-50"
        aria-label={`${label} QR코드 확대`}
      >
        {thumbUrl ? <img src={thumbUrl} alt="" className="h-8 w-8" /> : <span className="h-8 w-8 rounded bg-neutral-100" />}
        QR코드
      </button>

      {expanded && (
        // 화면(특히 가로로 짧은 창)보다 내용(제목+이미지+링크+버튼)이 길어질 수 있어
        // overflow-y-auto가 없으면 "닫기" 버튼이 화면 밖으로 밀려 클릭할 수 없었다(실기기 검증으로
        // 발견) — 바깥은 스크롤 컨테이너로, 안쪽은 min-h-full로 짧을 땐 그대로 중앙 정렬되게 분리했다.
        // 배경은 다크모드에서도 일부러 흰색 그대로 둔다 — QR코드는 배경이 실제로 흰색이어야 스캔
        // 앱이 안정적으로 인식한다(bg-neutral-0으로 바꾸면 다크모드에서 어두운 배경 위에 어두운
        // 여백의 QR이 되어 스캔이 어려워질 수 있다). 배경만 고정하고 안의 글자색은 그대로 두면
        // text-neutral-900 등이 다크모드에서 밝은 색으로 뒤집혀 흰 배경 위에 흰 글자가 되는
        // 사고가 나서(실제로 발견됨), 이 카드 안에서만 회색 스케일을 라이트 모드 값으로 고정한다.
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-white"
          style={
            {
              '--color-neutral-300': '#d4d4d8',
              '--color-neutral-400': '#a1a1aa',
              '--color-neutral-500': '#71717a',
              '--color-neutral-600': '#52525b',
              '--color-neutral-900': '#18181b',
            } as CSSProperties
          }
          onClick={() => setExpanded(false)}
          role="button"
          tabIndex={0}
          aria-label="닫기"
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
            <p className="text-center text-lg font-medium text-neutral-900">{label}</p>
            {bigUrl ? (
              <img src={bigUrl} alt={`${label} QR코드`} className="h-auto w-full max-w-[min(90vw,70vh)]" />
            ) : (
              <p className="text-neutral-400">QR코드를 만드는 중…</p>
            )}
            <p className="break-all text-center text-sm text-neutral-500">{value}</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="tap-target rounded-lg border border-neutral-300 px-4 text-sm text-neutral-600"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
