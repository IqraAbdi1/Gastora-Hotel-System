import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { daysLeft, expiryState, formatExpiry } from '../procurement/batches'
import { formatUGX, sameName } from '../procurement/requestsModel'
import type { StockItem } from '../procurement/requestsModel'
import { readBrowserValue } from '../../hooks/useBrowserSyncedState'
import type { Recipes } from '../pos/posTypes'

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function ItemPanel({
  item,
  canManage,
  canReport,
  onClose,
  onReport,
  onEdit,
  onHistory,
}: {
  item: StockItem
  canManage: boolean
  canReport: boolean
  onClose: () => void
  onReport: () => void
  onEdit: () => void
  onHistory: () => void
}) {
  const { features } = useFeatures()
  const { movements, onOrderOf, storeName, batches, tracksExpiry, expiryWarn } = useRequests()
  const recipes = readBrowserValue<Recipes>('gastora.pos.recipes.v1', {})
  const usedInRecipes = Object.entries(recipes).filter(([, ingredients]) => ingredients.some((ingredient) => ingredient.stockId === item.id)).map(([productId]) => productId)

  const onOrder = onOrderOf(item.name)
  const recent = movements.filter((m) => sameName(m.item, item.name)).slice(0, 6)
  const low = item.onHand <= item.reorderAt
  const status = item.onHand === 0 ? 'Out of stock' : low ? 'Low stock' : 'In stock'
  const statusStyle =
    item.onHand === 0 ? 'bg-bad/15 text-bad' : low ? 'bg-warn/15 text-warn' : 'bg-good/15 text-good'

  // Expiry: only for items set to track it, and only when the hotel has the switch.
  const tracked = tracksExpiry(item.name)
  const mine = tracked
    ? batches.filter((b) => b.qty > 0 && sameName(b.item, item.name)).sort((a, b) => a.expiry.localeCompare(b.expiry))
    : []
  const dated = mine.reduce((s, b) => s + b.qty, 0)
  const undated = Math.max(0, item.onHand - dated)
  const expiredQty = mine.filter((b) => expiryState(b.expiry, expiryWarn) === 'expired').reduce((s, b) => s + b.qty, 0)

  const facts = [
    { label: 'On hand', value: `${item.onHand} ${item.unit}` },
    { label: 'On order', value: onOrder > 0 ? `${onOrder} ${item.unit}` : 'None' },
    { label: 'Reorder at / par', value: `${item.reorderAt} / ${item.par ?? 0}` },
    { label: 'Usual cost', value: item.unitCost > 0 ? formatUGX(item.unitCost) : 'Not set' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/40">
      <button type="button" aria-label="Close panel" onClick={onClose} className="flex-1 cursor-default" />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 bg-linear-to-br from-good/15 to-brand/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p className="text-sm text-ink/60">
              {item.category ?? 'Other'}
              {features.stores ? ` · ${storeName(item.store)}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle}`}>{status}</span>
              {expiredQty > 0 && (
                <span className="inline-block rounded-full bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">
                  {expiredQty} expired
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-xl text-ink/60">
            ×
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-lg border border-ink/10 p-3">
                <p className="text-sm font-semibold">{f.value}</p>
                <p className="text-xs text-ink/60">{f.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-ink/10 p-3">
            <p className="text-sm font-semibold">Used in recipes</p>
            {usedInRecipes.length ? <p className="mt-1 text-sm text-ink/60">Menu product IDs: {usedInRecipes.join(', ')}</p> : <p className="mt-1 text-sm text-ink/50">Not currently mapped to a POS recipe.</p>}
            {usedInRecipes.length > 0 && <p className="mt-1 text-xs text-ink/50">ASSUMPTION: keep stock items used in recipes active. This snapshot has no delete/archive action in this panel; if one is added later, it must first replace or remove recipe mappings.</p>}
          </div>

          {tracked && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Batches, earliest expiry first</p>
              {mine.length === 0 && undated === 0 ? (
                <p className="text-sm text-ink/60">No stock.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {mine.map((b) => {
                    const st = expiryState(b.expiry, expiryWarn)
                    const d = daysLeft(b.expiry)
                    return (
                      <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink/5 px-3 py-2">
                        <span>
                          <span className="font-medium">
                            {b.qty} {item.unit}
                          </span>{' '}
                          <span className="text-ink/50">
                            · {b.batchNo ?? b.id} · exp {formatExpiry(b.expiry)}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            st === 'expired' ? 'bg-bad/15 text-bad' : st === 'soon' ? 'bg-warn/15 text-warn' : 'bg-good/15 text-good'
                          }`}
                        >
                          {st === 'expired' ? 'Expired' : `${d} day${d === 1 ? '' : 's'} left`}
                        </span>
                      </li>
                    )
                  })}
                  {undated > 0 && (
                    <li className="rounded-lg bg-ink/5 px-3 py-2 text-ink/70">
                      <span className="font-medium">
                        {undated} {item.unit}
                      </span>{' '}
                      <span className="text-ink/50">· no date (older stock or returns). Issued after dated batches.</span>
                    </li>
                  )}
                </ul>
              )}
              {expiredQty > 0 && (
                <p className="mt-2 text-xs text-bad">
                  Expired stock cannot be issued. {canReport ? 'Use Report loss and choose Expired.' : 'Ask the storekeeper to write it off.'}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Recent movements</p>
            {recent.length === 0 ? (
              <p className="text-sm text-ink/60">No movements yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recent.map((m) => (
                  <li key={m.id} className="rounded-lg bg-ink/5 px-3 py-2">
                    <span className="font-medium">
                      {m.kind} {m.qty}
                    </span>{' '}
                    <span className="text-ink/50">
                      {time(m.at)} · {m.by}
                    </span>
                    {m.reason && <p className="text-xs text-ink/60">{m.reason}</p>}
                    {m.batch && <p className="text-xs text-brand">Batch: {m.batch}</p>}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onHistory} className="mt-2 text-sm font-semibold text-brand hover:underline">
              Open full history
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4">
            {canManage && (
              <button type="button" onClick={onEdit} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                Edit item
              </button>
            )}
            {canReport && (
              <button type="button" onClick={onReport} className="rounded-lg border border-bad px-4 py-2 text-sm font-semibold text-bad">
                Report loss
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}