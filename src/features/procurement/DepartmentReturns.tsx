import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import DocumentDialog from '../receipts/DocumentDialog'
import { receiptDoc } from '../receipts/documents'
import type { DocView } from '../receipts/documents'
import { useRequests } from './requestsContext'
import { headDepartment } from './requestsModel'
import type { Department, ReturnRequest } from './requestsModel'

const STATUS: Record<ReturnRequest['status'], string> = {
  Pending: 'bg-warn/15 text-warn',
  Confirmed: 'bg-good/15 text-good',
  Declined: 'bg-bad/15 text-bad',
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

interface Row {
  name: string
  qty: string
}

function ReturnDialog({
  department,
  onClose,
  onDone,
}: {
  department: Department
  onClose: () => void
  onDone: (id: string) => void
}) {
  const q = useRequests()
  const [rows, setRows] = useState<Row[]>([{ name: '', qty: '1' }])
  const [handedInBy, setHandedInBy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const free = (name: string) => Math.max(0, q.returnable(department, name) - q.pendingReturnQty(department, name))
  const outWith = q.stock.filter((s) => free(s.name) > 0)

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  }

  function submit() {
    const res = q.raiseReturn({
      department,
      note,
      handedInBy,
      lines: rows.map((r) => ({ name: r.name.trim(), qty: Math.max(0, parseInt(r.qty, 10) || 0) })),
    })
    if (!res.ok) return setError(res.error)
    onDone(res.value.id)
    onClose()
  }

  const field = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'
  const label = 'text-xs font-medium text-ink/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-surface">
        <div className="flex items-center justify-between bg-linear-to-r from-good to-brand px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">Send stock back to the store</h2>
            <p className="mt-0.5 text-xs text-white/85">
              The storekeeper counts it in. Stock only moves when they confirm.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-white/80 hover:text-white">
            ×
          </button>
        </div>

        <div className="p-5">
          <datalist id="return-items">
            {outWith.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>

          <p className={`${label} mb-1`}>Items (only what is out with {department})</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-ink/10 p-2">
                <div className="flex items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    list="return-items"
                    placeholder="Item"
                    className={`${field} min-w-0 flex-1`}
                  />
                  <input
                    value={r.qty}
                    onChange={(e) => setRow(i, { qty: e.target.value })}
                    inputMode="numeric"
                    aria-label="Quantity"
                    className={`${field} w-20 shrink-0`}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
                      aria-label="Remove item"
                      className="shrink-0 px-1 text-ink/50"
                    >
                      ×
                    </button>
                  )}
                </div>
                {r.name.trim() && <p className="mt-1 text-[11px] text-ink/50">Can still go back: {free(r.name)}</p>}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { name: '', qty: '1' }])}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            + Add item
          </button>

          <label className={`${label} mt-4 block`}>
            Handed in by (optional)
            <input
              value={handedInBy}
              onChange={(e) => setHandedInBy(e.target.value)}
              placeholder="For example the attendant who is carrying it"
              className={`${field} mt-1`}
            />
          </label>
          <label className={`${label} mt-3 block`}>
            Why is it going back?
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="For example: unused, wrong item, no longer needed"
              className={`${field} mt-1`}
            />
          </label>

          {error && <p className="mt-3 text-sm text-bad">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
              Cancel
            </button>
            <button type="button" onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Send to the store
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// The department head's side of a return. Shown on their own Supplies page.
export default function DepartmentReturns({ department }: { department: Department }) {
  const { can, role } = useAuth()
  const { features, tenant } = useFeatures()
  const { stock, returns, receipts, returnable, pendingReturnQty } = useRequests()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [doc, setDoc] = useState<DocView | null>(null)

  const mine = role ? headDepartment[role.id] === department : false
  if (!features.deptReturns || !can('returnStock') || !mine) return null

  const outItems = stock.filter((s) => returnable(department, s.name) - pendingReturnQty(department, s.name) > 0)
  const outQty = outItems.reduce((sum, s) => sum + returnable(department, s.name) - pendingReturnQty(department, s.name), 0)
  const list = returns.filter((r) => r.department === department)
  const waiting = list.filter((r) => r.status === 'Pending').length

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-linear-to-r from-good to-brand px-4 py-3 text-white shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Unused stock? Send it back to the store</p>
          <p className="text-xs text-white/85">
            {outItems.length > 0
              ? `${outQty} item${outQty === 1 ? '' : 's'} (${outItems.length} kind${outItems.length === 1 ? '' : 's'}) issued to ${department} and not yet returned.`
              : `Nothing issued to ${department} is waiting to go back.`}
            {waiting > 0 && ` ${waiting} return${waiting === 1 ? '' : 's'} waiting for the storekeeper.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={outItems.length === 0}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:bg-white/90 disabled:opacity-60"
        >
          Return to store
        </button>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm font-medium text-good">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-good/70 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {list.length > 0 && (
        <details className="rounded-xl border border-ink/10 bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">Your returns ({list.length})</summary>
          <div className="mt-3 space-y-2">
            {list.slice(0, 10).map((r) => {
              const note = r.receiptId ? receipts.find((x) => x.id === r.receiptId) : undefined
              return (
                <div key={r.id} className="rounded-lg border border-ink/10 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-semibold">
                      {r.id} <span className="font-normal text-ink/50">{time(r.at)}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="mt-1">
                    {r.lines
                      .map((l, n) => {
                        const got = r.received?.[n]
                        return got !== undefined && got !== l.qty ? `${l.qty} × ${l.name} (counted ${got})` : `${l.qty} × ${l.name}`
                      })
                      .join(', ')}
                  </p>
                  <p className="text-xs text-ink/60">
                    {r.handedInBy && `Handed in by ${r.handedInBy}. `}
                    {r.decidedBy && `${r.status} by ${r.decidedBy}. `}
                    {r.decisionNote}
                  </p>
                  {note && (
                    <button
                      type="button"
                      onClick={() => setDoc(receiptDoc(note, tenant.name))}
                      className="mt-1 rounded-lg border border-brand/40 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5"
                    >
                      Return note {note.id}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      )}

      {open && (
        <ReturnDialog
          department={department}
          onClose={() => setOpen(false)}
          onDone={(id) => setNotice(`Return ${id} sent. The storekeeper will count it in and confirm.`)}
        />
      )}
      {doc && <DocumentDialog doc={doc} onClose={() => setDoc(null)} />}
    </div>
  )
}