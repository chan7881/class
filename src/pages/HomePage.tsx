import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus, Pencil, QrCode, Upload } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { PageShell } from '../components/PageShell'
import { PageTitle } from '../components/PageTitle'
import { QrCodeButton } from '../components/QrCode'
import { buildPlayLink, saveEditToken } from '../lib/editorAuth'
import { importLessonJson } from '../lib/portable'

export default function HomePage() {
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [qrPanelOpen, setQrPanelOpen] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [editPanelOpen, setEditPanelOpen] = useState(false)
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
   * 편집 키는 선택 입력이다 — 이 브라우저에 이미 저장돼 있으면(수업을 만든 그 기기) 코드만으로
   * 바로 열리고, 없으면 EditorPage가 "편집 키가 필요합니다" 화면으로 알아서 물어본다.
   * 키를 함께 넣으면 EditorPage의 기존 복구 링크 처리(?key=...)를 그대로 탄다.
   */
  function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedCode = editCode.trim().toUpperCase()
    if (trimmedCode.length < 4) return
    const trimmedKey = editKey.trim()
    if (trimmedKey) {
      saveEditToken(trimmedCode, trimmedKey, rememberEditKey)
      navigate(`/editor/${trimmedCode}?key=${encodeURIComponent(trimmedKey)}`)
    } else {
      navigate(`/editor/${trimmedCode}`)
    }
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
          <Button
            variant="secondary"
            onClick={() => {
              setEditPanelOpen((v) => !v)
              setQrPanelOpen(false)
            }}
          >
            <Icon icon={Pencil} />
            수업 수정하기
          </Button>
          <Button variant="ghost" onClick={() => importInputRef.current?.click()} disabled={importing}>
            <Icon icon={Upload} />
            {importing ? '가져오는 중…' : '수업 파일(.json) 가져오기'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setQrPanelOpen((v) => !v)
              setEditPanelOpen(false)
            }}
          >
            <Icon icon={QrCode} />
            QR코드 생성하기
          </Button>
        </div>
        <label className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
          <input type="checkbox" checked={rememberEditKey} onChange={(e) => setRememberEditKey(e.target.checked)} />
          이 브라우저에 편집 키 저장(기본값 — 공용 PC라면 꺼두세요, 탭을 닫으면 편집 권한이 사라져요)
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

        {editPanelOpen && (
          <form onSubmit={handleEditSubmit} className="mt-3 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-600" htmlFor="edit-lesson-code">
                수정할 수업의 코드를 입력하세요
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
                편집 키 (이 브라우저에서 만든 수업이면 비워두세요)
              </label>
              <input
                id="edit-lesson-key"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder="편집 키 붙여넣기"
                className="tap-target w-full rounded border border-neutral-300 bg-neutral-0 px-3 text-sm outline-none focus:border-accent-500"
              />
            </div>
            <Button type="submit" disabled={editCode.trim().length < 4}>
              수정 화면으로 이동
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
    </PageShell>
  )
}
