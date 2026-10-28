import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, PageHeader, StatCard } from '../../components/ui'
import { readBrowserValue, useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useHotel } from '../../lib/hotelContext'
import { useNow } from '../../lib/useNow'
import type { Check, SplitMode } from '../../services/pos/posTypes'
import { useAuth } from '../auth/authContext'
import { useRequests } from '../procurement/requestsContext'
import DiscountDialog from './DiscountDialog'
import HeldOrdersCard from './HeldOrdersCard'
import MenuManagement from './MenuManagement'
import ModifierDialog from './ModifierDialog'
import PaymentsView from './PaymentsView'
import ReceiptDialog from './ReceiptDialog'
import RecipesEditor from './RecipesEditor'
import RoomChargePicker from './RoomChargePicker'
import SalesHistory from './SalesHistory'
import SplitBillDialog from './SplitBillDialog'
import type { CheckPayInput } from './SplitBillDialog'
import TablesManager from './TablesManager'
import { cash } from './posFormat'
import { deductOrderStock, saleItemsOf } from './posCheckout'
import { checkRoomCharge, hhmmOf, hoursLabel, largestDiscountPercent, lineDiscountOf, lineGross, orderTotals, withinHours } from './posRules'
import type { PricedLine, SplitPart } from './posRules'
import { BASE_PRODUCTS, DEFAULT_TABLES, EXTRA_PRODUCTS } from './posSeed'
import { archiveOrder, migratePosStorage } from './posStore'
import { COURSES, POS_STORAGE_KEYS } from './posTypes'
import type { HeldOrder, Line, LineModifier, OrderType, Outlet, Payment, Product, Recipes, Sale } from './posTypes'
import { calculateAvailability } from './recipeEngine'
import { errorText, usePos } from './usePos'

// POS and KDS share these contracts; legacy storage shapes remain compatible.

migratePosStorage()

const seed: Product[] = [...BASE_PRODUCTS, ...EXTRA_PRODUCTS]

/** What another POS screen (the floor plan) hands over when it opens an order here. */
export type PosNavState = { outlet?: string; table?: string; covers?: number; resume?: HeldOrder; productId?: string } | null

function selectedGuestAlert(guestId: string, guests: ReturnType<typeof useHotel>['guests']): string {
  const guest = guests.find(item => item.id === guestId)
  if (!guest) return ''
  return [guest.preferences?.diet, ...(guest.notes ?? []).map(note => note.text)].filter(Boolean).join(' · ')
}

function courseFor(product: Product): string {
  const c = product.category.toLowerCase()
  if (/drink|beer|wine|mocktail|smoothie|juice|minibar/.test(c)) return 'Drinks'
  if (/starter/.test(c)) return 'Starter'
  if (/dessert/.test(c)) return 'Dessert'
  return 'Main'
}

const SECTIONS: { to: string; label: string; feature?: 'posFloorPlan' | 'foodCost' }[] = [
  { to: '/pos', label: 'New order' },
  { to: '/pos/orders', label: 'Orders' },
  { to: '/pos/floor', label: 'Floor plan', feature: 'posFloorPlan' },
  { to: '/pos/tables', label: 'Tables' },
  { to: '/pos/menu', label: 'Menu management' },
  { to: '/pos/outlets', label: 'Outlets and add-ons' },
  { to: '/pos/payments', label: 'Payments' },
  { to: '/pos/recipes', label: 'Recipes and stock' },
  { to: '/pos/food-cost', label: 'Food cost', feature: 'foodCost' },
  { to: '/kitchen', label: 'Kitchen display' },
]

