import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useRequests } from '../procurement/requestsContext'
import { archiveOrder, claimLineDeduction, finishLineDeduction, migratePosStorage } from './posStore'
import { POS_STORAGE_KEYS } from './posTypes'
import type { HeldOrder, LineStatus, Product, Recipes } from './posTypes'
import { convertQuantity, validateRecipe } from './recipeEngine'

migratePosStorage()

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const [history, setHistory] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.orderHistory, [])
  const [products] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, [])
  const [recipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const inventory = useRequests()
  const [outlet, setOutlet] = useState('All outlets')
  const [station, setStation] = useState('All stations')
  const [, setClock] = useState(0)
  const [notice, setNotice] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setClock(value => value + 1), 15000); return () => window.clearInterval(timer) }, [])

  const activeOrders = orders.filter(order => (order.kitchenStatus ?? 'New') !== 'Served' && (order.kitchenStatus ?? 'New') !== 'Cancelled')
  const visible = activeOrders.filter(order => (outlet === 'All outlets' || order.outlet === outlet) && (station === 'All stations' || order.items.some(line => { const product = products.find(item => item.id === line.productId); return product?.category === station })))

  function markLinePreparing(order: HeldOrder, lineIndex: number) {
    const at = new Date().toISOString()
    const items = order.items.map((line, index) => index === lineIndex ? { ...line, status: 'Preparing' as LineStatus, preparingAt: line.preparingAt ?? at } : line)
    setOrders(old => old.map(item => item.id === order.id ? { ...item, items, kitchenStatus: 'Preparing', preparingAt: item.preparingAt ?? at, updatedAt: at } : item))
  }

  function markLineReady(order: HeldOrder, lineIndex: number) {
    const line = order.items[lineIndex]
    if (!line || line.status === 'Ready' || line.status === 'Served') return
    const product = products.find(item => item.id === line.productId)
    const at = new Date().toISOString()
    let stockDeducted = line.stockDeducted === true
    let stockDeductionError: string | undefined
    const lineId = line.lineId ?? `${order.id}-line-${lineIndex + 1}`
    const ref = `${order.id}:${lineId}`

    if (!stockDeducted && product?.trackStock !== false) {
      const recipe = recipes[line.productId] ?? []
      if (!recipe.length) {
        stockDeductionError = `No inventory recipe configured for ${product?.name ?? line.productId}.`
      } else {
        const issues = validateRecipe(recipe, inventory.stock)
        if (issues.length) {
          stockDeductionError = issues[0]
        } else {
          const deductions: { name: string; qty: number }[] = []
          for (const ingredient of recipe) {
            const stockItem = inventory.stock.find(item => item.id === ingredient.stockId)
            if (!stockItem) {
              stockDeductionError = `Recipe stock item ${ingredient.stockId} is missing.`
              break
            }
            const converted = convertQuantity(ingredient.qty, ingredient.unit || stockItem.unit, stockItem.unit)
            if (converted === null || converted <= 0) {
              stockDeductionError = `Incompatible recipe unit for ${stockItem.name}.`
              break
            }
            const waste = ingredient.wastePercent ?? 0
            deductions.push({ name: stockItem.name, qty: (converted / (1 - waste / 100)) * line.qty })
          }
          if (!stockDeductionError && deductions.length) {
            if (!claimLineDeduction(ref)) {
              // A previous successful/pending call is treated as already claimed. Verify the movement-backed line state before retrying.
              const ledgerRaw = window.localStorage.getItem(POS_STORAGE_KEYS.deductionLedger)
              const ledger = ledgerRaw ? JSON.parse(ledgerRaw) as { ref: string; status: string }[] : []
              if (ledger.some(entry => entry.ref === ref && entry.status === 'deducted')) stockDeducted = true
              else stockDeductionError = 'A stock deduction for this order line is already in progress. Refresh and verify inventory before retrying.'
            } else {
              const result = inventory.consumeStockForSale(deductions, order.id, order.outlet, ref)
              if (result.ok) {
                finishLineDeduction(ref)
                stockDeducted = true
              } else {
                finishLineDeduction(ref, result.error)
                stockDeductionError = result.error
              }
            }
          }
        }
      }
    }

    const nextItems = order.items.map((item, index) => index === lineIndex ? {
      ...item,
      lineId,
      status: 'Ready' as LineStatus,
      readyAt: at,
      stockDeducted,
      stockDeductionRef: stockDeducted ? ref : item.stockDeductionRef,
      ...(stockDeductionError ? { stockDeductionError } : { stockDeductionError: undefined }),
    } : item)
    const allReady = nextItems.every(item => item.status === 'Ready' || item.status === 'Served')
    setOrders(old => old.map(item => item.id === order.id ? {
      ...item,
      items: nextItems,
      kitchenStatus: allReady ? 'Ready' : 'Preparing',
      preparingAt: item.preparingAt ?? at,
      ...(allReady ? { readyAt: at } : {}),
      updatedAt: at,
    } : item))
    setNotice(stockDeductionError
      ? `${product?.name ?? 'Order item'} marked ready, but stock was not deducted: ${stockDeductionError} Notify the storekeeper and manager.`
      : `${product?.name ?? 'Order item'} marked ready${stockDeducted ? ' and inventory deduction verified' : ''}.`)
  }

  function markServed(order: HeldOrder) {
    const at = new Date().toISOString()
    const served: HeldOrder = {
      ...order,
      kitchenStatus: 'Served',
      servedAt: at,
      updatedAt: at,
      items: order.items.map(line => ({ ...line, status: 'Served', servedAt: line.servedAt ?? at })),
    }
    if (!archiveOrder(served)) { setNotice(`Could not archive ${order.id}; ticket remains open to prevent history loss.`); return }
    setHistory(old => [served, ...old.filter(item => item.id !== served.id)])
    setOrders(old => old.filter(item => item.id !== order.id))
    setNotice(`Order ${order.id} marked served and retained in order history.`)
  }

  function cancelOrder(order: HeldOrder) {
    const deducted = order.items.some(line => line.stockDeducted)
    const choice = deducted
      ? window.prompt('Stock has already been deducted. Type RETURN to request a stock return, or WASTE to record spoilage/wastage. The selected action must be completed by an authorized storekeeper.')
      : 'RETURN'
    if (choice !== 'RETURN' && choice !== 'WASTE') return
    const at = new Date().toISOString()
    const cancelled: HeldOrder = { ...order, kitchenStatus: 'Cancelled', cancelledAt: at, updatedAt: at, notes: `${order.notes}${order.notes ? ' · ' : ''}Cancellation stock disposition requested: ${choice}` }
    if (!archiveOrder(cancelled)) { setNotice(`Could not archive ${order.id}; ticket remains open to prevent history loss.`); return }
    setHistory(old => [cancelled, ...old.filter(item => item.id !== cancelled.id)])
    setOrders(old => old.filter(item => item.id !== order.id))
    setNotice(deducted
      ? `Order ${order.id} cancelled. Stock disposition ${choice} was recorded in the order history; an authorized storekeeper must complete the corresponding inventory return/write-off.`
      : `Order ${order.id} cancelled and retained in history. No stock had been deducted.`)
  }

  function age(createdAt: string) { return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)) }
  function urgency(order: HeldOrder) { const minutes = age(order.createdAt); return minutes >= 25 ? 'border-rose-300 bg-rose-50' : minutes >= 12 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-white' }
  const categories = [...new Set(products.map(product => product.category))]
  const pendingCount = activeOrders.filter(order => (order.kitchenStatus ?? 'New') !== 'Ready').length

  return <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
    <header className="flex flex-col justify-between gap-4 rounded-2xl bg-sidebar p-6 text-white md:flex-row md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Gastora · Back of house</p><h1 className="mt-2 text-3xl font-bold">Kitchen Display System</h1><p className="mt-2 max-w-2xl text-sm text-white/70">Live POS tickets with line-level readiness, stock deduction guards and persistent served-order history.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-xl bg-white/10 px-4 py-3"><strong className="block text-2xl">{activeOrders.length}</strong><span className="text-xs text-white/70">Open tickets</span></span><span className="rounded-xl bg-white/10 px-4 py-3"><strong className="block text-2xl">{pendingCount}</strong><span className="text-xs text-white/70">In progress</span></span><Link to="/pos" className="self-center rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-sidebar">Open POS</Link></div></header>
    {notice && <div role="status" className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">{notice}</div>}
    <section className="flex flex-col gap-3 rounded-xl border border-black/5 bg-white p-4 sm:flex-row"><label className="text-sm font-semibold">Outlet<select value={outlet} onChange={event => setOutlet(event.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal sm:w-52"><option>All outlets</option><option>Restaurant</option><option>Bar</option></select></label><label className="text-sm font-semibold">Kitchen station / category<select value={station} onChange={event => setStation(event.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal sm:w-60"><option>All stations</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label><div className="ml-auto flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">Under 12 min</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">12+ min delayed</span><span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-800">25+ min overdue</span></div></section>
    {!visible.length ? <section className="rounded-2xl border border-dashed border-black/15 bg-white px-6 py-16 text-center"><h2 className="mt-3 text-xl font-bold">Kitchen is clear</h2><p className="mt-2 text-sm text-ink/60">Orders sent from POS will appear here automatically while this app is open.</p><Link to="/pos" className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Create a POS order</Link></section> : <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">{visible.map(order => { const minutes = age(order.createdAt); const status = order.kitchenStatus ?? 'New'; const ticketProducts = order.items.map((line, index) => ({ ...line, index, product: products.find(product => product.id === line.productId) })).filter(line => line.product); return <article key={order.id} className={`overflow-hidden rounded-2xl border shadow-sm ${urgency(order)}`}><div className="flex items-start justify-between gap-3 border-b border-black/5 p-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{order.id}</h2><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold">{status}</span></div><p className="mt-1 text-sm text-ink/65">{order.outlet} · {order.orderType}{order.table ? ` · Table ${order.table}` : ''}{order.room ? ` · Room ${order.room}` : ''}{order.roomFloor ? ` · Floor ${order.roomFloor}` : ''}{order.deliverySetup ? ` · ${order.deliverySetup}` : ''}</p><p className="mt-1 text-xs text-ink/50">{order.customer || 'Walk-in guest'} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div><div className={`rounded-xl px-3 py-2 text-center ${minutes >= 25 ? 'bg-rose-600 text-white' : minutes >= 12 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}><strong className="block text-xl">{minutes}</strong><span className="text-[10px] font-bold uppercase">minutes</span></div></div>
      {(order.notes || order.allergy || order.vip) && <div className={`space-y-2 border-b border-black/5 p-3 ${order.severeAllergy ? 'bg-rose-600 text-white' : 'bg-rose-100/70'}`}>{(order.notes || order.allergy) && <p className="text-sm font-bold">{order.severeAllergy ? 'SEVERE ALLERGY ALERT: ' : 'Special instructions: '}{order.allergy ? `${order.allergy} · ` : ''}{order.notes}</p>}{order.vip && <p className="text-sm font-bold text-amber-900">VIP guest · prioritize presentation</p>}</div>}
      <div className="space-y-3 p-4"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink/45"><span>Items & preparation</span><span>{ticketProducts.reduce((sum, line) => sum + line.qty, 0)} items</span></div>{ticketProducts.map(line => <div key={`${order.id}-${line.lineId ?? line.productId}-${line.index}`} className="rounded-xl bg-white/80 p-3"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-lg">{line.product?.emoji ?? '🍽️'}</span><div className="min-w-0 flex-1"><p className="font-semibold">{line.product?.name ?? 'Removed menu item'}</p><p className="text-xs text-ink/55">{line.product?.category ?? 'Kitchen'} · {line.product?.unit ?? 'portion'} · {line.course ?? 'Main'} · {line.status ?? 'New'}</p>{line.note && <p className="mt-1 text-xs font-semibold text-amber-800">Item note: {line.note}</p>}{line.stockDeductionError && <p className="mt-1 text-xs font-semibold text-rose-700">Stock not deducted: {line.stockDeductionError}. Notify storekeeper/manager.</p>}{line.stockDeducted && <p className="mt-1 text-xs font-semibold text-emerald-700">Inventory deducted once</p>}</div><strong className="rounded-lg bg-sidebar px-3 py-1.5 text-white">× {line.qty}</strong></div><div className="mt-3 flex gap-2">{line.status !== 'Ready' && line.status !== 'Served' && <button onClick={() => markLinePreparing(order, line.index)} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold">Preparing</button>}{line.status !== 'Ready' && line.status !== 'Served' && <button onClick={() => markLineReady(order, line.index)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Mark line ready</button>}</div></div>)}<div className="flex flex-wrap gap-2 pt-2">{status === 'Ready' && <button onClick={() => markServed(order)} className="flex-1 rounded-lg bg-sidebar px-3 py-2.5 text-sm font-bold text-white">Served · archive ticket</button>}<button onClick={() => cancelOrder(order)} className="rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700">Cancel order</button></div></div></article> })}</section>}
    <section className="rounded-xl border border-black/5 bg-white p-4"><h2 className="font-bold">
      Recent served/cancelled history</h2><p className="mt-1 text-xs text-ink/55">{history.length} archived order(s). Tickets are retained for timing and audit review rather than deleted.
      </p>{history.slice(0, 5).map(order => <div key={order.id} className="mt-2 flex flex-wrap justify-between gap-2 border-t border-black/5 pt-2 text-sm"><span>{order.id} · {order.outlet} · {order.kitchenStatus}</span><span className="text-ink/55">{order.servedAt ? `Served ${new Date(order.servedAt).toLocaleString()}` : order.cancelledAt ? `Cancelled ${new Date(order.cancelledAt).toLocaleString()}` : ''}</span></div>)}</section>
    <p className="text-xs text-ink/45">
    Prototype limitation: browser storage synchronizes only within the same browser origin. A cancellation after deduction records the requested disposition in history; an authorized storekeeper must complete the inventory return or wastage write-off in the existing Inventory workflow.</p>
  </main>
}
