import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useRequests } from './requestsContext'

export default function SuppliersPage() {
  const { can } = useAuth()
  const { suppliers, orders, addSupplier, setSupplierActive } = useRequests()
  const edit = can('purchase') || can('changeSettings')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [supplies, setSupplies] = useState('')
  const [error, setError] = useState<string | null>(null)

  const list = suppliers.filter((s) => {
    const q = query.trim().toLowerCase()
    return !q || `${s.name} ${s.supplies}`.toLowerCase().includes(q)
  })

  function save() {
    const result = addSupplier(name, phone, supplies)
    setError(result)
    if (!result) {
      setName('')
      setPhone('')
      setSupplies('')
      setAdding(false)
    }
  }

  const field = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-ink/60">Who the hotel buys from. Procurement picks one when raising a purchase order.</p>
        </div>
        {edit && (
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Add supplier
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-ink/60">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs font-medium text-ink/60">
              Phone (optional)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${field} mt-1`} />
            </label>
          </div>
          <label className="block text-xs font-medium text-ink/60">
            What they supply (optional)
            <input value={supplies} onChange={(e) => setSupplies(e.target.value)} className={`${field} mt-1`} />
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
              Cancel
            </button>
            <button type="button" onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Save
            </button>
          </div>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search supplier or what they supply"
        className={field}
      />

      {list.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">No suppliers match.</p>
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const count = orders.filter((o) => o.supplier === s.name).length
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-surface p-4 text-sm">
                <div className="flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-ink/60">
                    {s.supplies || 'No description'}
                    {s.phone && ` · ${s.phone}`}
                    {` · ${count} purchase order${count === 1 ? '' : 's'}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    s.active ? 'bg-good/15 text-good' : 'bg-ink/10 text-ink/70'
                  }`}
                >
                  {s.active ? 'Active' : 'Not in use'}
                </span>
                {edit && (
                  <button
                    type="button"
                    onClick={() => setSupplierActive(s.id, !s.active)}
                    className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink/70"
                  >
                    {s.active ? 'Stop using' : 'Use again'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}