export default function PosPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isOrders = location.pathname.endsWith('/orders')
  const isTables = location.pathname.endsWith('/tables')
  const isMenu = location.pathname.endsWith('/menu')
  const isPayments = location.pathname.endsWith('/payments')
  const isRecipes = location.pathname.endsWith('/recipes')
  const isSale = !isOrders && !isTables && !isMenu && !isPayments && !isRecipes
  const nav = (location.state ?? null) as PosNavState
  const init = nav?.resume

  // The hand-over is used once; clearing it stops a reload from restoring an order again.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const inventory = useRequests()
  const hotel = useHotel()
  const { user } = useAuth()
  const pos = usePos()
  const now = useNow()
  const { features } = pos

  const [outlet, setOutlet] = useState<Outlet>(init?.outlet ?? nav?.outlet ?? 'Restaurant')
  const [category, setCategory] = useState('All items')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Line[]>(() => init ? init.items.map((line, index) => ({ ...line, lineId: line.lineId ?? `${init.id}-line-${index + 1}` })) : [])
  const [activeOrderId, setActiveOrderId] = useState<string | null>(init?.id ?? null)
  const [payment, setPayment] = useState<Payment>('Cash')
  const [room, setRoom] = useState(init?.room ?? '')
  const [orderType, setOrderType] = useState<OrderType>(init?.orderType ?? 'Dine-in')
  const [table, setTable] = useState(init ? (init.orderType === 'Dine-in' ? init.table : '') : nav?.table ?? '')
  const [deliveryAddress, setDeliveryAddress] = useState(init?.orderType === 'Delivery' ? init.table : '')
  const [customer, setCustomer] = useState(init?.customer ?? '')
  const [guestId, setGuestId] = useState(init?.guestId ?? '')
  const [roomFloor, setRoomFloor] = useState(init?.roomFloor ?? '')
  const [deliverySetup, setDeliverySetup] = useState<'Tray' | 'Rolling table' | 'Silver service'>(init?.deliverySetup ?? 'Tray')
  const [orderNotes, setOrderNotes] = useState(init?.notes ?? '')
  const [discountPercent, setDiscountPercent] = useState(String(init?.discountPercent ?? 0))
  const [orderDiscountReason, setOrderDiscountReason] = useState(init?.orderDiscountReason ?? '')
  const [discountApprovedBy, setDiscountApprovedBy] = useState(init?.discountApprovedBy ?? '')
  const [covers, setCovers] = useState(String(init?.covers ?? nav?.covers ?? ''))
  const [cashTendered, setCashTendered] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [tip, setTip] = useState('')
  const [chargeReservation, setChargeReservation] = useState('')
  const [holdLater, setHoldLater] = useState(false)
  const [notice, setNotice] = useState(init ? `Order ${init.id} restored. Inventory has not been changed.` : nav?.table ? `${nav.table} selected. Add items to start the table order.` : '')

  const [products] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const [heldOrders, setHeldOrders] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const [legacyTables] = useBrowserSyncedState<string[]>(POS_STORAGE_KEYS.tables, DEFAULT_TABLES)
  const [sales, setSales] = useBrowserSyncedState<Sale[]>(POS_STORAGE_KEYS.sales, [])
  const [recipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const [lowPortionThreshold] = useBrowserSyncedState<number>('gastora.pos.lowPortionThreshold.v1', 5)
  const [paying, setPaying] = useState(false)
  const [currentOrderOpen, setCurrentOrderOpen] = useState(true)
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null)
  const [modifierFor, setModifierFor] = useState<Product | null>(null)
  const [discountFor, setDiscountFor] = useState<string | null>(null)
  const [splitOpen, setSplitOpen] = useState(false)
  const [confirmRoom, setConfirmRoom] = useState(false)
  const [busy, setBusy] = useState(false)

  // ------------------------------------------------------------ outlet
  const outlets = pos.outlets
  const currentOutlet = outlets.find(o => o.name === outlet) ?? outlets[0]
  const outletName: string = currentOutlet?.name ?? outlet
  const allOutletNames = (pos.data?.outlets ?? []).map(o => o.name)
  const nowHhmm = hhmmOf(now)
  const serviceChargePercent = currentOutlet?.serviceChargePercent ?? 0
  const discountLimit = currentOutlet?.discountApprovalPercent ?? 15
  const folioCategory = currentOutlet?.folioCategory ?? 'Restaurant'
  const controls = pos.data?.folioControls ?? []

  function switchOutlet(name: string) {
    const next = outlets.find(o => o.name === name)
    setOutlet(name)
    setCategory('All items')
    if (!cart.length && next) {
      const type: OrderType = next.type === 'roomService' || next.type === 'minibar' ? 'Room service' : next.type === 'retail' ? 'Takeaway' : 'Dine-in'
      setOrderType(type)
      if (type !== 'Dine-in') setTable('')
      if (next.type === 'minibar') setPayment('Room charge')
    }
  }

  const categories = useMemo(
    () => ['All items', ...new Set(products.filter(p => p.outlet === outletName).map(p => p.category))],
    [products, outletName],
  )

  // Availability and recipe costing are pure calculations over the shared inventory state.
  function availability(product: Product) {
    return calculateAvailability(product, recipes, inventory.stock, inventory.stockOf)
  }
  function availableServings(product: Product): number {
    return availability(product).portions
  }

  function requestRestock(product: Product) {
    const limitingName = availability(product).limitingIngredient
    const item = limitingName ? inventory.stock.find((entry) => entry.name === limitingName) : undefined
    if (!item) return setNotice(`Cannot determine a limiting stock item for ${product.name}. Check its recipe mapping.`)
    const target = item.par ?? Math.max(item.reorderAt, item.onHand + 1)
    const result = inventory.topUp([{ itemId: item.id, qty: Math.max(1, Math.ceil(target - item.onHand)) }])
    setNotice(result.ok ? `Restock request ${result.value} raised for ${item.name}.` : result.error)
  }

  const shown = products.filter(
    p => p.available !== false && p.outlet === outletName && (category === 'All items' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase().trim()),
  )
  const combos = (pos.data?.combos ?? []).filter(c => c.active && c.outletId === currentOutlet?.id)

  const lines: PricedLine[] = cart.map(l => ({ ...l, product: products.find(p => p.id === l.productId)! })).filter(l => l.product)
  const totals = orderTotals(lines, Number(discountPercent) || 0, serviceChargePercent, currentOutlet?.tipsEnabled === false ? 0 : Number(tip) || 0)
  const { subtotal, discount, total } = totals
  const changeDue = Math.max(0, (Number(cashTendered) || 0) - total)
  const count = cart.reduce((sum, l) => sum + l.qty, 0)
  const needsApproval = largestDiscountPercent(cart, Number(discountPercent) || 0) > discountLimit
  const approver = discountApprovedBy || (pos.isManager ? user?.name ?? '' : '')

  const todaySales = sales.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0)

  // Tables: the floor plan's tables for an outlet that seats guests, otherwise the simple list.
  const floorTables = (pos.data?.tables ?? []).filter(t => t.outletId === currentOutlet?.id && !t.mergedInto)
  const useFloor = features.posFloorPlan && currentOutlet?.hasTables === true && floorTables.length > 0
  const tableNames = useFloor ? floorTables.map(t => t.name) : outletName === 'Restaurant' ? legacyTables : []
  const tableRequired = useFloor || outletName === 'Restaurant'
  const occupiedTables = new Set(heldOrders.filter(order => order.orderType === 'Dine-in' && order.table && order.outlet === outletName).map(order => order.table))
  const availableTables = tableNames.filter(tableId => !occupiedTables.has(tableId) || tableId === table)

  // ------------------------------------------------------------ cart
  const qtyOf = (productId: string) => cart.filter(l => l.productId === productId).reduce((s, l) => s + l.qty, 0)

  function canAdd(product: Product, more: number): boolean {
    if (product.available === false) {
      setNotice(`${product.name} is manually marked unavailable (86).`)
      return false
    }
    if (product.trackStock !== false) {
      const available = availableServings(product)
      const currentQty = qtyOf(product.id)
      if (available < currentQty + more) {
        const limiting = availability(product).limitingIngredient
        setNotice(available === 0 || available <= currentQty ? `${product.name} is sold out (86).${limiting ? ` Limiting ingredient: ${limiting}.` : ''}` : `Only ${available} portion(s) of ${product.name} are available.`)
        return false
      }
    }
    return true
  }

  function add(product: Product) {
    setNotice('')
    const groups = (pos.data?.modifierGroups ?? []).filter(g => g.productIds.includes(product.id))
    if (groups.length) {
      if (canAdd(product, 1)) setModifierFor(product)
      return
    }
    addLine(product, [])
  }

  function addLine(product: Product, modifiers: LineModifier[]) {
    if (!canAdd(product, 1)) return
    setCart(old => {
      const plain = !modifiers.length && old.find(line => line.productId === product.id && !line.modifiers?.length && !line.comboRef && !line.discountPercent)
      if (plain) return old.map(line => line === plain ? { ...line, qty: line.qty + 1 } : line)
      return [...old, { productId: product.id, lineId: `LINE-${Date.now()}-${product.id}`, qty: 1, course: courseFor(product), ...(modifiers.length ? { modifiers } : {}) }]
    })
  }

  function addCombo(comboId: string) {
    const combo = combos.find(c => c.id === comboId)
    if (!combo) return
    const parts = combo.items.map(item => ({ item, product: products.find(p => p.id === item.productId) }))
    const missing = parts.find(p => !p.product)
    if (missing) return setNotice(`${combo.name} includes an item that is no longer on the menu.`)
    for (const p of parts) if (!canAdd(p.product as Product, p.item.qty)) return
    const listPrice = parts.reduce((s, p) => s + (p.product as Product).price * p.item.qty, 0)
    const ref = `CMB-${Date.now()}`
    let allocated = 0
    const newLines: Line[] = parts.map((p, index) => {
      const product = p.product as Product
      const isLast = index === parts.length - 1
      const unit = isLast
        ? Math.round((combo.price - allocated) / p.item.qty)
        : Math.round((product.price * combo.price) / listPrice)
      allocated += unit * p.item.qty
      return { productId: product.id, lineId: `${ref}-${index + 1}`, qty: p.item.qty, unitPrice: unit, comboId: combo.id, comboRef: ref, comboName: combo.name, course: courseFor(product) }
    })
    setCart(old => [...old, ...newLines])
    setNotice(`${combo.name} added.`)
  }

  function qty(lineId: string, delta: number) {
    const line = cart.find(l => l.lineId === lineId)
    if (!line) return
    const product = products.find((entry) => entry.id === line.productId)
    if (delta > 0 && product && product.trackStock !== false && qtyOf(product.id) >= availableServings(product)) {
      setNotice(`Cannot add more ${product.name}; only ${availableServings(product)} portion(s) are available.`)
      return
    }
    // A combo is sold whole: removing one part removes the combo.
    if (line.comboRef && delta < 0 && line.qty + delta <= 0) {
      setCart(old => old.filter(l => l.comboRef !== line.comboRef))
      return
    }
    setCart(old => old.map(l => l.lineId === lineId ? { ...l, qty: Math.max(0, l.qty + delta) } : l).filter(l => l.qty > 0))
  }

  function updateCartLine(lineId: string, patch: Partial<Line>) {
    setCart(old => old.map(line => line.lineId === lineId ? { ...line, ...patch } : line))
  }

  function resetCurrentOrder() {
    setCart([])
    setActiveOrderId(null)
    setRoom('')
    setTable('')
    setDeliveryAddress('')
    setCustomer('')
    setGuestId('')
    setRoomFloor('')
    setDeliverySetup('Tray')
    setOrderNotes('')
    setDiscountPercent('0')
    setOrderDiscountReason('')
    setDiscountApprovedBy('')
    setCovers('')
    setCashTendered('')
    setPaymentReference('')
    setTip('')
    setChargeReservation('')
    setHoldLater(false)
    setPaying(false)
  }

  // ------------------------------------------------------------ held orders
  function saveHeldOrder() {
    if (!lines.length) {
      setNotice('Add at least one item before saving an order.')
      return
    }
    const now = new Date().toISOString()
    const present = new Set(cart.map(l => l.course ?? 'Main'))
    const heldCourses = features.kdsCourses && holdLater && (present.has('Drinks') || present.has('Starter'))
      ? ['Main', 'Dessert'].filter(c => present.has(c))
      : []
    // Preserve the existing HeldOrder data shape:
    // table stores the table ID for Dine-in or the delivery address for Delivery.
    const held: HeldOrder = {
      id: activeOrderId ?? `ORD-${Date.now().toString().slice(-7)}`,
      createdAt: now,
      outlet: outletName,
      orderType,
      table: orderType === 'Dine-in' ? table : orderType === 'Delivery' ? deliveryAddress.trim() : '',
      room,
      roomFloor,
      deliverySetup: orderType === 'Room service' ? deliverySetup : undefined,
      customer,
      guestId: guestId || undefined,
      allergy: selectedGuestAlert(guestId, hotel.guests),
      severeAllergy: /anaphylaxis|severe allergy|epipen|epinephrine/i.test(selectedGuestAlert(guestId, hotel.guests)),
      vip: hotel.guests.find(guest => guest.id === guestId)?.vip ?? false,
      notes: orderNotes,
      discountPercent: Math.min(100, Math.max(0, Number(discountPercent) || 0)),
      orderDiscountReason: orderDiscountReason || undefined,
      discountApprovedBy: needsApproval && approver ? approver : undefined,
      discountNeedsApproval: needsApproval && !approver ? true : undefined,
      serviceChargePercent,
      covers: Number(covers) || undefined,
      heldCourses: heldCourses.length ? heldCourses : undefined,
      createdBy: user?.name,
      items: cart.map((line, index) => ({
        ...line,
        lineId: line.lineId ?? `ORD-${Date.now()}-line-${index + 1}`,
        status: line.status ?? 'New',
        ...(heldCourses.includes(line.course ?? 'Main') ? {} : { firedAt: line.firedAt ?? now }),
      })),
      kitchenStatus: 'New',
    }

    const latest = readBrowserValue<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, heldOrders)
    setHeldOrders([held, ...latest.filter(order => order.id !== held.id)])
    if (useFloor && orderType === 'Dine-in' && table) {
      const t = floorTables.find(x => x.name === table)
      if (t && t.status === 'free') void pos.service.setTableStatus(pos.pid, t.id, 'seated', pos.actor, Math.min(t.seats, Number(covers) || 1)).catch(() => undefined)
    }
    resetCurrentOrder()
    setNotice(`Order ${held.id} sent to the kitchen/bar${heldCourses.length ? `; ${heldCourses.join(' and ').toLowerCase()} held until fired` : ''}. No payment recorded and no inventory deducted.`)
  }

  function resumeHeldOrder(held: HeldOrder) {
    setOutlet(held.outlet)
    setActiveOrderId(held.id)
    setCart(held.items.map((line, index) => ({ ...line, lineId: line.lineId ?? `${held.id}-line-${index + 1}` })))
    setOrderType(held.orderType)
    setTable(held.orderType === 'Dine-in' ? held.table : '')
    setDeliveryAddress(held.orderType === 'Delivery' ? held.table : '')
    setRoom(held.room)
    setCustomer(held.customer)
    setGuestId(held.guestId ?? '')
    setRoomFloor(held.roomFloor ?? '')
    setDeliverySetup(held.deliverySetup ?? 'Tray')
    setOrderNotes(held.notes)
    setDiscountPercent(String(held.discountPercent))
    setOrderDiscountReason(held.orderDiscountReason ?? '')
    setDiscountApprovedBy(held.discountApprovedBy ?? '')
    setCovers(String(held.covers ?? ''))
    setHeldOrders(old => old.filter(order => order.id !== held.id))
    setPaying(false)
    setCurrentOrderOpen(true)
    navigate('/pos')
    setNotice(`Order ${held.id} restored. Inventory has not been changed.`)
  }

  function fireCourse(held: HeldOrder, course: string) {
    const at = new Date().toISOString()
    setHeldOrders(old => old.map(o => o.id !== held.id ? o : {
      ...o,
      heldCourses: (o.heldCourses ?? []).filter(c => c !== course),
      items: o.items.map(l => (l.course ?? 'Main') === course ? { ...l, firedAt: l.firedAt ?? at } : l),
      updatedAt: at,
    }))
    setNotice(`${course} fired for ${held.id}.`)
  }

  function approveDiscount(held: HeldOrder) {
    setHeldOrders(old => old.map(o => o.id === held.id ? { ...o, discountApprovedBy: user?.name ?? 'Manager', discountNeedsApproval: undefined, updatedAt: new Date().toISOString() } : o))
    setNotice(`Discount on ${held.id} approved by ${user?.name ?? 'you'}.`)
  }

  // ------------------------------------------------------------ payment
  /** Checks shared by paying in one go and by splitting. Returns the problem, or null. */
  function orderProblem(): string | null {
    if (!lines.length) return 'Add an item before checkout.'
    if (lines.some(line => line.product.available === false)) return 'One or more items in the current order are unavailable. Remove them before checkout.'
    if (orderType === 'Room service' && !room.trim()) return 'Enter the guest room number for a room-service order.'
    if (orderType === 'Dine-in' && tableRequired && !table.trim()) return 'Select a table for dine-in orders.'
    if (orderType === 'Delivery' && !deliveryAddress.trim()) return 'Enter a delivery address.'
    if (needsApproval && !approver) return `A discount above ${discountLimit}% needs a manager. Send the order and ask a manager to approve it.`
    if (Number(discountPercent) > 0 && !orderDiscountReason.trim()) return 'Give a reason for the order discount.'
    return null
  }

  const chargeTarget = hotel.reservations.find(r => r.id === chargeReservation)
  const roomCheck = payment === 'Room charge'
    ? checkRoomCharge(chargeTarget, hotel.reservations, total, folioCategory, controls.find(c => c.reservationId === chargeReservation))
    : null

  function checkout() {
    const problem = orderProblem()
    if (problem) return setNotice(problem)
    if (payment === 'Room charge') {
      if (!roomCheck || !roomCheck.ok) return setNotice(roomCheck && !roomCheck.ok ? `Cannot charge to the room: ${roomCheck.reasons.join('; ')}.` : 'Choose the guest to charge.')
      setConfirmRoom(true)
      return
    }
    if (payment === 'Cash' && (Number(cashTendered) || 0) < total) return setNotice(`Amount tendered must be at least ${cash(total)}.`)
    if ((payment === 'Mobile money' || payment === 'Card') && !paymentReference.trim()) {
      return setNotice(`Enter the ${payment === 'Card' ? 'card transaction' : 'mobile money transaction'} reference.`)
    }
    void completePayment()
  }

  const orderRef = activeOrderId ?? `CART-${cart.map(line => line.lineId ?? line.productId).join('-')}`

  /** Posts a bill to the folio the room-charge check chose, and records the posting. */
  async function postToRoom(amount: number, reservationId: string, checkId?: string): Promise<{ id: string; room: string; guestId?: string; reservationId: string } | string> {
    const target = hotel.reservations.find(r => r.id === reservationId)
    const result = checkRoomCharge(target, hotel.reservations, amount, folioCategory, controls.find(c => c.reservationId === reservationId))
    if (!result.ok) return `Cannot charge to the room: ${result.reasons.join('; ')}.`
    hotel.addCharge(result.reservation.id, { category: folioCategory, description: `${outletName} · ${activeOrderId ?? 'POS sale'}${checkId ? ' (split)' : ''}`, amount })
    const posting = await pos.service.recordPosting(pos.pid, {
      outletId: currentOutlet?.id ?? outletName,
      orderId: orderRef,
      checkId,
      reservationId: result.reservation.id,
      postedToReservationId: result.postTo.id,
      guest: result.reservation.guest,
      room: result.reservation.room ?? '',
      category: folioCategory,
      amount,
    }, pos.actor)
    return { id: posting.id, room: result.reservation.room ?? '', guestId: result.reservation.guestId, reservationId: result.reservation.id }
  }

  function baseSale(saleId: string): Omit<Sale, 'payment' | 'total' | 'items'> {
    return {
      id: saleId,
      createdAt: new Date().toISOString(),
      outlet: outletName,
      orderType,
      ...(orderType === 'Dine-in' && table.trim() ? { table: table.trim() } : {}),
      ...(orderType === 'Delivery' && deliveryAddress.trim() ? { table: deliveryAddress.trim() } : {}),
      ...(customer.trim() ? { customer: customer.trim() } : {}),
      ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
      ...(orderType === 'Room service' ? { room: room.trim() } : {}),
      ...(guestId ? { guestId } : {}),
      ...(activeOrderId ? { orderId: activeOrderId } : {}),
      recordedBy: user?.name,
    }
  }

  /** Everything after the money is in: history, discounts, the table, a clean order screen. */
  function finishOrder(message: string) {
    if (activeOrderId) {
      const active = readBrowserValue<HeldOrder[]>(POS_STORAGE_KEYS.orderHistory, []).find(order => order.id === activeOrderId)
      const paidAt = new Date().toISOString()
      const paidOrder: HeldOrder = { ...(active ?? ({} as HeldOrder)), id: activeOrderId, createdAt: active?.createdAt ?? paidAt, outlet: outletName, orderType, table, room, customer, notes: orderNotes, discountPercent: Number(discountPercent) || 0, items: cart, paidAt, updatedAt: paidAt }
      archiveOrder(paidOrder)
    }
    const applied = [
      ...lines.filter(l => (l.discountPercent ?? 0) > 0).map(l => ({ orderId: orderRef, orderLineId: l.lineId, percent: l.discountPercent ?? 0, amount: lineDiscountOf(l, l.product), reason: l.discountReason ?? 'Line discount', approvedBy: (l.discountPercent ?? 0) > discountLimit ? approver : undefined })),
      ...(totals.orderDiscount > 0 ? [{ orderId: orderRef, percent: Number(discountPercent) || 0, amount: totals.orderDiscount, reason: orderDiscountReason || 'Order discount', approvedBy: (Number(discountPercent) || 0) > discountLimit ? approver : undefined }] : []),
    ]
    if (applied.length) void pos.service.recordDiscounts(pos.pid, applied, pos.actor).catch(() => undefined)
    if (useFloor && orderType === 'Dine-in' && table) {
      const t = floorTables.find(x => x.name === table)
      if (t) void pos.service.setTableStatus(pos.pid, t.id, 'cleaning', pos.actor).catch(() => undefined)
    }
    resetCurrentOrder()
    setSplitOpen(false)
    setNotice(message)
  }

  async function completePayment() {
    setConfirmRoom(false)
    setBusy(true)
    try {
      const saleId = `POS-${Date.now().toString().slice(-7)}`
      const stock = deductOrderStock(lines, recipes, inventory, orderRef, saleId, outletName)
      if (!stock.ok) return setNotice(stock.error)

      let roomInfo: { id: string; room: string; guestId?: string; reservationId: string } | undefined
      if (payment === 'Room charge') {
        const posted = await postToRoom(total, chargeReservation)
        if (typeof posted === 'string') return setNotice(posted)
        roomInfo = posted
      }
      const sale: Sale = {
        ...baseSale(saleId),
        payment,
        total,
        subtotal,
        discount,
        ...(totals.serviceCharge ? { serviceCharge: totals.serviceCharge } : {}),
        ...(totals.tip ? { tip: totals.tip } : {}),
        ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
        ...(payment === 'Cash' ? { amountTendered: Number(cashTendered) || total, changeDue } : {}),
        items: saleItemsOf(lines),
        ...(roomInfo ? { room: roomInfo.room, reservationId: roomInfo.reservationId, roomPostingId: roomInfo.id, ...(roomInfo.guestId ? { guestId: roomInfo.guestId } : {}) } : {}),
      }
      const latestSales = readBrowserValue<Sale[]>(POS_STORAGE_KEYS.sales, sales)
      setSales([sale, ...latestSales.filter(existing => existing.id !== sale.id)])
      finishOrder(`Sale ${sale.id} recorded: ${cash(sale.total)} via ${sale.payment}${roomInfo ? ` to room ${roomInfo.room}` : ''}. Inventory deduction ledger recorded ${stock.refs.length} line(s) and ${stock.movements} ingredient movement(s); lines already deducted by Kitchen were skipped.`)
    } catch (e) {
      setNotice(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // ------------------------------------------------------------ split bill
  const orderChecks = (pos.data?.checks ?? []).filter(c => c.orderId === orderRef)

  function openSplit() {
    const problem = orderProblem()
    if (problem) return setNotice(problem)
    setSplitOpen(true)
  }

  async function createChecks(parts: SplitPart[], mode: SplitMode): Promise<string | null> {
    try {
      if (mode === 'none') {
        await pos.service.voidOpenChecks(pos.pid, orderRef, pos.actor)
        return null
      }
      await pos.service.splitChecks(pos.pid, orderRef, parts.map(p => ({ ...p, outletId: currentOutlet?.id ?? outletName, orderId: orderRef, splitMode: mode })), pos.actor)
      return null
    } catch (e) {
      return errorText(e)
    }
  }

  async function payCheck(check: Check, input: CheckPayInput): Promise<string | null> {
    if (input.method === 'Cash' && input.tendered < check.total) return `Cash received must be at least ${cash(check.total)}.`
    if ((input.method === 'Card' || input.method === 'Mobile money') && !input.reference.trim()) return 'Enter the transaction reference.'
    try {
      const saleBase = `POS-${orderRef.replace(/\D/g, '').slice(-7) || Date.now().toString().slice(-7)}`
      const stock = deductOrderStock(lines, recipes, inventory, orderRef, saleBase, outletName)
      if (!stock.ok) return stock.error
      let roomInfo: { id: string; room: string; guestId?: string; reservationId: string } | undefined
      if (input.method === 'Room charge') {
        const posted = await postToRoom(check.total, input.reservationId, check.id)
        if (typeof posted === 'string') return posted
        roomInfo = posted
      }
      await pos.service.payCheck(pos.pid, check.id, { checkId: check.id, method: input.method, amount: check.total, reference: input.reference.trim() || undefined, roomPostingId: roomInfo?.id }, pos.actor)
      const own = lines.filter(l => check.lineIds.includes(l.lineId ?? l.productId))
      const checks = orderChecks.length
      const sale: Sale = {
        ...baseSale(`${saleBase}-${check.label.replace(/\s+/g, '')}`),
        payment: input.method,
        total: check.total,
        subtotal: check.subtotal,
        discount: check.discount,
        ...(check.serviceCharge ? { serviceCharge: check.serviceCharge } : {}),
        ...(check.tip ? { tip: check.tip } : {}),
        ...(input.reference.trim() ? { paymentReference: input.reference.trim() } : {}),
        ...(input.method === 'Cash' ? { amountTendered: input.tendered, changeDue: Math.max(0, input.tendered - check.total) } : {}),
        items: own.length ? saleItemsOf(own) : [{ name: `Equal share ${check.label} of ${checks}`, qty: 1, price: check.subtotal - check.discount }],
        checkLabel: check.label,
        checkCount: checks,
        ...(roomInfo ? { room: roomInfo.room, reservationId: roomInfo.reservationId, roomPostingId: roomInfo.id } : {}),
      }
      setSales(old => [sale, ...old.filter(s => s.id !== sale.id)])
      const remaining = orderChecks.filter(c => c.status === 'open' && c.id !== check.id).length
      if (remaining === 0) finishOrder(`Split bill settled: ${checks} checks, ${cash(total)} in all.`)
      return null
    } catch (e) {
      return errorText(e)
    }
  }

  // ------------------------------------------------------------ render
  const lowPortion = products.filter(product => product.outlet === outletName && product.available !== false && product.trackStock !== false && availableServings(product) > 0 && availableServings(product) <= lowPortionThreshold)
  const sectionValue = isOrders ? '/pos/orders' : isTables ? '/pos/tables' : isMenu ? '/pos/menu' : isPayments ? '/pos/payments' : isRecipes ? '/pos/recipes' : '/pos'
  const discountLine = discountFor && discountFor !== 'order' ? lines.find(l => l.lineId === discountFor) : undefined

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Restaurant & bar POS"
        title={isOrders ? 'Orders' : isTables ? 'Tables' : isMenu ? 'Menu management' : isPayments ? 'Payments' : isRecipes ? 'Recipes and stock' : 'New order'}
        description={isSale && currentOutlet ? `${currentOutlet.name} · ${hoursLabel(currentOutlet)}` : undefined}
        actions={
          <label className="text-sm font-semibold text-ink/60">
            <span className="sr-only">POS section</span>
            <select
              aria-label="POS section"
              value={sectionValue}
              onChange={e => navigate(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              {SECTIONS.filter(s => !s.feature || features[s.feature]).map(s => <option key={s.to} value={s.to}>{s.label}</option>)}
            </select>
          </label>
        }
      />

      {(isSale || isOrders) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Today's sales" value={cash(todayTotal)} icon="money" />
          <StatCard label="Completed orders today" value={todaySales.length} icon="check" />
          <StatCard label="Open orders" value={heldOrders.length} icon="tasks" tone={heldOrders.some(o => o.discountNeedsApproval) ? 'warn' : 'default'} />
          <StatCard label="Items in current order" value={count} icon="list" />
        </div>
      )}

      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg border border-brand/20 bg-white px-4 py-3 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}

      {isMenu && <MenuManagement outletNames={allOutletNames} cartProductIds={cart.map(l => l.productId)} onNotice={setNotice} />}
      {isRecipes && <RecipesEditor outletNames={allOutletNames} initialProductId={nav?.productId} onNotice={setNotice} />}
      {isTables && (
        <TablesManager
          heldOrders={heldOrders}
          currentTable={table}
          onCurrentTableChange={setTable}
          onResume={resumeHeldOrder}
          onStart={tableId => {
            setOutlet('Restaurant')
            setOrderType('Dine-in')
            setTable(tableId)
            setDeliveryAddress('')
            setCurrentOrderOpen(true)
            navigate('/pos')
            setNotice(`${tableId} selected. Add items to start the table order.`)
          }}
          onNotice={setNotice}
        />
      )}
      {isPayments && <PaymentsView sales={sales} postings={pos.data?.postings ?? []} discounts={pos.data?.discounts ?? []} onReceipt={setSelectedReceipt} />}

      {isOrders && (
        <>
          <HeldOrdersCard orders={heldOrders} courseControl={features.kdsCourses} canApprove={pos.isManager} onResume={resumeHeldOrder} onCancel={held => setHeldOrders(old => old.filter(x => x.id !== held.id))} onFire={fireCourse} onApprove={approveDiscount} />
          <SalesHistory sales={sales} onReceipt={setSelectedReceipt} />
        </>
      )}

      {isSale && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-4">
            {outlets.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Outlet">
                {outlets.map(o => {
                  const open = withinHours(o, nowHhmm)
                  return (
                    <button key={o.id} role="tab" aria-selected={o.name === outletName} onClick={() => switchOutlet(o.name)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${o.name === outletName ? 'bg-brand text-white' : 'border border-black/10 bg-white'}`}>
                      <span aria-hidden="true">{o.emoji}</span>{o.name}
                      {!open && <span className={`rounded-full px-1.5 text-[10px] font-bold uppercase ${o.name === outletName ? 'bg-white/20' : 'bg-ink/8 text-ink/50'}`}>Closed</span>}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <input aria-label="Search menu" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items…" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm" />
              <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {lowPortion.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                {lowPortion.map(product => (
                  <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900">
                    <span><strong>{product.name}</strong>: {availableServings(product)} left · {availability(product).limitingIngredient ?? 'limit unknown'}</span>
                    <button onClick={() => requestRestock(product)} className="rounded-md border border-amber-900/20 bg-white px-2 py-1 text-xs font-semibold">Request restock</button>
                  </div>
                ))}
              </div>
            )}

            {combos.length > 0 && !search && (category === 'All items') && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {combos.map(c => (
                  <button key={c.id} onClick={() => addCombo(c.id)} className="flex items-start gap-3 rounded-xl border border-brand/25 bg-white p-3 text-left transition hover:border-brand/50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xl">{c.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold">{c.name}</span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-ink/55">
                        <span>Combo · {c.items.reduce((n, i) => n + i.qty, 0)} items</span>
                        <span className="whitespace-nowrap text-sm font-bold text-brand">{cash(c.price)}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(product => {
                const portions = availableServings(product)
                const hasRecipe = (recipes[product.id]?.length ?? 0) > 0
                const hasMods = (pos.data?.modifierGroups ?? []).some(g => g.productIds.includes(product.id))
                return (
                  <button key={product.id} disabled={product.trackStock !== false && portions <= 0} onClick={() => add(product)} className="group rounded-xl border border-black/5 bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-2xl">{product.emoji}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${!hasRecipe && product.trackStock !== false ? 'bg-amber-50 text-amber-800' : product.trackStock !== false && portions <= 5 ? 'bg-amber-50 text-amber-800' : 'bg-canvas text-ink/60'}`}>
                        {product.trackStock === false ? 'Not tracked' : !hasRecipe ? 'Recipe needed' : portions <= 0 ? 'Sold out (86)' : `${portions} left`}
                      </span>
                    </div>
                    <p className="mt-4 font-semibold">{product.name}</p>
                    <p className="mt-1 text-xs text-ink/50">{product.category} · per {product.unit}{hasMods ? ' · options' : ''}</p>
                    {product.trackStock !== false && portions <= 0 && availability(product).limitingIngredient && <p className="mt-1 text-xs text-red-700">Limiting ingredient: {availability(product).limitingIngredient}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-bold text-brand">{cash(product.price)}</span>
                      <span className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white">+ Add</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {!shown.length && <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-ink/60">No menu items match your search.</div>}

            <HeldOrdersCard orders={heldOrders} courseControl={features.kdsCourses} canApprove={pos.isManager} onResume={resumeHeldOrder} onCancel={held => setHeldOrders(old => old.filter(x => x.id !== held.id))} onFire={fireCourse} onApprove={approveDiscount} />
          </section>

          <aside className="overflow-hidden rounded-xl border border-black/5 bg-white xl:sticky xl:top-4">
            <button type="button" aria-expanded={currentOrderOpen} onClick={() => setCurrentOrderOpen(open => !open)} className="flex w-full items-center justify-between gap-2 border-b border-black/5 p-4 text-left">
              <div className="min-w-0">
                <h2 className="font-bold">Current order{activeOrderId ? ` · ${activeOrderId}` : ''}</h2>
                <p className="mt-1 truncate text-sm text-ink/60">
                  {outletName} · {orderType}
                  {orderType === 'Dine-in' && table ? ` · Table ${table}` : ''}
                  {orderType === 'Delivery' && deliveryAddress ? ' · Delivery' : ''}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{count} · {cash(total)}</span>
                <span aria-hidden="true" className="text-lg">{currentOrderOpen ? '▾' : '▸'}</span>
              </span>
            </button>

            {currentOrderOpen && (
              <>
                {!lines.length ? (
                  <div className="px-4 py-10 text-center">
                    <p className="font-semibold">Your order is empty</p>
                    <p className="mt-1 text-sm text-ink/60">Select a menu item to get started.</p>
                  </div>
                ) : (
                  <div className="max-h-96 space-y-4 overflow-y-auto p-4">
                    {lines.map(line => {
                      const lineId = line.lineId ?? line.productId
                      const gross = lineGross(line, line.product)
                      const off = lineDiscountOf(line, line.product)
                      return (
                        <div key={lineId} className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{line.product.name}</p>
                            {line.comboName && <p className="text-xs font-semibold text-brand">{line.comboName}</p>}
                            {line.modifiers?.length ? <p className="text-xs text-ink/60">{line.modifiers.map(m => m.price ? `${m.name} +${cash(m.price)}` : m.name).join(' · ')}</p> : null}
                            <p className="mt-0.5 text-xs text-ink/50">{cash(gross / Math.max(1, line.qty))} each{line.status && line.status !== 'New' ? ` · ${line.status}` : ''}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button onClick={() => qty(lineId, -1)} aria-label="Decrease quantity" className="h-7 w-7 rounded-md border border-black/10">−</button>
                              <span className="w-5 text-center text-sm font-semibold">{line.qty}</span>
                              <button onClick={() => qty(lineId, 1)} disabled={Boolean(line.comboRef)} aria-label="Increase quantity" className="h-7 w-7 rounded-md border border-black/10 disabled:opacity-30">+</button>
                              <button onClick={() => setDiscountFor(lineId)} className={`ml-auto rounded-md px-2 py-1 text-xs font-semibold ${off ? 'bg-warn/10 text-warn' : 'border border-black/10 text-ink/60'}`}>{off ? `−${line.discountPercent}%` : '% off'}</button>
                            </div>
                            <div className={`mt-2 grid gap-2 ${features.posSplitBills && orderType === 'Dine-in' ? 'grid-cols-[1fr_1fr_64px]' : 'grid-cols-2'}`}>
                              <select aria-label={`${line.product.name} course`} value={line.course ?? 'Main'} onChange={event => updateCartLine(lineId, { course: event.target.value })} className="min-w-0 rounded-md border border-black/10 px-2 py-1 text-xs">{COURSES.map(c => <option key={c}>{c}</option>)}</select>
                              <input aria-label={`${line.product.name} preparation note`} value={line.note ?? ''} onChange={event => updateCartLine(lineId, { note: event.target.value })} placeholder="Item note" className="min-w-0 rounded-md border border-black/10 px-2 py-1 text-xs" />
                              {features.posSplitBills && orderType === 'Dine-in' && (
                                <select aria-label={`${line.product.name} seat`} value={line.seat ?? 1} onChange={event => updateCartLine(lineId, { seat: Number(event.target.value) })} className="min-w-0 rounded-md border border-black/10 px-1 py-1 text-xs">
                                  {Array.from({ length: Math.max(8, Number(covers) || 0) }, (_, i) => <option key={i + 1} value={i + 1}>Seat {i + 1}</option>)}
                                </select>
                              )}
                            </div>
                          </div>
                          <span className="whitespace-nowrap text-sm font-semibold">{cash(gross - off)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="space-y-3 border-t border-black/5 p-4">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold">
                      Order type
                      <select
                        value={orderType}
                        onChange={e => {
                          const nextOrderType = e.target.value as OrderType
                          setOrderType(nextOrderType)
                          if (nextOrderType !== 'Dine-in') setTable('')
                          if (nextOrderType !== 'Delivery') setDeliveryAddress('')
                          setNotice('')
                        }}
                        className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal"
                      >
                        {(['Dine-in', 'Takeaway', 'Delivery', ...(currentOutlet?.type === 'roomService' || currentOutlet?.type === 'minibar' || orderType === 'Room service' ? ['Room service'] : [])] as OrderType[]).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>

                    {orderType === 'Dine-in' && tableNames.length > 0 && (
                      <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
                        <label className="block text-sm font-semibold">
                          Table
                          <select value={table} onChange={e => setTable(e.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal">
                            <option value="">Select a table</option>
                            {availableTables.map(tableId => <option key={tableId} value={tableId}>{tableId}</option>)}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold">
                          Covers
                          <input type="number" min={1} value={covers} onChange={e => setCovers(e.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" />
                        </label>
                        {!availableTables.length && <span className="col-span-2 block text-xs font-normal text-amber-700">All tables are occupied.</span>}
                      </div>
                    )}

                    {orderType === 'Delivery' && (
                      <label className="block text-sm font-semibold">
                        Delivery address
                        <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery address / location" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" />
                      </label>
                    )}

                    <label className="block text-sm font-semibold">
                      Guest profile (optional)
                      <select value={guestId} onChange={event => {
                        const id = event.target.value
                        const guest = hotel.guests.find(item => item.id === id)
                        setGuestId(id)
                        if (guest) {
                          setCustomer(guest.name)
                          const alertText = [guest.preferences?.diet, ...(guest.notes ?? []).map(note => note.text)].filter(Boolean).join(' · ')
                          if (alertText) setOrderNotes(previous => previous ? `${previous} · ${alertText}` : alertText)
                        }
                      }} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal">
                        <option value="">Walk-in / unlinked guest</option>
                        {hotel.guests.map(guest => <option key={guest.id} value={guest.id}>{guest.name}{guest.vip ? ' · VIP' : ''}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      Customer / guest name
                      <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Walk-in customer" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" />
                    </label>
                    {orderType === 'Room service' && <div className="grid grid-cols-2 gap-3">
                      <label className="block text-sm font-semibold">Room number<input value={room} onChange={event => setRoom(event.target.value)} placeholder="204" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
                      <label className="block text-sm font-semibold">Floor<input value={roomFloor} onChange={event => setRoomFloor(event.target.value)} placeholder="2" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
                      <label className="col-span-2 block text-sm font-semibold">Delivery setup<select value={deliverySetup} onChange={event => setDeliverySetup(event.target.value as 'Tray' | 'Rolling table' | 'Silver service')} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal"><option>Tray</option><option>Rolling table</option><option>Silver service</option></select></label>
                    </div>}

                    <label className="block text-sm font-semibold">
                      Order notes
                      <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} placeholder="Allergies, delivery instructions…" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" />
                    </label>
                  </div>

                  <div className="space-y-1 text-sm text-ink/60">
                    <div className="flex justify-between"><span>Subtotal</span><span>{cash(subtotal)}</span></div>
                    {totals.lineDiscounts > 0 && <div className="flex justify-between"><span>Item discounts</span><span>−{cash(totals.lineDiscounts)}</span></div>}
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setDiscountFor('order')} disabled={!cart.length} className="font-semibold text-brand hover:underline disabled:opacity-40">
                        {Number(discountPercent) > 0 ? `Discount ${discountPercent}% · ${orderDiscountReason || 'no reason'}` : 'Add order discount'}
                      </button>
                      {totals.orderDiscount > 0 && <span>−{cash(totals.orderDiscount)}</span>}
                    </div>
                    {needsApproval && <div><Badge tone={approver ? 'good' : 'warn'} dot>{approver ? `Approved by ${approver}` : `Above ${discountLimit}%: needs a manager`}</Badge></div>}
                    {serviceChargePercent > 0 && <div className="flex justify-between"><span>Service charge ({serviceChargePercent}%)</span><span>{cash(totals.serviceCharge)}</span></div>}
                    {totals.tip > 0 && <div className="flex justify-between"><span>Tip</span><span>{cash(totals.tip)}</span></div>}
                  </div>
                  <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{cash(total)}</span></div>

                  {!paying ? (
                    <div className="grid grid-cols-2 gap-2">
                      {features.kdsCourses && cart.length > 0 && (
                        <label className="col-span-2 flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={holdLater} onChange={e => setHoldLater(e.target.checked)} />
                          Hold mains and desserts until fired
                        </label>
                      )}
                      <button onClick={resetCurrentOrder} disabled={!cart.length} className="rounded-lg border border-black/10 px-3 py-2.5 text-sm font-semibold disabled:opacity-40">Clear order</button>
                      <button onClick={saveHeldOrder} disabled={!cart.length} className="rounded-lg border border-brand px-3 py-2.5 text-sm font-semibold text-brand disabled:opacity-40">Send to kitchen / bar</button>
                      <button onClick={() => { setPaying(true); setNotice('') }} disabled={!cart.length} className="col-span-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Checkout</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold">
                        Payment method
                        <select value={payment} onChange={e => setPayment(e.target.value as Payment)} className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 font-normal">
                          {(['Cash', 'Mobile money', 'Card', 'Room charge'] as Payment[]).map(method => <option key={method}>{method}</option>)}
                        </select>
                      </label>

                      {currentOutlet?.tipsEnabled !== false && (
                        <label className="block text-sm font-semibold">
                          Tip (UGX)
                          <input type="number" min={0} value={tip} onChange={e => setTip(e.target.value)} placeholder="0" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 font-normal" />
                        </label>
                      )}

                      {payment === 'Room charge' && (
                        <RoomChargePicker reservationId={chargeReservation} onChange={setChargeReservation} amount={total} category={folioCategory} controls={controls} />
                      )}

                      {payment === 'Cash' && (
                        <>
                          <label className="block text-sm font-semibold">
                            Cash received (UGX)
                            <input type="number" min={total} value={cashTendered} onChange={e => setCashTendered(e.target.value)} placeholder={String(total)} className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 font-normal" />
                          </label>
                          <div className="flex justify-between rounded-lg bg-canvas p-3 text-sm"><span>Change due</span><strong>{cash(changeDue)}</strong></div>
                        </>
                      )}

                      {(payment === 'Mobile money' || payment === 'Card') && (
                        <label className="block text-sm font-semibold">
                          Transaction reference
                          <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Enter provider reference" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 font-normal" />
                        </label>
                      )}

                      <button onClick={checkout} disabled={busy || (payment === 'Room charge' && !roomCheck?.ok)} className="w-full rounded-lg bg-brand px-3 py-3 text-sm font-bold text-white disabled:opacity-50">
                        {payment === 'Room charge' ? 'Charge to room' : 'Record payment'} · {cash(total)}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        {features.posSplitBills ? (
                          <button onClick={openSplit} className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand">Split bill</button>
                        ) : <span />}
                        <button onClick={() => setPaying(false)} className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold">Back to order</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {modifierFor && (
        <ModifierDialog
          product={modifierFor}
          groups={(pos.data?.modifierGroups ?? []).filter(g => g.productIds.includes(modifierFor.id))}
          onClose={() => setModifierFor(null)}
          onConfirm={mods => { addLine(modifierFor, mods); setModifierFor(null) }}
        />
      )}

      {discountFor && (discountFor === 'order' || discountLine) && (
        <DiscountDialog
          target={discountFor === 'order' ? 'whole order' : discountLine?.product.name ?? 'item'}
          percent={discountFor === 'order' ? Number(discountPercent) || 0 : discountLine?.discountPercent ?? 0}
          reason={discountFor === 'order' ? orderDiscountReason : discountLine?.discountReason ?? ''}
          limit={discountLimit}
          isManager={pos.isManager}
          onClose={() => setDiscountFor(null)}
          onSave={(percent, reason) => {
            const approved = percent > discountLimit && pos.isManager ? user?.name ?? '' : ''
            if (discountFor === 'order') {
              setDiscountPercent(String(percent))
              setOrderDiscountReason(reason)
            } else {
              updateCartLine(discountFor, { discountPercent: percent || undefined, discountReason: reason || undefined, discountApprovedBy: approved || undefined })
            }
            if (approved) setDiscountApprovedBy(approved)
            setDiscountFor(null)
          }}
        />
      )}

      {splitOpen && (
        <SplitBillDialog
          lines={lines}
          totals={totals}
          checks={orderChecks}
          controls={controls}
          category={folioCategory}
          onCreate={createChecks}
          onPay={payCheck}
          onClose={() => setSplitOpen(false)}
        />
      )}

      {confirmRoom && roomCheck?.ok && (
        <ConfirmDialog
          title="Charge to room?"
          message={<>Post {cash(total)} to room {roomCheck.postTo.room} · {roomCheck.postTo.guest}{roomCheck.routedTo ? ` (routed from ${roomCheck.reservation.guest})` : ''}. It is recorded as posted by {user?.name ?? 'you'}.</>}
          confirmLabel="Charge to room"
          onConfirm={() => void completePayment()}
          onCancel={() => setConfirmRoom(false)}
        />
      )}

      {selectedReceipt && <ReceiptDialog sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}

      {isPayments && (
        <div className="flex justify-end">
          <Button onClick={() => navigate('/pos')}>Create order / take payment</Button>
        </div>
      )}
    </div>
  )
}
