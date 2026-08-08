import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, FilePlus, Pencil, QrCode, Upload } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { BusyOverlay } from '../components/BusyOverlay'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { QrCodeButton } from '../components/QrCode'
import { buildPlayLink, saveEditToken, saveLiveSecret } from '../lib/editorAuth'
import { importLessonJson } from '../lib/portable'

export default function HomePage() {
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [qrPanelOpen, setQrPanelOpen] = useState(false)
  const [qrCode, setQrCode] = useState('')
  /**
   * "수업 수정하기"와 "수업 현황"은 물어보는 것이 똑같다(코드 + 편집 키) — 패널을 둘로 복제하지
   * 않고 하나를 공유하고, 어느 버튼으로 열었는지만 기억한다. 열려 있는 것이 언제나 하나뿐이라
   * 화면도 덜 복잡하다.
   */
  const [codePanel, setCodePanel] = useState<null | 'edit' | 'live'>(null)
  const [editCode, setEditCode] = useState('')
  const [editKey, setEditKey] = useState('')
  const [rememberEditKey, setRememberEditKey] = useState(true)
  const navigate = useNavigate()

  async function handleCreateLesson() {
    setCreating(true)
    try {
      const { code: newCode, editToken } = await api.createLesson({ title: '새 수업', identityFields: ['name'] })
      saveEditToken(newCode, editToken, rememberEditKey)
      navigate(`/editor/${newCode}`)
    } finally {
      setCreating(false)
    }
  }

  /**
   * 두 번째 칸(열쇠)은 **선택 입력**이다 — 이 브라우저에 이미 저장돼 있으면 코드만으로 열리고,
   * 없으면 목적지 화면이 알아서 물어본다.
   *
   * 목적지에 따라 넣는 값도 처리도 다르다:
   *  · 수정하기 → **편집 키**. 기존 복구 링크 처리(`?key=...`)를 그대로 탄다.
   *  · 현황 보기 → **현황 암호 또는 편집 키**. 주소에 실어 보내지 않고 저장만 하며,
   *    생김새를 보고 맞는 자리에 넣는다(`saveLiveSecret`).
   */
  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedCode = editCode.trim().toUpperCase()
    if (trimmedCode.length < 4) return
    const trimmedKey = editKey.trim()

    if (codePanel === 'live') {
      // 여기서 받는 값은 현황 암호일 수도, 편집 키일 수도 있다 — 생김새를 보고 맞는 자리에
      // 저장한다(`saveLiveSecret`). 무조건 편집 키로 저장하면 서버가 엉뚱한 항목으로 대조해
      // 조용히 거부한다. 값이 맞는지는 /live 화면이 열리면서 확인하고, 틀리면 거기서 다시 묻는다.
      if (trimmedKey) saveLiveSecret(trimmedCode, trimmedKey, rememberEditKey)
      navigate(`/live/${trimmedCode}`)
      return
    }

    if (trimmedKey) {
      saveEditToken(trimmedCode, trimmedKey, rememberEditKey)
      navigate(`/editor/${trimmedCode}?key=${encodeURIComponent(trimmedKey)}`)
    } else {
      navigate(`/editor/${trimmedCode}`)
    }
  }

  /** 패널은 한 번에 하나만 연다 — 같은 버튼을 다시 누르면 닫힌다. */
  function toggleCodePanel(which: 'edit' | 'live') {
    setCodePanel((prev) => (prev === which ? null : which))
    setQrPanelOpen(false)
  }

  async function handleImportFile(file: File) {
    setImportError(null)
    setImporting(true)
    try {
      const text = await file.text()
      const imported = importLessonJson(text)
      const { code: newCode, editToken } = await api.createLesson({
        title: imported.title,
        identityFields: imported.settings.identityFields,
      })
      saveEditToken(newCode, editToken, rememberEditKey)
      await api.saveLesson(newCode, editToken, { ...imported, code: newCode, published: false, updatedAt: new Date().toISOString() })
      navigate(`/editor/${newCode}`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '수업 파일을 가져오지 못했습니다')
    } finally {
      setImporting(false)
    }
  }

  return (
    <PageShell>
      <PageTitle>웅T's 학습지</PageTitle>
      <p className="mt-2 text-neutral-500">수업 코드를 입력해 참여하거나, 새 수업을 만들어 보세요.</p>

      <div className="mt-8 flex flex-col gap-3">
        <label className="text-sm font-medium text-neutral-700" htmlFor="lesson-code">
          수업 코드
        </label>
        <input
          id="lesson-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예: 7F3K9Q"
          maxLength={6}
          className="tap-target rounded-lg border border-neutral-300 bg-neutral-0 px-4 text-lg tracking-widest outline-none focus:border-accent-500"
        />
        <Button disabled={code.length < 4} onClick={() => navigate(`/play/${code}`)}>
          수업 참여하기
        </Button>
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-6">
        <p className="text-sm text-neutral-500">교사이신가요?</p>
        {/*
          셋 다 secondary라 위계가 없던 것을 리드 액션 하나(새 수업 만들기)만 secondary로 남기고
          나머지는 ghost로 낮췄다. 이 화면의 유일한 primary는 위쪽 "수업 참여하기"(학생용)로 남긴다
          — primary가 둘이면 화면의 초점이 흐려진다.
        */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handleCreateLesson()} disabled={creating}>
            <Icon icon={FilePlus} />
            {creating ? '만드는 중…' : '새 수업 만들기'}
          </Button>
          <Button variant="secondary" onClick={() => toggleCodePanel('edit')}>
            <Icon icon={Pencil} />
            수업 수정하기
          </Button>
          {/* 수업 중에 쓰는 버튼이라 만들기·수정하기와 같은 줄, 같은 위계에 둔다 */}
          <Button variant="secondary" onClick={() => toggleCodePanel('live')}>
            <Icon icon={Activity} />
            수업 현황 보기
          </Button>
          <Button variant="ghost" onClick={() => importInputRef.current?.click()} disabled={importing}>
            <Icon icon={Upload} />
            {importing ? '가져오는 중…' : '수업 파일(.json) 가져오기'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setQrPanelOpen((v) => !v)
              setCodePanel(null)
            }}
          >
            <Icon icon={QrCode} />
            QR코드 생성하기
          </Button>
        </div>
        <label className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
          <input type="checkbox" checked={rememberEditKey} onChange={(e) => setRememberEditKey(e.target.checked)} />
          이 브라우저에 편집 키·현황 암호 저장(기본값 — 공용 PC라면 꺼두세요, 탭을 닫으면 사라져요)
        </label>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ''
          }}
        />
        {importError && <p className="mt-2 text-sm text-danger">{importError}</p>}

        {codePanel && (
          <form onSubmit={handleCodeSubmit} className="mt-3 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-600" htmlFor="edit-lesson-code">
                {codePanel === 'live' ? '진행 상황을 볼 수업의 코드를 입력하세요' : '수정할 수업의 코드를 입력하세요'}
              </label>
              <input
                id="edit-lesson-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                placeholder="예: 7F3K9Q"
                maxLength={6}
                className="tap-target w-36 rounded border border-neutral-300 bg-neutral-0 px-3 text-sm tracking-widest outline-none focus:border-accent-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-600" htmlFor="edit-lesson-key">
                {codePanel === 'live'
                  ? '현황 암호 또는 편집 키 (이 브라우저에서 열어본 적 있으면 비워두세요)'
                  : '편집 키 (이 브라우저에서 만든 수업이면 비워두세요)'}
              </label>
              <input
                id="edit-lesson-key"
                type={codePanel === 'live' ? 'password' : 'text'}
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder={codePanel === 'live' ? '현황 암호 입력' : '편집 키 붙여넣기'}
                autoComplete={codePanel === 'live' ? 'current-password' : 'off'}
                className="tap-target w-full rounded border border-neutral-300 bg-neutral-0 px-3 text-sm outline-none focus:border-accent-500"
              />
            </div>
            <Button type="submit" disabled={editCode.trim().length < 4}>
              {codePanel === 'live' ? '수업 현황 보기' : '수정 화면으로 이동'}
            </Button>
          </form>
        )}

        {qrPanelOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-600" htmlFor="qr-lesson-code">
                이미 만든 수업의 코드를 입력하면, 학생이 코드 입력 없이 바로 들어오는 QR코드·링크가 생겨요
              </label>
              <input
                id="qr-lesson-code"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                placeholder="예: 7F3K9Q"
                maxLength={6}
                className="tap-target w-36 rounded border border-neutral-300 bg-neutral-0 px-3 text-sm tracking-widest outline-none focus:border-accent-500"
              />
            </div>
            {qrCode.length >= 4 && <QrCodeButton value={buildPlayLink(qrCode)} label={`수업 ${qrCode} 참여 QR코드`} />}
          </div>
        )}
      </div>

      <div className="mt-10 text-center">
        <button type="button" onClick={() => navigate('/admin')} className="tap-target text-xs text-neutral-400 underline">
          관리자
        </button>
      </div>

      {creating && <BusyOverlay message="새 수업을 만드는 중입니다…" />}
      {importing && <BusyOverlay message="수업 파일을 가져오는 중입니다…" />}
    </PageShell>
  )
}
