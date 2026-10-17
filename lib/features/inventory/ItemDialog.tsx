import { useState } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { MAIN_STORE_ID, STOCK_CATEGORIES } from '../procurement/requestsModel'
import type { StockItem } from '../procurement/requestsModel'

const num = (s: string) => Math.max(0, parseInt(s, 10) || 0)

// Add an item, or edit one. The name is fixed once the item exists, because requests and movements refer to it.
export default function ItemDialog({ item, onClose }: { item?: StockItem; onClose: () => void }) {
  const { addItem, updateItem, stores } = useRequests()
  const { features } = useFeatures()
  const showStores = features.stores
  const showExpiry = features.batchExpiry
  const [name, setName] = useState(item?.name ?? '')
  const [unit, setUnit] = useState(item?.unit ?? 'piece')
  const [category, setCategory] = useState(item?.category ?? 'Other')
  const [store, setStore] = useState(item?.store ?? MAIN_STORE_ID)
  const [reorderAt, setReorderAt] = useState(String(item?.reorderAt ?? 0))
  const [par, setPar] = useState(String(item?.par ?? 0))
  const [unitCost, setUnitCost] = useState(String(item?.unitCost ?? ''))
  const [opening, setOpening] = useState('0')
  const [tracksExpiry, setTracksExpiry] = useState(!!item?.tracksExpiry)
  const [error, setError] = useState<string | null>(null)

  function save() {
    const home = showStores ? store : undefined
    const result = item
      ? updateItem(item.id, {
          unit,
          category,
          store: home,
          reorderAt: num(reorderAt),
          par: num(par),
          unitCost: num(unitCost),
          ...(showExpiry ? { tracksExpiry } : {}),
        })
      : addItem({
          name,
          unit,
          category,
          store: home,
          reorderAt: num(reorderAt),
          par: num(par),
          unitCost: num(unitCost),
          opening: num(opening),
          tracksExpiry: showExpiry ? tracksExpiry : undefined,
        })
    setError(result)
    if (!result) onClose()
  }

  const field = 'mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'
  const label = 'text-xs font-medium text-ink/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{item ? 'Edit item' : 'Add item'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-ink/60">
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={`${label} col-span-2`}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!!item} className={`${field} disabled:bg-ink/5`} />
          </label>
          <label className={label}>
            Unit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {showStores && (
            <label className={`${label} col-span-2`}>
              Store
              <select value={store} onChange={(e) => setStore(e.target.value)} className={field}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {item && <span className="mt-1 block font-normal text-ink/50">Moving an item to another store is recorded in its history.</span>}
            </label>
          )}
          <label className={label}>
            Reorder level
            <input value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} inputMode="numeric" className={field} />
          </label>
          <label className={label}>
            Par level (top up to)
            <input value={par} onChange={(e) => setPar(e.target.value)} inputMode="numeric" className={field} />
          </label>
          <label className={label}>
            Usual cost of one (UGX)
            <input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="numeric" className={field} />
          </label>
          {!item && (
            <label className={label}>
              Quantity on the shelf now
              <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="numeric" className={field} />
            </label>
          )}
          {showExpiry && (
            <label className="col-span-2 flex items-start gap-3 rounded-lg bg-linear-to-r from-good/10 to-transparent p-3 text-sm">
              <input
                type="checkbox"
                checked={tracksExpiry}
                onChange={(e) => setTracksExpiry(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Track expiry dates</span>
                <span className="block text-xs text-ink/60">
                  For food, chemicals and anything with a use-by date. Every delivery needs a date, the earliest date is
                  issued first and expired stock is blocked.
                  {item && ' Stock already on the shelf has no date and is issued after dated stock.'}
                </span>
              </span>
            </label>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink/70">
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}