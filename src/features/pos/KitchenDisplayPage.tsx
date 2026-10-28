import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, Chip, PageHeader, StatCard, buttonClass } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useNow } from '../../lib/useNow'
import type { KdsStation } from '../../services/pos/posTypes'
import { useRequests } from '../procurement/requestsContext'
import { archiveOrder, claimLineDeduction, finishLineDeduction, migratePosStorage } from './posStore'
import { COURSES, POS_STORAGE_KEYS } from './posTypes'
import type { HeldOrder, LineStatus, OrderLine, Product, Recipes } from './posTypes'
import { convertQuantity, grossQuantity, validateRecipe } from './recipeEngine'
import { usePos } from './usePos'

migratePosStorage()

const SIMPLE_TARGET = 12

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const [history, setHistory] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.orderHistory, [])
  const [products] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, [])
  const [recipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const inventory = useRequests()
  const pos = usePos()
  const courses = pos.features.kdsCourses
  const stations: KdsStation[] = pos.data?.stations ?? []
  const [outlet, setOutlet] = useState('All outlets')
  const [station, setStation] = useState('All stations')
  const [notice, setNotice] = useState('')
  const now = useNow(15000)

  const productOf = (id: string) => products.find(item => item.id === id)
  const stationOf = (line: OrderLine): KdsStation | undefined => {
    const category = productOf(line.productId)?.category
    return stations.find(s => category && s.categories.includes(category))
  }
  const lineInStation = (line: OrderLine) => {
    if (station === 'All stations') return true
    if (courses) return stationOf(line)?.id === station
    return productOf(line.productId)?.category === station
  }
  const isHeld = (order: HeldOrder, line: OrderLine) => (order.heldCourses ?? []).includes(line.course ?? 'Main')

  const activeOrders = orders.filter(order => (order.kitchenStatus ?? 'New') !== 'Served' && (order.kitchenStatus ?? 'New') !== 'Cancelled')
  const visible = activeOrders.filter(order => (outlet === 'All outlets' || order.outlet === outlet) && order.items.some(lineInStation))

  function minutesSince(at: string) { return Math.max(0, Math.floor((now - new Date(at).getTime()) / 60000)) }
  function targetFor(line: OrderLine) { return courses ? stationOf(line)?.targetMinutes ?? SIMPLE_TARGET : SIMPLE_TARGET }
  function lineTone(order: HeldOrder, line: OrderLine) {
    const m = minutesSince(line.firedAt ?? order.createdAt)
    const target = targetFor(line)
    return m >= target * 2 ? 'bad' : m >= target ? 'warn' : 'good'
  }

  // All-day: what is still to be cooked across every open ticket, item by item.
  const allDay = new Map<string, { name: string; emoji: string; qty: number; held: number }>()
  for (const order of visible)
    for (const line of order.items) {
      if (!lineInStation(line) || line.status === 'Ready' || line.status === 'Served' || line.status === 'Cancelled') continue
      const p = productOf(line.productId)
      const row = allDay.get(line.productId) ?? { name: p?.name ?? line.productId, emoji: p?.emoji ?? '🍽️', qty: 0, held: 0 }
      if (isHeld(order, line)) row.held += line.qty
      else row.qty += line.qty
      allDay.set(line.productId, row)
    }
  const overdueLines = visible.flatMap(o => o.items.filter(l => lineInStation(l) && !isHeld(o, l) && l.status !== 'Ready' && l.status !== 'Served' && lineTone(o, l) === 'bad')).length

  function markLinePreparing(order: HeldOrder, lineIndex: number) {
    const at = new Date().toISOString()
    const items = order.items.map((line, index) => index === lineIndex ? { ...line, status: 'Preparing' as LineStatus, preparingAt: line.preparingAt ?? at } : line)
    setOrders(old => old.map(item => item.id === order.id ? { ...item, items, kitchenStatus: 'Preparing', preparingAt: item.preparingAt ?? at, updatedAt: at } : item))
  }

  function markLineReady(order: HeldOrder, lineIndex: number) {
    const line = order.items[lineIndex]
    if (!line || line.status === 'Ready' || line.status === 'Served') return
    const product = productOf(line.productId)
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
            deductions.push({ name: stockItem.name, qty: grossQuantity(converted, ingredient) * line.qty })
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
      : `${product?.name ?? 'Order item'} marked ready${stockDeducted ? ' and inventory deducted' : ''}.`)
  }

  function fireCourse(order: HeldOrder, course: string) {
    const at = new Date().toISOString()
    setOrders(old => old.map(o => o.id !== order.id ? o : {
      ...o,
      heldCourses: (o.heldCourses ?? []).filter(c => c !== course),
      items: o.items.map(l => (l.course ?? 'Main') === course ? { ...l, firedAt: l.firedAt ?? at } : l),
      updatedAt: at,
    }))
    setNotice(`${course} fired for ${order.id}.`)
  }

  function holdCourse(order: HeldOrder, course: string) {
    if (order.items.some(l => (l.course ?? 'Main') === course && l.status && l.status !== 'New')) return setNotice(`${course} for ${order.id} is already being cooked.`)
    setOrders(old => old.map(o => o.id !== order.id ? o : {
      ...o,
      heldCourses: [...new Set([...(o.heldCourses ?? []), course])],
      items: o.items.map(l => (l.course ?? 'Main') === course ? { ...l, firedAt: undefined } : l),
      updatedAt: new Date().toISOString(),
    }))
    setNotice(`${course} held for ${order.id}.`)
  }

  // A bumped ticket leaves the screen but stays open on the POS until it is paid.
  function bump(order: HeldOrder) {
    const at = new Date().toISOString()
    const served: HeldOrder = {
      ...order,
      kitchenStatus: 'Served',
      servedAt: at,
      updatedAt: at,
      items: order.items.map(line => ({ ...line, status: line.status === 'Cancelled' ? 'Cancelled' : 'Served', servedAt: line.servedAt ?? at })),
    }
    if (!archiveOrder(served)) { setNotice(`Could not archive ${order.id}; ticket remains open to prevent history loss.`); return }
    setHistory(old => [served, ...old.filter(item => item.id !== served.id)])
    setOrders(old => old.map(item => item.id === order.id ? served : item))
    setNotice(`Order ${order.id} bumped as served.`)
  }

  function recall(order: HeldOrder) {
    const at = new Date().toISOString()
    const back: HeldOrder = {
      ...order,
      kitchenStatus: 'Ready',
      servedAt: undefined,
      updatedAt: at,
      items: order.items.map(line => ({ ...line, status: line.status === 'Cancelled' ? 'Cancelled' : 'Ready', servedAt: undefined })),
    }
    setOrders(old => [back, ...old.filter(o => o.id !== order.id)])
    setHistory(old => old.filter(item => item.id !== order.id))
    setNotice(`Order ${order.id} recalled to the screen.`)
  }

  function cancelOrder(order: HeldOrder) {
    const deducted = order.items.some(line => line.stockDeducted)
    const choice = deducted
      ? window.prompt('Stock has already been deducted. Type RETURN to request a stock return, or WASTE to record spoilage/wastage.')
      : 'RETURN'
    if (choice !== 'RETURN' && choice !== 'WASTE') return
    const at = new Date().toISOString()
    const cancelled: HeldOrder = { ...order, kitchenStatus: 'Cancelled', cancelledAt: at, updatedAt: at, notes: `${order.notes}${order.notes ? ' · ' : ''}Cancellation stock disposition requested: ${choice}` }
    if (!archiveOrder(cancelled)) { setNotice(`Could not archive ${order.id}; ticket remains open to prevent history loss.`); return }
    setHistory(old => [cancelled, ...old.filter(item => item.id !== cancelled.id)])
    setOrders(old => old.filter(item => item.id !== order.id))
    setNotice(deducted
      ? `Order ${order.id} cancelled. ${choice} recorded in history for the storekeeper to complete.`
      : `Order ${order.id} cancelled. No stock had been deducted.`)
  }

  const categories = [...new Set(products.map(product => product.category))]
  const stationOptions = courses && stations.length ? stations.map(s => ({ key: s.id, label: s.name })) : categories.map(c => ({ key: c, label: c }))
  const pendingCount = activeOrders.filter(order => (order.kitchenStatus ?? 'New') !== 'Ready').length
  const readyCount = activeOrders.filter(order => order.kitchenStatus === 'Ready').length
  const outletNames = pos.outlets.length ? pos.outlets.map(o => o.name) : ['Restaurant', 'Bar']

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Restaurant & bar POS"
        title="Kitchen display"
        description={courses ? 'Tickets by station and course, with prep timers.' : 'Live tickets from the POS.'}
        actions={<Link to="/pos" className={buttonClass('primary')}>Open POS</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tickets" value={activeOrders.length} icon="list" />
        <StatCard label="In progress" value={pendingCount} icon="tasks" />
        <StatCard label="Ready to serve" value={readyCount} icon="check" tone={readyCount ? 'good' : 'default'} />
        <StatCard label="Overdue items" value={overdueLines} icon="alert" tone={overdueLines ? 'bad' : 'default'} />
      </div>

      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg border border-brand/20 bg-white px-4 py-3 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {outletNames.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {['All outlets', ...outletNames].map(o => <Chip key={o} active={outlet === o} onClick={() => setOutlet(o)}>{o}</Chip>)}
          </div>
        )}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ key: 'All stations', label: 'All stations' }, ...stationOptions].map(s => <Chip key={s.key} active={station === s.key} onClick={() => setStation(s.key)}>{s.label}</Chip>)}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        {!visible.length ? (
          <Card>
            <div className="py-10 text-center">
              <h2 className="text-lg font-bold">Kitchen is clear</h2>
              <Link to="/pos" className={`mt-4 ${buttonClass('primary')}`}>Create a POS order</Link>
            </div>
          </Card>
        ) : (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map(order => {
              const minutes = minutesSince(order.createdAt)
              const status = order.kitchenStatus ?? 'New'
              const ticketLines = order.items.map((line, index) => ({ ...line, index, product: productOf(line.productId) })).filter(line => line.product && lineInStation(line))
              const byCourse = COURSES.map(c => ({ course: c as string, lines: ticketLines.filter(l => (l.course ?? 'Main') === c) }))
                .concat([{ course: 'Other', lines: ticketLines.filter(l => !(COURSES as readonly string[]).includes(l.course ?? 'Main')) }])
                .filter(g => g.lines.length)
              return (
                <article key={order.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${minutes >= 25 ? 'border-rose-300' : minutes >= 12 ? 'border-amber-300' : 'border-emerald-200'}`}>
                  <div className="flex items-start justify-between gap-3 border-b border-black/5 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{order.id}</h2><Badge tone={status === 'Ready' ? 'good' : status === 'Preparing' ? 'warn' : 'neutral'}>{status}</Badge></div>
                      <p className="mt-1 text-sm text-ink/65">{order.outlet} · {order.orderType}{order.table ? ` · Table ${order.table}` : ''}{order.room ? ` · Room ${order.room}` : ''}{order.roomFloor ? ` · Floor ${order.roomFloor}` : ''}{order.deliverySetup ? ` · ${order.deliverySetup}` : ''}</p>
                      <p className="mt-1 text-xs text-ink/50">{order.customer || 'Walk-in guest'}{order.covers ? ` · ${order.covers} covers` : ''} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className={`shrink-0 rounded-xl px-3 py-2 text-center ${minutes >= 25 ? 'bg-rose-600 text-white' : minutes >= 12 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}><strong className="block text-xl">{minutes}</strong><span className="text-[10px] font-bold uppercase">min</span></div>
                  </div>
                  {(order.notes || order.allergy || order.vip) && (
                    <div className={`space-y-1 border-b border-black/5 p-3 ${order.severeAllergy ? 'bg-rose-600 text-white' : 'bg-rose-100/70'}`}>
                      {(order.notes || order.allergy) && <p className="text-sm font-bold">{order.severeAllergy ? 'SEVERE ALLERGY: ' : ''}{order.allergy ? `${order.allergy} · ` : ''}{order.notes}</p>}
                      {order.vip && <p className="text-sm font-bold text-amber-900">VIP guest</p>}
                    </div>
                  )}
                  <div className="space-y-3 p-4">
                    {byCourse.map(group => {
                      const held = (order.heldCourses ?? []).includes(group.course)
                      return (
                        <div key={group.course} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink/45">
                            <span>{group.course}{held ? ' · held' : ''}</span>
                            {courses && (held
                              ? <button onClick={() => fireCourse(order, group.course)} className="rounded-md bg-brand px-2 py-1 text-[11px] font-bold normal-case text-white">Fire</button>
                              : group.lines.every(l => !l.status || l.status === 'New') && <button onClick={() => holdCourse(order, group.course)} className="rounded-md border border-black/10 px-2 py-1 text-[11px] font-semibold normal-case">Hold</button>)}
                          </div>
                          {group.lines.map(line => {
                            const lineHeld = isHeld(order, line)
                            const done = line.status === 'Ready' || line.status === 'Served'
                            const tone = lineTone(order, line)
                            return (
                              <div key={`${order.id}-${line.lineId ?? line.productId}-${line.index}`} className={`rounded-xl border border-black/5 p-3 ${lineHeld ? 'opacity-50' : ''}`}>
                                <div className="flex items-start gap-3">
                                  <strong className="shrink-0 rounded-lg bg-sidebar px-2.5 py-1 text-sm text-white">{line.qty}×</strong>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{line.product?.name ?? 'Removed menu item'}</p>
                                    {line.modifiers?.length ? <p className="text-xs font-semibold text-brand">{line.modifiers.map(m => m.name).join(' · ')}</p> : null}
                                    <p className="text-xs text-ink/55">{courses ? stationOf(line)?.name ?? line.product?.category : line.product?.category} · {line.status ?? 'New'}{line.seat ? ` · seat ${line.seat}` : ''}</p>
                                    {line.note && <p className="mt-1 text-xs font-semibold text-amber-800">Note: {line.note}</p>}
                                    {line.stockDeductionError && <p className="mt-1 text-xs font-semibold text-rose-700">Stock not deducted: {line.stockDeductionError}</p>}
                                  </div>
                                  {!lineHeld && !done && <Badge tone={tone}>{minutesSince(line.firedAt ?? order.createdAt)}m</Badge>}
                                  {done && <Badge tone="good">Ready</Badge>}
                                </div>
                                {!lineHeld && !done && (
                                  <div className="mt-2 flex gap-2">
                                    {line.status !== 'Preparing' && <button onClick={() => markLinePreparing(order, line.index)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold">Start</button>}
                                    <button onClick={() => markLineReady(order, line.index)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Ready</button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {status === 'Ready' && <button onClick={() => bump(order)} className="flex-1 rounded-lg bg-sidebar px-3 py-2.5 text-sm font-bold text-white">Bump · served</button>}
                      <button onClick={() => cancelOrder(order)} className="rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700">Cancel</button>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        <div className="space-y-5">
          <Card title="All day" count={allDay.size}>
            {allDay.size === 0 ? <p className="text-sm text-ink/55">Nothing waiting.</p> : (
              <ul className="space-y-1.5 text-sm">
                {[...allDay.values()].sort((a, b) => b.qty - a.qty).map(row => (
                  <li key={row.name} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{row.emoji} {row.name}</span>
                    <span className="shrink-0 font-bold tabular-nums">{row.qty}{row.held ? <span className="ml-1 text-xs font-normal text-ink/50">+{row.held} held</span> : null}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Recently bumped" count={history.length}>
            {history.length === 0 ? <p className="text-sm text-ink/55">None yet.</p> : (
              <ul className="space-y-2 text-sm">
                {history.slice(0, 6).map(order => (
                  <li key={order.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-semibold">{order.id}</span>
                      <span className="block text-xs text-ink/55">{order.outlet} · {order.kitchenStatus}{order.servedAt ? ` ${new Date(order.servedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                    </span>
                    {order.kitchenStatus === 'Served' && !order.paidAt && <button onClick={() => recall(order)} className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold">Recall</button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
