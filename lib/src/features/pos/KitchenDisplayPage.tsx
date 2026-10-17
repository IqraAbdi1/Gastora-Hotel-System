import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { transitionOrderStatus } from './posDomain'
import type { HeldOrder, OrderHistoryRecord, OrderStatus, Product } from './posTypes'

const ORDERS_KEY = 'gastora.pos.heldOrders.v1'
const HISTORY_KEY = 'gastora.pos.orderHistory.v1'
const PRODUCTS_KEY = 'gastora.pos.products.v1'

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useBrowserSyncedState<HeldOrder[]>(ORDERS_KEY, [])
  const [history, setHistory] = useBrowserSyncedState<OrderHistoryRecord[]>(HISTORY_KEY, [])
  const [products] = useBrowserSyncedState<Product[]>(PRODUCTS_KEY, [])
  const [outlet, setOutlet] = useState('All outlets')
  const [station, setStation] = useState('All stations')
  const [showHistory, setShowHistory] = useState(false)
  const [clock, setClock] = useState(0)
  useEffect(() => { const refresh = () => setClock(Date.now()); refresh(); const timer = window.setInterval(refresh, 15000); return () => window.clearInterval(timer) }, [])

  const activeOrders = orders.filter(order => !['Served', 'Cancelled', 'Draft'].includes(order.status ?? 'New'))
  const visible = (showHistory ? orders.filter(order => ['Served', 'Cancelled'].includes(order.status ?? '')) : activeOrders)
    .filter(order => (outlet === 'All outlets' || order.outlet === outlet) && (station === 'All stations' || order.items.some(line => products.find(item => item.id === line.productId)?.category === station)))

  function update(id: string, status: OrderStatus) {
    const current = orders.find(order => order.id === id)
    if (!current) return
    const updated = transitionOrderStatus(current, status)
    setOrders(old => old.map(order => order.id === id ? updated : order))
    const prior = history.find(record => record.id === id)
    const event = { status, at: updated.updatedAt ?? new Date().toISOString(), note: `Status changed to ${status} in Kitchen Display` }
    setHistory(old => [{ ...updated, status, history: [...(prior?.history ?? []), event] }, ...old.filter(record => record.id !== id)])
  }
  function age(createdAt: string) { const timestamp = new Date(createdAt).getTime(); return Number.isFinite(timestamp) ? Math.max(0, Math.floor(((clock || timestamp) - timestamp) / 60000)) : 0 }
  function urgency(order: HeldOrder) { const minutes = age(order.createdAt); return minutes >= 25 ? 'border-rose-300 bg-rose-50' : minutes >= 12 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-white' }
  const categories = [...new Set(products.map(product => product.category))]
  const pendingCount = activeOrders.filter(order => (order.status ?? order.kitchenStatus ?? 'New') !== 'Ready').length

  return <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
    <header className="flex flex-col justify-between gap-4 rounded-2xl bg-sidebar p-6 text-white md:flex-row md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Gastora · Back of house</p><h1 className="mt-2 text-3xl font-bold">Kitchen Display System</h1><p className="mt-2 max-w-2xl text-sm text-white/70">POS and kitchen use one order record. Status changes are shared across tabs; served and cancelled tickets are retained in history.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-xl bg-white/10 px-4 py-3"><strong className="block text-2xl">{activeOrders.length}</strong><span className="text-xs text-white/70">Open tickets</span></span><span className="rounded-xl bg-white/10 px-4 py-3"><strong className="block text-2xl">{pendingCount}</strong><span className="text-xs text-white/70">In progress</span></span><Link to="/pos" className="self-center rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-sidebar">Open POS</Link></div></header>
    <section className="flex flex-col gap-3 rounded-xl border border-black/5 bg-white p-4 sm:flex-row"><label className="text-sm font-semibold">Outlet<select value={outlet} onChange={event => setOutlet(event.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal sm:w-52"><option>All outlets</option><option>Restaurant</option><option>Bar</option></select></label><label className="text-sm font-semibold">Kitchen station / category<select value={station} onChange={event => setStation(event.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal sm:w-60"><option>All stations</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label><button onClick={() => setShowHistory(value => !value)} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold">{showHistory ? 'Show active queue' : `Order history (${orders.filter(order => ['Served', 'Cancelled'].includes(order.status ?? '')).length})`}</button><div className="ml-auto flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">Under 12 min</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">12+ min delayed</span><span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-800">25+ min overdue</span></div></section>
    {!visible.length ? <section className="rounded-2xl border border-dashed border-black/15 bg-white px-6 py-16 text-center"><div className="text-4xl">🍽️</div><h2 className="mt-3 text-xl font-bold">{showHistory ? 'No matching closed tickets' : 'Kitchen is clear'}</h2><p className="mt-2 text-sm text-ink/60">{showHistory ? 'Served and cancelled orders remain available in the shared order history.' : 'Orders sent from POS appear here while this app is open.'}</p><Link to="/pos" className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Create a POS order</Link></section> : <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">{visible.map(order => {
      const minutes = age(order.createdAt)
      const status = order.status ?? order.kitchenStatus ?? 'New'
      const ticketProducts = order.items.map(line => ({ ...line, product: products.find(product => product.id === line.productId) }))
      return <article key={order.id} className={`overflow-hidden rounded-2xl border shadow-sm ${urgency(order)}`}><div className="flex items-start justify-between gap-3 border-b border-black/5 p-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{order.id}</h2><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold">{status}</span></div><p className="mt-1 text-sm text-ink/65">{order.outlet} · {order.orderType}{order.table ? ` · Table ${order.table}` : ''}{order.room ? ` · Room ${order.room}` : ''}</p><p className="mt-1 text-xs text-ink/50">{order.customer || 'Walk-in guest'} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div><div className={`rounded-xl px-3 py-2 text-center ${minutes >= 25 ? 'bg-rose-600 text-white' : minutes >= 12 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}><strong className="block text-xl">{minutes}</strong><span className="text-[10px] font-bold uppercase">minutes</span></div></div>
        {(order.notes || order.allergy || order.vip) && <div className="space-y-2 border-b border-black/5 bg-rose-100/70 p-3">{(order.notes || order.allergy) && <p className="text-sm font-bold text-rose-900">⚠ Special instructions: {order.allergy ? `${order.allergy} · ` : ''}{order.notes}</p>}{order.vip && <p className="text-sm font-bold text-amber-900">VIP guest · prioritize presentation</p>}</div>}
        <div className="space-y-3 p-4"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink/45"><span>Items & preparation</span><span>{ticketProducts.reduce((sum, line) => sum + line.qty, 0)} items</span></div>{ticketProducts.map((line, index) => <div key={`${order.id}-${line.productId}-${index}`} className="flex items-start gap-3 rounded-xl bg-white/80 p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-lg">{line.product?.emoji ?? '🍽️'}</span><div className="min-w-0 flex-1"><p className="font-semibold">{line.product?.name ?? 'Removed menu item'}</p><p className="text-xs text-ink/55">{line.product?.category ?? 'Kitchen'} · {line.product?.unit ?? 'portion'}</p></div><strong className="rounded-lg bg-sidebar px-3 py-1.5 text-white">× {line.qty}</strong></div>)}
          {!showHistory && <div className="flex flex-wrap gap-2 pt-2">{status === 'New' && <button onClick={() => update(order.id, 'Preparing')} className="flex-1 rounded-lg bg-brand px-3 py-2.5 text-sm font-bold text-white">Start preparation</button>}{status === 'Preparing' && <button onClick={() => update(order.id, 'Ready')} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white">Mark ready</button>}{status === 'Ready' && <button onClick={() => update(order.id, 'Served')} className="flex-1 rounded-lg bg-sidebar px-3 py-2.5 text-sm font-bold text-white">Mark served</button>}{['New', 'Preparing'].includes(status) && <button onClick={() => update(order.id, 'Cancelled')} className="rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700">Cancel ticket</button>}</div>}
          {showHistory && <p className="pt-2 text-xs text-ink/55">History events: {history.find(record => record.id === order.id)?.history.length ?? 0}. Ticket is read-only.</p>}
        </div></article>
    })}</section>}
    <p className="text-xs text-ink/45">Storage scope: same browser origin and local browser storage. This does not provide real-time synchronization across separate devices or users; that requires a backend service.</p>
  </main>
}
