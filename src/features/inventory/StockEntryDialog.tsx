import { useState } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { departments, sameName } from '../procurement/requestsModel'
import type { Department, Receipt } from '../procurement/requestsModel'

interface Row {
  name: string
  qty: string
  cost: string
  /** Purchases of items that track expiry: yyyy-mm-dd. */
  expiry: string
  batchNo: string
}

const emptyRow = (): Row => ({ name: '', qty: '1', cost: '', expiry: '', batchNo: '' })

export type EntryMode = 'purchase' | 'issue' | 'return'

const TITLE: Record<EntryMode, string> = {
  purchase: 'Record purchase',
  issue: 'Issue stock',
  return: 'Return to store',
}
const INTRO: Record<EntryMode, string> = {
  purchase:
    'A purchase with no requisition or purchase order, for example from the market. It adds to the store and gives you a receipt.',
  issue: 'Give stock to a department without a request. It leaves the store and gives you an issue note.',
  return:
    'Someone brings stock back to the counter. It goes into the store and gives you a return note. More than was issued is accepted, but you must say why and it is flagged.',
}
const DONE: Record<EntryMode, string> = {
  purchase: 'Record and show receipt',
  issue: 'Issue and show note',
  return: 'Return and show note',
}
const HEADER: Record<EntryMode, string> = {
  purchase: 'from-brand to-good',
  issue: 'from-warn to-brand',
  return: 'from-good to-brand',
}

