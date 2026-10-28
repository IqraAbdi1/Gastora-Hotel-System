import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from './requestsContext'
import { departments, STORE_DEPARTMENT, urgencies } from './requestsModel'
import type { Department, Urgency } from './requestsModel'

interface Row {
  name: string
  qty: string
}

const emptyRow = (): Row => ({ name: '', qty: '1' })

export default function NewRequestDialog({
  department,
  onClose,
}: {
  /** On a department's own Supplies page the department is fixed. */
  department?: Department
  onClose: () => void
}) {
  const { role } = useAuth()
  const { features } = useFeatures()
  const { stock, raise } = useRequests()
  const chain = features.supplyChain
  const fromStore = role?.id === 'storekeeper'
  const [dept, setDept] = useState<Department>(department ?? (fromStore ? STORE_DEPARTMENT : 'Housekeeping'))
  const [urgency, setUrgency] = useState<Urgency>('Normal')
  const [reason, setReason] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)

  const items = rows
    .map((r) => ({ name: r.name.trim(), qty: Math.max(0, parseInt(r.qty, 10) || 0), unitCost: 0 }))
    .filter((i) => i.name && i.qty > 0)

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  }

  function submit() {
    if (items.length === 0) return setError('Add at least one item with a name and quantity.')
    raise({ department: dept, urgency, reason: reason.trim(), items })
    onClose()
  }

  const hint = !chain
    ? 'Management will reply.'
    : fromStore
      ? 'The store is out, so this goes straight to purchasing and the budget check.'
      : role?.id === 'attendant'
        ? 'Your department head endorses this first. Then the storekeeper checks the store.'
        : 'The storekeeper checks the store first.'

  const field = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'
  // Same box without w-full, so the item and quantity keep their own columns.
  const cell = 'rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Request supplies</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-ink/60">
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!department && (
            <label className="text-xs font-medium text-ink/60">
              Department
              <select value={dept} onChange={(e) => setDept(e.target.value as Department)} className={`${field} mt-1`}>
                {(fromStore ? [STORE_DEPARTMENT, ...departments] : [...departments]).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              {fromStore && dept === STORE_DEPARTMENT && (
                <span className="mt-1 block font-normal text-ink/55">
                  Topping up the store itself. It is charged to the store's own budget line, not a department's.
                </span>
              )}
            </label>
          )}
          <label className="text-xs font-medium text-ink/60">
            How soon
            <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} className={`${field} mt-1`}>
              {urgencies.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="mb-1 mt-4 text-xs font-medium text-ink/60">Items</p>
        {chain && (
          <datalist id="stock-items">
            {stock.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        )}
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="Item"
                list={chain ? 'stock-items' : undefined}
                className={`${cell} min-w-0`}
              />
              <input
                value={r.qty}
                onChange={(e) => setRow(i, { qty: e.target.value })}
                inputMode="numeric"
                aria-label="Quantity"
                className={`${cell} text-center`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
                  aria-label="Remove item"
                  className="px-1 text-ink/50"
                >
                  ×
                </button>
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

        <label className="mt-4 block text-xs font-medium text-ink/60">
          Why do you need it? (optional)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${field} mt-1`} />
        </label>

        <p className="mt-3 text-sm text-ink/60">{hint}</p>
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Send request
          </button>
        </div>
      </div>
    </div>
  )
}