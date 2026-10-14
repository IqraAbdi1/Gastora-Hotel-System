import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useRequests } from '../procurement/requestsContext'
import { LOSS_REASONS, NEEDS_PHOTO, formatUGX } from '../procurement/requestsModel'
import type { LossReason, StockItem } from '../procurement/requestsModel'
import { EvidenceThumb } from './Evidence'

// Shrinks the photo so it stays small in the sample data.
function readPhoto(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('This file is not a picture.'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not process the picture.'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function ReportLossDialog({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const { can } = useAuth()
  const { reportLoss, lossLimit, losses } = useRequests()
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<LossReason>('Broken')
  const [note, setNote] = useState('')
  const [lastSeen, setLastSeen] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const [error, setError] = useState('')

  const waiting = losses
    .filter((l) => l.itemId === item.id && l.status === 'Waiting approval')
    .reduce((s, l) => s + l.qty, 0)
  const n = Math.max(0, parseInt(qty, 10) || 0)
  const value = n * item.unitCost
  const needsPhoto = NEEDS_PHOTO.includes(reason)
  const waits = lossLimit > 0 && value > lossLimit && !can('approveRequest')

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      setPhoto(await readPhoto(file))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the photo.')
    }
  }

  function save() {
    const res = reportLoss({ itemId: item.id, qty: n, reason, note, lastSeen, evidence: photo })
    if (res.ok) onClose()
    else setError(res.error)
  }

  const field = 'mt-1 block w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5">
        <div>
          <h2 className="text-lg font-bold">Report damaged or lost</h2>
          <p className="text-sm text-ink/60">
            {item.name}: {item.onHand} {item.unit} on hand
            {waiting > 0 && `, ${waiting} already waiting approval`}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-ink/60">
            Quantity ({item.unit})
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={field} />
          </label>
          <label className="block text-xs font-medium text-ink/60">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value as LossReason)} className={field}>
              {LOSS_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>

        {needsPhoto && (
          <div className="text-xs font-medium text-ink/60">
            Photo (required)
            <div className="mt-1 flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void pick(e.target.files?.[0])}
                className="block w-full text-sm"
              />
              {photo && <EvidenceThumb src={photo} />}
            </div>
          </div>
        )}

        {reason === 'Lost' && (
          <label className="block text-xs font-medium text-ink/60">
            Where and when was it last seen? (required)
            <input
              value={lastSeen}
              onChange={(e) => setLastSeen(e.target.value)}
              placeholder="For example: Linen store, Monday evening"
              className={field}
            />
          </label>
        )}

        <label className="block text-xs font-medium text-ink/60">
          What happened? (required)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={field} />
        </label>

        {n > 0 && (
          <p className={`text-sm ${waits ? 'text-warn' : 'text-ink/60'}`}>
            Value written off: {formatUGX(value)}.
            {waits
              ? ` Above the ${formatUGX(lossLimit)} limit: stock stays as it is until the general manager approves. (Rule)`
              : ' Stock is written off now and the general manager reviews it later. (Rule)'}
          </p>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            {waits ? 'Send for approval' : 'Write off'}
          </button>
        </div>
      </div>
    </div>
  )
}