// One form for three jobs: record a purchase (stock in), issue stock to a department (stock out)
// or take a return at the counter (stock in). Each ends with a note that opens straight away.
export default function StockEntryDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: EntryMode
  onClose: () => void
  onDone: (receipt: Receipt) => void
}) {
  const q = useRequests()
  const { features } = useFeatures()
  const purchase = mode === 'purchase'
  const back = mode === 'return'
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [department, setDepartment] = useState<Department>('Housekeeping')
  const [note, setNote] = useState('')
  const [handedInBy, setHandedInBy] = useState('')
  const [aboveReason, setAboveReason] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  }

  function pickName(i: number, name: string) {
    const known = q.stock.find((s) => sameName(s.name, name))
    setRows((rs) =>
      rs.map((r, n) => (n === i ? { ...r, name, cost: purchase && !r.cost && known ? String(known.unitCost) : r.cost } : r)),
    )
  }

  /** Which store the item goes into or comes out of. A new item starts in the main store. */
  function storeLabel(name: string) {
    const known = q.stock.find((s) => sameName(s.name, name))
    return known ? q.storeName(known.store) : `${q.storeName()} (new item)`
  }

  /** How many of this row are more than was issued to the department. Only used for returns. */
  const aboveOf = (r: Row) => {
    if (!back || !r.name.trim()) return 0
    return Math.max(0, (parseInt(r.qty, 10) || 0) - q.returnable(department, r.name))
  }
  const anyAbove = rows.some((r) => aboveOf(r) > 0)

  function submit() {
    const lines = rows.map((r) => ({
      name: r.name.trim(),
      qty: Math.max(0, parseInt(r.qty, 10) || 0),
      unitCost: Math.max(0, parseInt(r.cost, 10) || 0),
      expiry: r.expiry || undefined,
      batchNo: r.batchNo.trim() || undefined,
    }))
    const res =
      mode === 'purchase'
        ? q.recordPurchase({ supplier, reference, note, lines })
        : mode === 'issue'
          ? q.issueStock({ department, note, lines })
          : q.returnStock({ department, note, lines, handedInBy, aboveReason })
    if (res.ok === false) return setError(res.error)
    onDone(res.value)
    onClose()
  }

  const field = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'
  const label = 'text-xs font-medium text-ink/60'

  /** One short line under each item: the store, and what is on hand or can come back. */
  function hint(r: Row) {
    const parts: string[] = []
    if (features.stores) parts.push(`${purchase ? 'Goes into' : back ? 'Goes back into' : 'Comes from'}: ${storeLabel(r.name)}`)
    if (back) parts.push(`Issued to ${department} and not yet returned: ${q.returnable(department, r.name)}`)
    else if (!purchase) {
      parts.push(`In store: ${q.stockOf(r.name)}`)
      if (q.tracksExpiry(r.name)) parts.push('earliest expiry goes first')
    }
    return parts.join(' · ')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface">
        <div className={`flex items-center justify-between bg-linear-to-r ${HEADER[mode]} px-5 py-4 text-white`}>
          <div>
            <h2 className="text-lg font-semibold">{TITLE[mode]}</h2>
            <p className="mt-0.5 max-w-lg text-xs text-white/85">{INTRO[mode]}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-white/80 hover:text-white">
            ×
          </button>
        </div>

        <div className="p-5">
          <datalist id="entry-items">
            {q.stock.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <datalist id="entry-suppliers">
            {q.suppliers.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>

          <div className="grid grid-cols-2 gap-3">
            {purchase ? (
              <>
                <label className={label}>
                  Supplier
                  <input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="entry-suppliers" className={`${field} mt-1`} />
                </label>
                <label className={label}>
                  Supplier receipt or invoice no.
                  <input value={reference} onChange={(e) => setReference(e.target.value)} className={`${field} mt-1`} />
                </label>
              </>
            ) : (
              <>
                <label className={`${label} ${back ? '' : 'col-span-2'}`}>
                  {back ? 'Coming back from' : 'Department'}
                  <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={`${field} mt-1`}>
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                {back && (
                  <label className={label}>
                    Handed in by (optional)
                    <input
                      value={handedInBy}
                      onChange={(e) => setHandedInBy(e.target.value)}
                      placeholder="Who brought it to the store"
                      className={`${field} mt-1`}
                    />
                  </label>
                )}
              </>
            )}
          </div>

          <p className={`${label} mb-1 mt-4`}>Items</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-ink/10 p-2">
                <div className="flex items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => pickName(i, e.target.value)}
                    list="entry-items"
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
                  {purchase && (
                    <input
                      value={r.cost}
                      onChange={(e) => setRow(i, { cost: e.target.value })}
                      inputMode="numeric"
                      placeholder="UGX each"
                      aria-label="Cost of one"
                      className={`${field} w-28 shrink-0`}
                    />
                  )}
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
                {purchase && r.name.trim() && q.tracksExpiry(r.name) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-linear-to-r from-good/10 to-transparent p-2 text-xs text-ink/60">
                    <label className="flex items-center gap-1">
                      Expires
                      <input
                        type="date"
                        value={r.expiry}
                        onChange={(e) => setRow(i, { expiry: e.target.value })}
                        className="rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                      />
                    </label>
                    <input
                      value={r.batchNo}
                      onChange={(e) => setRow(i, { batchNo: e.target.value })}
                      placeholder="Batch no. (optional)"
                      className="w-40 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                    />
                  </div>
                )}
                {r.name.trim() && <p className="mt-1 text-[11px] text-ink/50">{hint(r)}</p>}
                {aboveOf(r) > 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-warn">
                    {aboveOf(r)} more than was issued to {department}. It is accepted, but flagged.
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, emptyRow()])}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            + Add item
          </button>

          <label className={`${label} mt-4 block`}>
            {back ? 'Why is it coming back?' : 'Note (optional)'}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={back ? 'For example: unused, wrong item, no longer needed' : undefined}
              className={`${field} mt-1`}
            />
          </label>

          {back && anyAbove && (
            <label className="mt-3 block rounded-lg bg-warn/10 p-3 text-xs font-medium text-warn">
              Why is more coming back than was issued? (required)
              <input
                value={aboveReason}
                onChange={(e) => setAboveReason(e.target.value)}
                placeholder='For example: "the issue was not recorded" or "brought by another department"'
                className={`${field} mt-1 text-ink`}
              />
            </label>
          )}

          {error && <p className="mt-3 text-sm text-bad">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
              Cancel
            </button>
            <button type="button" onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              {DONE[mode]}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}