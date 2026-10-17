
import { useMemo, useState } from 'react'
import { readBrowserValue, useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { useHotel } from '../../lib/hotelContext'
import { useRequests } from '../procurement/requestsContext'
import { claimLineDeduction, finishLineDeduction, isLineDeducted, migratePosStorage } from './posStore'
import { POS_STORAGE_KEYS } from './posTypes'
import { calculateAvailability, calculateRecipeCost, convertQuantity, getRecipeMappingIssues, validateRecipe } from './recipeEngine'
import type { HeldOrder, Line, OrderType, Outlet, Payment, Product, RecipeIngredient, Recipes, Sale } from './posTypes'

// POS and KDS share these contracts; legacy storage shapes remain compatible.

migratePosStorage()

const seed: Product[] = [
  { id: 'm1', name: 'Chicken & chips', category: 'Main dishes', outlet: 'Restaurant', price: 22000, unit: 'plate', emoji: '🍗' },
  { id: 'm2', name: 'Beef burger', category: 'Main dishes', outlet: 'Restaurant', price: 18000, unit: 'plate', emoji: '🍔' },
  { id: 'm3', name: 'Fish fillet', category: 'Main dishes', outlet: 'Restaurant', price: 28000, unit: 'plate', emoji: '🐟' },
  { id: 'm4', name: 'Vegetable rice', category: 'Main dishes', outlet: 'Restaurant', price: 14000, unit: 'plate', emoji: '🍚' },
  { id: 'm5', name: 'Garden salad', category: 'Starters', outlet: 'Restaurant', price: 10000, unit: 'bowl', emoji: '🥗' },
  { id: 'd1', name: 'Fresh juice', category: 'Soft drinks', outlet: 'Restaurant', price: 7000, unit: 'glass', emoji: '🧃' },
  { id: 'd2', name: 'Soda', category: 'Soft drinks', outlet: 'Bar', price: 4000, unit: 'bottle', emoji: '🥤' },
  { id: 'd3', name: 'Mineral water', category: 'Soft drinks', outlet: 'Bar', price: 3000, unit: 'bottle', emoji: '💧' },
  { id: 'd4', name: 'House mocktail', category: 'Mocktails', outlet: 'Bar', price: 12000, unit: 'glass', emoji: '🍹' },
  { id: 'd5', name: 'Espresso', category: 'Hot drinks', outlet: 'Restaurant', price: 8000, unit: 'cup', emoji: '☕' },
  { id: 'd6', name: 'House beer', category: 'Beer', outlet: 'Bar', price: 9000, unit: 'bottle', emoji: '🍺' },
  { id: 'd7', name: 'House wine (glass)', category: 'Wine', outlet: 'Bar', price: 15000, unit: 'glass', emoji: '🍷' },
]

function selectedGuestAlert(guestId: string, guests: ReturnType<typeof useHotel>['guests']): string {
  const guest = guests.find(item => item.id === guestId)
  if (!guest) return ''
  return [guest.preferences?.diet, ...(guest.notes ?? []).map(note => note.text)].filter(Boolean).join(' · ')
}

const cash = (n: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(n)

export default function PosPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isOrders = location.pathname.endsWith('/orders')
  const isTables = location.pathname.endsWith('/tables')
  const isMenu = location.pathname.endsWith('/menu')
  const isPayments = location.pathname.endsWith('/payments')
  const isRecipes = location.pathname.endsWith('/recipes')
  const isSale = !isOrders && !isTables && !isMenu && !isPayments && !isRecipes

  const inventory = useRequests()
  const hotel = useHotel()

  const [outlet, setOutlet] = useState<Outlet>('Restaurant')
  const [category, setCategory] = useState('All items')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Line[]>([])
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment>('Cash')
  const [room, setRoom] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('Dine-in')
  const [table, setTable] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [customer, setCustomer] = useState('')
  const [guestId, setGuestId] = useState('')
  const [roomFloor, setRoomFloor] = useState('')
  const [deliverySetup, setDeliverySetup] = useState<'Tray' | 'Rolling table' | 'Silver service'>('Tray')
  const [orderNotes, setOrderNotes] = useState('')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [cashTendered, setCashTendered] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [notice, setNotice] = useState('')
  const [salesSearch, setSalesSearch] = useState('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState('All payments')

  const [products, setProducts] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const [heldOrders, setHeldOrders] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const [tables, setTables] = useBrowserSyncedState<string[]>(
    POS_STORAGE_KEYS.tables,
    Array.from({ length: 12 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`),
  )

  const [newTableName, setNewTableName] = useState('')
  const [editingTable, setEditingTable] = useState<string | null>(null)
  const [editedTableName, setEditedTableName] = useState('')
  const [newMenuOutlet, setNewMenuOutlet] = useState<Outlet>('Restaurant')
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuCategory, setNewMenuCategory] = useState('Main dishes')
  const [newMenuPrice, setNewMenuPrice] = useState('')
  const [newMenuUnit, setNewMenuUnit] = useState('portion')
  const [newMenuEmoji, setNewMenuEmoji] = useState('🍽️')
  const [sales, setSales] = useBrowserSyncedState<Sale[]>(POS_STORAGE_KEYS.sales, [])
  const [paying, setPaying] = useState(false)
  const [currentOrderOpen, setCurrentOrderOpen] = useState(true)
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null)
  const [recipes, setRecipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const [foodCostThreshold, setFoodCostThreshold] = useBrowserSyncedState<number>('gastora.pos.foodCostThreshold.v1', 35)
  const [lowPortionThreshold, setLowPortionThreshold] = useBrowserSyncedState<number>('gastora.pos.lowPortionThreshold.v1', 5)
  const [recipeProduct, setRecipeProduct] = useState(seed[0].id)

  const categories = useMemo(
    () => ['All items', ...new Set(products.filter(p => p.outlet === outlet).map(p => p.category))],
    [products, outlet],
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
    p =>
      p.available !== false &&
      p.outlet === outlet &&
      (category === 'All items' || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase().trim()),
  )

  const lines = cart
    .map(l => ({ ...l, product: products.find(p => p.id === l.productId)! }))
    .filter(l => l.product)

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0)
  const discount = Math.min(
    subtotal,
    Math.max(0, Math.round(subtotal * (Math.min(100, Math.max(0, Number(discountPercent) || 0)) / 100))),
  )
  const total = Math.max(0, subtotal - discount)
  const changeDue = Math.max(0, (Number(cashTendered) || 0) - total)
  const count = cart.reduce((sum, l) => sum + l.qty, 0)

  const todaySales = sales.filter(
    s => new Date(s.createdAt).toDateString() === new Date().toDateString(),
  )
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0)

  const occupiedTables = new Set(
    heldOrders
      .filter(order => order.orderType === 'Dine-in' && order.table)
      .map(order => order.table),
  )

  const availableTables = tables.filter(
    tableId => !occupiedTables.has(tableId) || tableId === table,
  )

  const visibleSales = sales.filter(
    s =>
      (salesPaymentFilter === 'All payments' || s.payment === salesPaymentFilter) &&
      `${s.id} ${s.customer ?? ''} ${s.room ?? ''} ${s.items.map(i => i.name).join(' ')}`
        .toLowerCase()
        .includes(salesSearch.toLowerCase().trim()),
  )

  function add(product: Product) {
    setNotice('')
    if (product.available === false) return setNotice(`${product.name} is manually marked unavailable (86).`)
    const currentQty = cart.find((line) => line.productId === product.id)?.qty ?? 0
    if (product.trackStock !== false) {
      const available = availableServings(product)
      if (available <= currentQty) return setNotice(available === 0 ? `${product.name} is sold out (86).${availability(product).limitingIngredient ? ` Limiting ingredient: ${availability(product).limitingIngredient}.` : ''}` : `Only ${available} portion(s) of ${product.name} are available.`)
    }
    setCart(old =>
      old.some(line => line.productId === product.id)
        ? old.map(line => line.productId === product.id ? { ...line, qty: line.qty + 1 } : line)
        : [...old, { productId: product.id, lineId: `LINE-${Date.now()}-${product.id}`, qty: 1 }],
    )
  }

  function qty(id: string, delta: number) {
    const product = products.find((entry) => entry.id === id)
    const currentQty = cart.find((line) => line.productId === id)?.qty ?? 0
    if (delta > 0 && product && product.trackStock !== false && currentQty >= availableServings(product)) {
      setNotice(`Cannot add more ${product.name}; only ${availableServings(product)} portion(s) are available.`)
      return
    }
    setCart(old => old.map(line => line.productId === id ? { ...line, qty: Math.max(0, line.qty + delta) } : line).filter(line => line.qty > 0))
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
    setCashTendered('')
    setPaymentReference('')
    setPaying(false)
  }

  function saveHeldOrder() {
    if (!lines.length) {
      setNotice('Add at least one item before saving an order.')
      return
    }

    // Preserve the existing HeldOrder data shape:
    // table stores the table ID for Dine-in or the delivery address for Delivery.
    const held: HeldOrder = {
      id: `ORD-${Date.now().toString().slice(-7)}`,
      createdAt: new Date().toISOString(),
      outlet,
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
      items: cart.map((line, index) => ({ ...line, lineId: line.lineId ?? `ORD-${Date.now()}-line-${index + 1}`, status: line.status ?? 'New' })),
      kitchenStatus: 'New',
    }

    const latest = readBrowserValue<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, heldOrders)
    setHeldOrders([held, ...latest.filter(order => order.id !== held.id)])
    resetCurrentOrder()
    setNotice(`Order ${held.id} sent to the kitchen/bar queue. No payment recorded and no inventory deducted.`)
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
    setHeldOrders(old => old.filter(order => order.id !== held.id))
    setPaying(false)
    setCurrentOrderOpen(true)
    navigate('/pos')
    setNotice(`Order ${held.id} restored. Inventory has not been changed.`)
  }

  function updateCartLine(productId: string, patch: Partial<Line>) {
    setCart(old => old.map(line => line.productId === productId ? { ...line, ...patch } : line))
  }

  function addMenuItem() {
    const price = Number(newMenuPrice)

    if (!newMenuName.trim() || !newMenuCategory.trim() || !Number.isFinite(price) || price <= 0) {
      setNotice('Enter a menu item name, category, and price greater than zero.')
      return
    }

    const item: Product = {
      id: `menu-${Date.now()}`,
      name: newMenuName.trim(),
      category: newMenuCategory.trim(),
      outlet: newMenuOutlet,
      price,
      trackStock: true,
      unit: newMenuUnit.trim() || 'portion',
      emoji: newMenuEmoji.trim() || '🍽️',
      available: true,
    }

    setProducts(old => [...old, item])
    setNewMenuName('')
    setNewMenuPrice('')
    setNotice(`${item.name} added to the ${newMenuOutlet} menu. Configure its recipe before sale.`)
  }

  function updateMenuPrice(id: string, value: string) {
    const price = Number(value)
    if (Number.isFinite(price) && price > 0) {
      setProducts(old => old.map(item => item.id === id ? { ...item, price } : item))
    }
  }

  function saveRecipe(productId: string, ingredients: RecipeIngredient[]) {
    setRecipes({ ...recipes, [productId]: ingredients })
  }

  function exportSalesCsv() {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Order ID', 'Date', 'Outlet', 'Order type', 'Table / delivery', 'Customer', 'Payment', 'Payment reference', 'Items', 'Subtotal UGX', 'Discount UGX', 'Total UGX', 'Room', 'Notes'],
      ...visibleSales.map(s => [
        s.id,
        new Date(s.createdAt).toLocaleString(),
        s.outlet,
        s.orderType ?? '',
        s.table ?? '',
        s.customer ?? '',
        s.payment,
        s.paymentReference ?? '',
        s.items.map(i => `${i.qty} x ${i.name}`).join('; '),
        s.subtotal ?? s.total,
        s.discount ?? 0,
        s.total,
        s.room ?? '',
        s.notes ?? '',
      ]),
    ]

    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `gastora-pos-sales-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function checkout() {
    if (!lines.length) return setNotice('Add an item before checkout.')
    if (lines.some(line => line.product.available === false)) {
      return setNotice('One or more items in the current order are unavailable. Remove them before checkout.')
    }
    if ((payment === 'Room charge' || orderType === 'Room service') && !room.trim()) {
      return setNotice('Enter the guest room number for a room charge or room-service order.')
    }
    if (orderType === 'Dine-in' && outlet === 'Restaurant' && !table.trim()) {
      return setNotice('Select a table for dine-in orders.')
    }
    if (orderType === 'Delivery' && !deliveryAddress.trim()) {
      return setNotice('Enter a delivery address.')
    }
    if (payment === 'Cash' && (Number(cashTendered) || 0) < total) {
      return setNotice(`Amount tendered must be at least ${cash(total)}.`)
    }
    if ((payment === 'Mobile money' || payment === 'Card') && !paymentReference.trim()) {
      return setNotice(`Enter the ${payment === 'Card' ? 'card transaction' : 'mobile money transaction'} reference.`)
    }

    const saleId = `POS-${Date.now().toString().slice(-7)}`
    const deductionOrderRef = activeOrderId ?? `CART-${cart.map(line => line.lineId ?? line.productId).join('-')}`
    const deductionRefs: string[] = []
    let deductedIngredientCount = 0

    // Validate all recipes before any stock changes. The actual issue is then idempotent per order line.
    for (const line of lines) {
      if (line.product.trackStock === false || line.stockDeducted || isLineDeducted(`${deductionOrderRef}:${line.lineId ?? line.productId}`)) continue
      const recipe = recipes[line.product.id] ?? []
      if (!recipe.length) return setNotice(`Configure an inventory recipe for ${line.product.name} before completing this sale.`)
      const recipeIssues = validateRecipe(recipe, inventory.stock)
      if (recipeIssues.length) return setNotice(`${line.product.name}: ${recipeIssues[0]}`)
      for (const ingredient of recipe) {
        const stockItem = inventory.stock.find(item => item.id === ingredient.stockId)
        if (!stockItem) return setNotice(`A recipe ingredient for ${line.product.name} is no longer in inventory. Please update the recipe.`)
        const converted = convertQuantity(ingredient.qty, ingredient.unit || stockItem.unit, stockItem.unit)
        if (converted === null || converted <= 0) return setNotice(`Invalid or incompatible recipe unit for ${stockItem.name}.`)
        if ((ingredient.wastePercent ?? 0) >= 100) return setNotice(`Waste percentage for ${stockItem.name} must be less than 100%.`)
      }
    }

    for (const line of lines) {
      if (line.product.trackStock === false) continue
      const ref = `${deductionOrderRef}:${line.lineId ?? line.productId}`
      if (line.stockDeducted || isLineDeducted(ref)) continue
      const recipe = recipes[line.product.id] ?? []
      const deductions: { name: string; qty: number }[] = []
      for (const ingredient of recipe) {
        const stockItem = inventory.stock.find(item => item.id === ingredient.stockId)
        if (!stockItem) return setNotice(`A recipe ingredient for ${line.product.name} is no longer in inventory. Please update the recipe.`)
        const converted = convertQuantity(ingredient.qty, ingredient.unit || stockItem.unit, stockItem.unit)
        if (converted === null || converted <= 0) return setNotice(`Invalid or incompatible recipe unit for ${stockItem.name}.`)
        const wastePercent = ingredient.wastePercent ?? 0
        deductions.push({ name: stockItem.name, qty: (converted / (1 - wastePercent / 100)) * line.qty })
      }
      if (!deductions.length) continue
      if (!claimLineDeduction(ref)) {
        if (isLineDeducted(ref)) continue
        return setNotice(`Stock deduction for ${line.product.name} is already in progress. Refresh and verify inventory before retrying.`)
      }
      const stockResult = inventory.consumeStockForSale(deductions, saleId, outlet, ref)
      if (stockResult.ok === false) {
        finishLineDeduction(ref, stockResult.error)
        return setNotice(stockResult.error)
      }
      finishLineDeduction(ref)
      deductionRefs.push(ref)
      deductedIngredientCount += stockResult.value.length
    }

    const sale: Sale = {
      id: saleId,
      createdAt: new Date().toISOString(),
      outlet,
      payment,
      total,
      subtotal,
      discount,
      orderType,
      ...(orderType === 'Dine-in' && table.trim() ? { table: table.trim() } : {}),
      ...(orderType === 'Delivery' && deliveryAddress.trim()
        ? { table: deliveryAddress.trim() }
        : {}),
      ...(customer.trim() ? { customer: customer.trim() } : {}),
      ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
      ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
      ...(payment === 'Cash' ? { amountTendered: Number(cashTendered) || total, changeDue } : {}),
      items: lines.map(line => ({
        name: line.product.name,
        qty: line.qty,
        price: line.product.price,
      })),
      ...(payment === 'Room charge' || orderType === 'Room service' ? { room: room.trim() } : {}),
      ...(guestId ? { guestId } : {}),
    }

    const latestSales = readBrowserValue<Sale[]>('gastora.pos.sales.v1', sales)
    const nextSales = [sale, ...latestSales.filter(existing => existing.id !== sale.id)]

    setSales(nextSales)
    if (activeOrderId) {
      const active = heldOrders.find(order => order.id === activeOrderId)
      if (active) {
        const paidAt = new Date().toISOString()
        const paidOrder = { ...active, paidAt, updatedAt: paidAt, items: active.items.map(line => ({ ...line, stockDeducted: line.stockDeducted || isLineDeducted(`${deductionOrderRef}:${line.lineId ?? line.productId}`) })) }
        window.localStorage.setItem(POS_STORAGE_KEYS.orderHistory, JSON.stringify([paidOrder, ...readBrowserValue<HeldOrder[]>(POS_STORAGE_KEYS.orderHistory, []).filter(order => order.id !== paidOrder.id)]))
      }
    }
    resetCurrentOrder()
    setNotice(`Sale ${sale.id} recorded: ${cash(sale.total)} via ${sale.payment}. Inventory deduction ledger recorded ${deductionRefs.length} line(s) and ${deductedIngredientCount} ingredient movement(s); lines already deducted by Kitchen were skipped.`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Restaurant & bar POS"
        title={
          isOrders
            ? 'Order Management'
            : isTables
              ? 'Table Management'
              : isMenu
                ? 'Menu Management'
                : isPayments
                  ? 'Payment Processing'
                  : isRecipes
                    ? 'Recipe & Inventory Mapping'
                    : 'Menus & new order'
        }
        description={
          isOrders
            ? 'Create, resume, track, and review customer orders.'
            : isTables
              ? 'Assign tables, view occupancy, and start table orders.'
              : isMenu
                ? 'Manage food and beverage items, categories, prices, and availability.'
                : isPayments
                  ? 'Review completed payments, payment methods, totals, and receipts.'
                  : isRecipes
                    ? 'Map menu items to inventory ingredients used at completed checkout.'
                    : 'Create and update orders, then send them to the kitchen or bar by saving or holding them.'
        }
        actions={
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-ink/60">
              POS section
              <select
                aria-label="POS section"
                value={
                  isOrders ? '/pos/orders'
                    : isTables ? '/pos/tables'
                      : isMenu ? '/pos/menu'
                        : isPayments ? '/pos/payments'
                          : isRecipes ? '/pos/recipes'
                            : '/pos'
                }
                onChange={e => navigate(e.target.value)}
                className="ml-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink"
              >
                <option value="/pos">Menus · New order</option>
                <option value="/pos/orders">Order Management · Orders</option>
                <option value="/pos/tables">Table Management</option>
                <option value="/pos/menu">Menu Management</option>
                <option value="/pos/payments">Payment Processing</option>
                <option value="/pos/recipes">Recipe & Inventory Mapping</option>
                <option value="/kitchen">Kitchen Display System</option>
              </select>
            </label>
          </div>
        }
      />

      {!isTables && !isMenu && !isRecipes && !isPayments && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <p className="text-sm text-ink/60">Today's sales</p>
            <p className="mt-1 text-2xl font-bold">{cash(todayTotal)}</p>
          </div>
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <p className="text-sm text-ink/60">Completed orders today</p>
            <p className="mt-1 text-2xl font-bold">{todaySales.length}</p>
          </div>
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <p className="text-sm text-ink/60">Items in current order</p>
            <p className="mt-1 text-2xl font-bold">{count}</p>
          </div>
        </div>
      )}

      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg border border-brand/20 bg-white px-4 py-3 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}

      {isMenu && (
        <section className="space-y-5 rounded-xl border border-black/5 bg-white p-4">
          <div>
            <h2 className="text-lg font-bold">Menu management</h2>
            <p className="mt-1 text-sm text-ink/60">Add menu items, adjust prices, and maintain separate Restaurant and Bar menus. Changes save automatically and sync between open tabs.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium">Item name<input value={newMenuName} onChange={e => setNewMenuName(e.target.value)} placeholder="e.g. Grilled tilapia" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-medium">Outlet<select value={newMenuOutlet} onChange={e => setNewMenuOutlet(e.target.value as Outlet)} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal"><option>Restaurant</option><option>Bar</option></select></label>
            <label className="text-sm font-medium">Category<input value={newMenuCategory} onChange={e => setNewMenuCategory(e.target.value)} placeholder="Main dishes" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-medium">Price (UGX)<input type="number" min="1" value={newMenuPrice} onChange={e => setNewMenuPrice(e.target.value)} placeholder="25000" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-medium">Unit<input value={newMenuUnit} onChange={e => setNewMenuUnit(e.target.value)} placeholder="plate, glass, bottle…" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
            <label className="text-sm font-medium">Emoji / icon<input value={newMenuEmoji} onChange={e => setNewMenuEmoji(e.target.value)} maxLength={8} className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" /></label>
            <div className="flex items-end"><button onClick={addMenuItem} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Add menu item</button></div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-black/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas/70"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Outlet</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Price (UGX)</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Live portions</th><th className="px-3 py-2">Availability</th><th className="px-3 py-2">Stock tracking</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>
                {products.map(item => (
                  <tr key={`${item.id}-${item.price}`} className="border-t border-black/5">
                    <td className="px-3 py-2">{item.emoji} {item.name}</td>
                    <td className="px-3 py-2">{item.outlet}</td>
                    <td className="px-3 py-2">{item.category}</td>
                    <td className="px-3 py-2"><input type="number" min="1" defaultValue={item.price} onBlur={e => updateMenuPrice(item.id, e.target.value)} aria-label={`Price for ${item.name}`} className="w-28 rounded-md border border-black/10 px-2 py-1" /></td>
                    <td className="px-3 py-2">{item.unit}</td>
                    <td className="px-3 py-2">
                      {item.trackStock === false ? 'Untracked' : (recipes[item.id]?.length ?? 0) === 0 ? 'Recipe needed' : availableServings(item) <= 0 ? <span className="font-semibold text-red-700">Sold out (86)</span> : <span>{availableServings(item)} available{availability(item).limitingIngredient ? ` · ${availability(item).limitingIngredient}` : ''}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => { setProducts(old => old.map(product => product.id === item.id ? { ...product, available: product.available === false } : product)); setNotice(`${item.name} marked ${item.available === false ? 'available' : 'unavailable'}.`) }} className={`rounded-md px-2 py-1 text-xs font-semibold ${item.available === false ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                        {item.available === false ? 'Unavailable · Enable' : 'Available · Disable'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => {
                        setProducts(old => old.map(product => product.id === item.id ? { ...product, trackStock: product.trackStock === false } : product))
                        setNotice(`${item.name}: inventory tracking ${item.trackStock === false ? 'enabled' : 'disabled'}. ${item.trackStock === false ? 'Configure a valid recipe before selling.' : 'This item will not deduct inventory.'}`)
                      }} className="rounded-md border border-black/10 px-2 py-1 text-xs">{item.trackStock === false ? 'Untracked · Enable' : 'Tracked · Disable'}</button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => {
                        if (cart.some(line => line.productId === item.id)) {
                          setNotice('Remove this item from the current order before removing it from the menu.')
                          return
                        }
                        setProducts(old => old.filter(x => x.id !== item.id))
                        setRecipes(old => {
                          const next = { ...old }
                          delete next[item.id]
                          return next
                        })
                        setNotice(`${item.name} removed from the menu.`)
                      }} className="rounded-md border border-black/10 px-2 py-1 text-xs">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink/50">Removing a menu item also removes its recipe mapping. Existing completed sales remain in history. To make an item available for checkout, configure its recipe on the Recipe & inventory mapping page.</p>
        </section>
      )}

      {isRecipes && (
        <section className="space-y-5 rounded-xl border border-black/5 bg-white p-4">
          <div>
            <h2 className="text-lg font-bold">Recipe & inventory mapping</h2>
            <p className="mt-1 text-sm text-ink/60">Choose a menu item and map every ingredient to the corresponding inventory stock item. Ingredients are deducted only after a successful completed checkout.</p>
          </div>

          <label className="block text-sm font-semibold">
            Menu item
            <select value={recipeProduct} onChange={e => setRecipeProduct(e.target.value)} className="mt-1.5 w-full max-w-lg rounded-lg border border-black/10 bg-white px-3 py-2.5 font-normal">
              {products.map(p => <option key={p.id} value={p.id}>{p.outlet} · {p.name}</option>)}
            </select>
          </label>

          {!products.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Add menu items in Menu management before configuring recipes.</p>}

          <div className="space-y-3">
            {(recipes[recipeProduct] ?? []).map((ingredient, index) => (
              <div key={`${recipeProduct}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_100px_100px_auto]">
                <label className="text-xs font-semibold text-ink/60">
                  Inventory item
                  <select value={ingredient.stockId} onChange={e => { const selected = inventory.stock.find(item => item.id === e.target.value); saveRecipe(recipeProduct, (recipes[recipeProduct] ?? []).map((x, i) => i === index ? { ...x, stockId: e.target.value, unit: selected?.unit ?? x.unit } : x)) }} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-normal">
                    <option value="">Choose stock item…</option>
                    {inventory.stock.map(item => <option key={item.id} value={item.id}>{item.name} · {item.onHand} {item.unit} available</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  Qty per menu item
                  <input type="number" min="0.001" step="0.001" value={ingredient.qty} onChange={e => saveRecipe(recipeProduct, (recipes[recipeProduct] ?? []).map((x, i) => i === index ? { ...x, qty: Number(e.target.value) } : x))} className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  Unit
                  <select value={ingredient.unit || inventory.stock.find(item => item.id === ingredient.stockId)?.unit || 'piece'} onChange={e => saveRecipe(recipeProduct, (recipes[recipeProduct] ?? []).map((x, i) => i === index ? { ...x, unit: e.target.value } : x))} className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2 py-2 text-sm font-normal">
                    {['g', 'kg', 'ml', 'l', 'piece', 'bottle', 'can'].map(unit => <option key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink/60">
                  Waste %
                  <input type="number" min="0" max="99.99" step="0.1" value={ingredient.wastePercent ?? 0} onChange={e => saveRecipe(recipeProduct, (recipes[recipeProduct] ?? []).map((x, i) => i === index ? { ...x, wastePercent: Number(e.target.value) } : x))} className="mt-1 block w-full rounded-lg border border-black/10 px-2 py-2 text-sm font-normal" />
                </label>
                <button onClick={() => saveRecipe(recipeProduct, (recipes[recipeProduct] ?? []).filter((_, i) => i !== index))} className="self-end rounded-lg border border-black/10 px-3 py-2 text-sm">Remove</button>
              </div>
            ))}
          </div>

          {!inventory.stock.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">There are no inventory items yet. Add ingredients in Inventory → Stock before configuring recipes.</p>}

          <div className="flex flex-wrap gap-2">
            <button disabled={!inventory.stock.length || !products.length} onClick={() => saveRecipe(recipeProduct, [...(recipes[recipeProduct] ?? []), { stockId: inventory.stock[0].id, qty: 1, unit: inventory.stock[0].unit }])} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">+ Add ingredient</button>
            <button disabled={!products.length} onClick={() => { saveRecipe(recipeProduct, []); setNotice('Recipe cleared. Sales of this item are blocked until a new recipe is configured.') }} className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold disabled:opacity-40">Clear recipe</button>
          </div>

          <div className="rounded-lg bg-canvas p-3 text-sm">
            <p className="font-semibold">Recipe status</p>
            <p className="mt-1 text-ink/60">{(recipes[recipeProduct] ?? []).length ? `${(recipes[recipeProduct] ?? []).length} ingredient line(s) configured for ${products.find(p => p.id === recipeProduct)?.name ?? 'this item'}.` : 'No recipe configured. Checkout will be blocked for this menu item until ingredients are added.'}</p>
            {validateRecipe(recipes[recipeProduct] ?? [], inventory.stock).map((issue, index) => <p key={`${recipeProduct}-validation-${index}`} className="mt-1 text-sm text-red-700">{issue}</p>)}
            <p className="mt-2 text-xs text-ink/50">Ingredient quantities support compatible mass (kg/g), volume (l/ml), and count units. Waste % is interpreted as a share of gross input; required issue quantity is net quantity divided by (1 − waste%). Invalid or incompatible mappings block checkout.</p>
            {(() => {
              const product = products.find(p => p.id === recipeProduct)
              const cost = product ? calculateRecipeCost(product, recipes, inventory.stock) : null
              if (!product || !cost) return <p className="mt-3 text-sm text-amber-800">Recipe costing unavailable until every ingredient is mapped to a valid stock item.</p>
              return <div className="mt-3 grid gap-2 border-t border-black/5 pt-3 sm:grid-cols-2">
                <p>Cost per portion: <strong>{cash(cost.costPerPortion)}</strong></p>
                <p>Gross profit: <strong className={cost.grossProfit < 0 ? 'text-red-700' : ''}>{cash(cost.grossProfit)}</strong></p>
                <p>Margin: <strong>{cost.marginPercent.toFixed(1)}%</strong></p>
                <p>Food cost: <strong>{cost.foodCostPercent.toFixed(1)}%</strong></p>
                <label className="text-sm sm:col-span-2">Food-cost warning threshold (%)
                  <input type="number" min="1" max="100" value={foodCostThreshold} onChange={e => setFoodCostThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 35)))} className="ml-2 w-24 rounded-lg border border-black/10 px-2 py-1" />
                </label>
                <label className="text-sm sm:col-span-2">Low-portion alert threshold
                  <input type="number" min="1" max="100" value={lowPortionThreshold} onChange={e => setLowPortionThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 5)))} className="ml-2 w-24 rounded-lg border border-black/10 px-2 py-1" /> portions
                </label>
                {cost.foodCostPercent > foodCostThreshold && <p className="sm:col-span-2 rounded-lg bg-amber-50 p-2 text-amber-900">Food cost exceeds the configured {foodCostThreshold}% threshold.</p>}
              </div>
            })()}
          </div>
          <div className="rounded-xl border border-black/5 bg-white p-4">
            <h3 className="font-bold">Recipe mapping health</h3>
            <p className="mt-1 text-sm text-ink/60">Items with missing recipes, missing stock links, invalid units, or negative gross profit.</p>
            <div className="mt-3 space-y-2">
              {getRecipeMappingIssues(products, recipes, inventory.stock).length === 0
                ? <p className="text-sm text-emerald-700">All tracked menu items have valid recipes and non-negative gross profit.</p>
                : getRecipeMappingIssues(products, recipes, inventory.stock).map((issue, index) => <p key={`${issue.productId}-${index}`} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900"><strong>{issue.productName}:</strong> {issue.issue}</p>)}
            </div>
          </div>
        </section>
      )}

      {(isSale || isOrders) && heldOrders.length > 0 && (
        <section className="rounded-xl border border-black/5 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-bold">Kitchen / bar queue</h2><p className="text-sm text-ink/60">Orders sent to the kitchen/bar stay here until resumed or cancelled. Stock is not deducted until checkout.</p></div>
            <span className="rounded-full bg-canvas px-3 py-1 text-sm">{heldOrders.length} pending</span>
          </div>
          <div className="mt-3 space-y-2">
            {heldOrders.map(held => (
              <div key={held.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/5 p-3">
                <div>
                  <p className="font-semibold">{held.id} · {held.outlet} · {held.orderType}</p>
                  <p className="text-sm text-ink/60">
                    {held.items.reduce((n, x) => n + x.qty, 0)} items · {held.customer || 'Walk-in customer'}
                    {held.orderType === 'Dine-in' && held.table ? ` · Table ${held.table}` : ''}
                    {held.orderType === 'Delivery' && held.table ? ` · Delivery: ${held.table}` : ''}
                    {held.room ? ` · Room ${held.room}` : ''}
                  </p>
                  <p className="text-xs text-ink/50">Saved {new Date(held.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resumeHeldOrder(held)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Resume</button>
                  <button onClick={() => setHeldOrders(old => old.filter(x => x.id !== held.id))} className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold">Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isTables && (
        <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold">Table Management</h2><p className="mt-1 text-sm text-ink/60">Assign a table, check saved order occupancy, and start or resume a table order.</p></div>
            <span className="rounded-full bg-canvas px-3 py-1.5 text-sm">{tables.length} tables · {occupiedTables.size} occupied</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tables.map(tableId => {
              const held = heldOrders.find(order => order.orderType === 'Dine-in' && order.table === tableId)
              return (
                <button key={tableId} onClick={() => {
                  if (held) {
                    resumeHeldOrder(held)
                    return
                  }
                  setOutlet('Restaurant')
                  setOrderType('Dine-in')
                  setTable(tableId)
                  setDeliveryAddress('')
                  setCurrentOrderOpen(true)
                  navigate('/pos')
                  setNotice(`${tableId} selected. Add items to start the table order.`)
                }} className={`rounded-xl border p-4 text-left transition hover:border-brand ${held ? 'border-amber-300 bg-amber-50' : 'border-black/10 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{tableId}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${held ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{held ? 'Occupied · held' : 'Available'}</span>
                  </div>
                  <p className="mt-3 text-sm text-ink/60">{held ? `${held.items.reduce((sum, item) => sum + item.qty, 0)} item(s) · Resume order` : 'Start new order'}</p>
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 rounded-xl bg-canvas/60 p-4 md:grid-cols-2">
            <div>
              <h3 className="font-bold">Add a table</h3>
              <p className="mt-1 text-xs text-ink/60">Use a unique name such as T13, Patio 1, or VIP-1.</p>
              <div className="mt-2 flex gap-2">
                <input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="Table name" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
                <button onClick={() => {
                  const name = newTableName.trim()
                  if (!name) {
                    setNotice('Enter a table name.')
                    return
                  }
                  if (tables.some(t => t.toLowerCase() === name.toLowerCase())) {
                    setNotice('A table with that name already exists.')
                    return
                  }
                  setTables(old => [...old, name])
                  setNewTableName('')
                  setNotice(`${name} added.`)
                }} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Add table</button>
              </div>
            </div>

            <div>
              <h3 className="font-bold">Edit or remove tables</h3>
              <div className="mt-2 max-h-32 space-y-2 overflow-auto">
                {tables.map(tableId => (
                  <div key={tableId} className="flex items-center gap-2 rounded-lg border border-black/5 bg-white p-2">
                    {editingTable === tableId ? (
                      <>
                        <input value={editedTableName} onChange={e => setEditedTableName(e.target.value)} className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1 text-sm" />
                        <button onClick={() => {
                          const name = editedTableName.trim()
                          if (!name || (name.toLowerCase() !== tableId.toLowerCase() && tables.some(t => t.toLowerCase() === name.toLowerCase()))) {
                            setNotice('Enter a unique table name.')
                            return
                          }
                          if (occupiedTables.has(tableId)) {
                            setNotice('Resume or cancel the active order before renaming this table.')
                            return
                          }
                          setTables(old => old.map(t => t === tableId ? name : t))
                          setTable(current => current === tableId ? name : current)
                          setEditingTable(null)
                          setNotice(`Table renamed to ${name}.`)
                        }} className="text-xs font-semibold text-brand">Save</button>
                        <button onClick={() => setEditingTable(null)} className="text-xs">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 text-sm font-semibold">{tableId}{occupiedTables.has(tableId) ? ' · Occupied' : ''}</span>
                        <button onClick={() => { setEditingTable(tableId); setEditedTableName(tableId) }} className="rounded-md border border-black/10 px-2 py-1 text-xs">Edit</button>
                        <button onClick={() => {
                          if (occupiedTables.has(tableId)) {
                            setNotice('Cannot remove a table with an active order. Resume or cancel that order first.')
                            return
                          }
                          setTables(old => old.filter(t => t !== tableId))
                          if (table === tableId) setTable('')
                          setNotice(`${tableId} removed.`)
                        }} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700">Remove</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isPayments && (
        <section className="space-y-5 rounded-xl border border-black/5 bg-white p-4">
          <div><h2 className="text-lg font-bold">Payment Processing</h2><p className="mt-1 text-sm text-ink/60">Review completed transactions, payment method totals, and receipts.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['Cash', 'Mobile money', 'Card', 'Room charge'] as Payment[]).map(method => {
              const methodSales = sales.filter(sale => sale.payment === method)
              return (
                <div key={method} className="rounded-xl border border-black/5 bg-canvas/50 p-4">
                  <p className="text-sm text-ink/60">{method}</p>
                  <p className="mt-1 text-xl font-bold">{cash(methodSales.reduce((sum, sale) => sum + sale.total, 0))}</p>
                  <p className="mt-1 text-xs text-ink/50">{methodSales.length} transaction(s)</p>
                </div>
              )
            })}
          </div>
          <div className="overflow-x-auto rounded-lg border border-black/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas/70"><tr><th className="px-3 py-2">Receipt</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Customer / Room</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id} className="border-t border-black/5">
                    <td className="px-3 py-2 font-semibold">{sale.id}</td>
                    <td className="px-3 py-2">{new Date(sale.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{sale.customer || (sale.room ? `Room ${sale.room}` : 'Walk-in')}</td>
                    <td className="px-3 py-2">{sale.payment}</td>
                    <td className="px-3 py-2">{sale.paymentReference || '—'}</td>
                    <td className="px-3 py-2 font-semibold">{cash(sale.total)}</td>
                    <td className="px-3 py-2"><button onClick={() => setSelectedReceipt(sale)} className="rounded-md border border-black/10 px-2 py-1 text-xs font-semibold">View receipt</button></td>
                  </tr>
                ))}
                {!sales.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-ink/60">No completed payments yet. Complete an order to see transactions here.</td></tr>}
              </tbody>
            </table>
          </div>
          <button onClick={() => navigate('/pos')} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Create order / take payment</button>
        </section>
      )}

      {isOrders ? (
        <section className="overflow-hidden rounded-xl border border-black/5 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 p-4">
            <div><h2 className="font-bold">Sales history</h2><p className="text-sm text-ink/60">Search, filter, view receipts, and export recorded transactions.</p></div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-canvas px-3 py-1 text-sm">{visibleSales.length} of {sales.length}</span>
              <button onClick={exportSalesCsv} disabled={!visibleSales.length} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Export CSV</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 border-b border-black/5 p-4 sm:grid-cols-2">
            <input value={salesSearch} onChange={e => setSalesSearch(e.target.value)} placeholder="Search order, customer, room, or item…" aria-label="Search sales" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
            <select value={salesPaymentFilter} onChange={e => setSalesPaymentFilter(e.target.value)} aria-label="Filter by payment" className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
              {['All payments', 'Cash', 'Mobile money', 'Card', 'Room charge'].map(method => <option key={method}>{method}</option>)}
            </select>
          </div>
          {!sales.length ? (
            <div className="p-10 text-center">
              <div className="text-3xl">🧾</div>
              <p className="mt-2 font-semibold">No orders yet</p>
              <Link to="/pos" className="mt-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Start a sale</Link>
            </div>
          ) : !visibleSales.length ? (
            <div className="p-8 text-center text-sm text-ink/60">No sales match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas/70 text-ink/60"><tr>{['Order', 'Time', 'Outlet', 'Type / Table', 'Payment', 'Items', 'Total', 'Receipt'].map(heading => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
                <tbody>
                  {visibleSales.map(sale => (
                    <tr key={sale.id} className="border-t border-black/5">
                      <td className="px-4 py-3 font-semibold">{sale.id}{sale.room && <span className="block text-xs font-normal">Room {sale.room}</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{sale.outlet}</td>
                      <td className="px-4 py-3">
                        {sale.orderType ?? '—'}
                        {sale.table ? <span className="block text-xs text-ink/50">{sale.orderType === 'Delivery' ? 'Delivery' : 'Table'}: {sale.table}</span> : null}
                      </td>
                      <td className="px-4 py-3">{sale.payment}</td>
                      <td className="px-4 py-3">{sale.items.reduce((n, item) => n + item.qty, 0)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{cash(sale.total)}</td>
                      <td className="px-4 py-3"><button onClick={() => setSelectedReceipt(sale)} className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-semibold hover:border-brand/40">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : isSale ? (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setOutlet('Restaurant'); setCategory('All items') }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${outlet === 'Restaurant' ? 'bg-brand text-white' : 'border border-black/10 bg-white'}`}>🍽️ Restaurant</button>
              <button onClick={() => { setOutlet('Bar'); setCategory('All items') }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${outlet === 'Bar' ? 'bg-brand text-white' : 'border border-black/10 bg-white'}`}>🥤 Bar</button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input aria-label="Search menu" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items…" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm" />
              <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="rounded-xl border border-black/5 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Low-portion alerts</p>
                <label className="text-xs text-ink/60">Warn at or below <input type="number" min="1" max="100" value={lowPortionThreshold} onChange={e => setLowPortionThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 5)))} className="ml-1 w-16 rounded-md border border-black/10 px-2 py-1" /> portions</label>
              </div>
              <div className="mt-2 space-y-2">
                {products.filter(product => product.outlet === outlet && product.available !== false && product.trackStock !== false && availableServings(product) > 0 && availableServings(product) <= lowPortionThreshold).map(product => (
                  <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                    <span><strong>{product.name}</strong>: {availableServings(product)} portion(s) left; limiting ingredient {availability(product).limitingIngredient ?? 'not identified'}.</span>
                    <button onClick={() => requestRestock(product)} className="rounded-md border border-amber-900/20 bg-white px-2 py-1 text-xs font-semibold">Request restock</button>
                  </div>
                ))}
                {!products.some(product => product.outlet === outlet && product.available !== false && product.trackStock !== false && availableServings(product) > 0 && availableServings(product) <= lowPortionThreshold) && <p className="text-xs text-ink/50">No items are below the configured portion threshold.</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(product => (
                <button key={product.id} disabled={product.trackStock !== false && availableServings(product) <= 0} onClick={() => add(product)} className="group rounded-xl border border-black/5 bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-2xl">{product.emoji}</span>
                    <span className={`rounded-full px-2 py-1 text-xs ${(recipes[product.id]?.length ?? 0) === 0 && product.trackStock !== false ? 'bg-amber-50 text-amber-800' : product.trackStock !== false && availableServings(product) <= 5 ? 'bg-amber-50 text-amber-800' : 'bg-canvas text-ink/60'}`}>
                      {product.trackStock === false ? 'Stock not tracked' : (recipes[product.id]?.length ?? 0) === 0 ? 'Recipe needed' : availableServings(product) <= 0 ? 'Sold out (86)' : `${availableServings(product)} portions available`}
                    </span>
                  </div>
                  <p className="mt-4 font-semibold">{product.name}</p>
                  <p className="mt-1 text-xs text-ink/50">{product.category} · per {product.unit}</p>
                  {product.trackStock !== false && availableServings(product) <= 0 && availability(product).limitingIngredient && <p className="mt-1 text-xs text-red-700">Limiting ingredient: {availability(product).limitingIngredient}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-brand">{cash(product.price)}</span>
                    <span className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white">+ Add</span>
                  </div>
                </button>
              ))}
            </div>
            {!shown.length && <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-ink/60">No menu items match your search.</div>}
          </section>

          <aside className="overflow-hidden rounded-xl border border-black/5 bg-white xl:sticky xl:top-4">
            <button type="button" aria-expanded={currentOrderOpen} onClick={() => setCurrentOrderOpen(open => !open)} className="flex w-full items-center justify-between border-b border-black/5 p-4 text-left">
              <div>
                <h2 className="font-bold">Current order</h2>
                <p className="mt-1 text-sm text-ink/60">
                  {outlet} · {orderType}
                  {orderType === 'Dine-in' && table ? ` · Table ${table}` : ''}
                  {orderType === 'Delivery' && deliveryAddress ? ` · Delivery` : ''}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{count} items · {cash(total)}</span>
                <span aria-hidden="true" className="text-lg">{currentOrderOpen ? '▾' : '▸'}</span>
              </span>
            </button>

            {currentOrderOpen && (
              <>
                {!lines.length ? (
                  <div className="px-4 py-10 text-center">
                    <div className="text-3xl">🛒</div>
                    <p className="mt-2 font-semibold">Your order is empty</p>
                    <p className="mt-1 text-sm text-ink/60">Select a menu item to get started.</p>
                  </div>
                ) : (
                  <div className="max-h-72 space-y-4 overflow-y-auto p-4">
                    {lines.map(line => (
                      <div key={line.productId} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{line.product.name}</p>
                          <p className="mt-0.5 text-xs text-ink/50">{cash(line.product.price)} each</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button onClick={() => qty(line.productId, -1)} aria-label="Decrease quantity" className="h-7 w-7 rounded-md border border-black/10">−</button>
                            <span className="w-5 text-center text-sm font-semibold">{line.qty}</span>
                            <button onClick={() => qty(line.productId, 1)} aria-label="Increase quantity" className="h-7 w-7 rounded-md border border-black/10">+</button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <select aria-label={`${line.product.name} course`} value={line.course ?? 'Main'} onChange={event => updateCartLine(line.productId, { course: event.target.value })} className="min-w-0 rounded-md border border-black/10 px-2 py-1 text-xs"><option>Drinks</option><option>Starter</option><option>Main</option><option>Dessert</option></select>
                            <input aria-label={`${line.product.name} preparation note`} value={line.note ?? ''} onChange={event => updateCartLine(line.productId, { note: event.target.value })} placeholder="Item note (no onions)" className="min-w-0 rounded-md border border-black/10 px-2 py-1 text-xs" />
                          </div>
                        </div>
                        <span className="whitespace-nowrap text-sm font-semibold">{cash(line.product.price * line.qty)}</span>
                      </div>
                    ))}
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
                        {(['Dine-in', 'Takeaway', 'Delivery'] as OrderType[]).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>

                    {orderType === 'Dine-in' && (
                      <label className="block text-sm font-semibold">
                        Select table
                        <select
                          value={table}
                          onChange={e => setTable(e.target.value)}
                          className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal"
                        >
                          <option value="">Select a table</option>
                          {availableTables.map(tableId => (
                            <option key={tableId} value={tableId}>{tableId}</option>
                          ))}
                        </select>
                        {!availableTables.length && (
                          <span className="mt-1 block text-xs font-normal text-amber-700">
                            All tables are occupied. Add a table or complete/cancel an active order.
                          </span>
                        )}
                      </label>
                    )}

                    {orderType === 'Delivery' && (
                      <label className="block text-sm font-semibold">
                        Delivery address
                        <input
                          value={deliveryAddress}
                          onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Delivery address / location"
                          className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal"
                        />
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
                      Order notes / special instructions
                      <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} placeholder="Allergies, no onions, delivery instructions…" className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" />
                    </label>

                    <label className="block text-sm font-semibold">
                      Discount (%)
                      <input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 font-normal" />
                    </label>
                  </div>

                  <div className="flex justify-between text-sm text-ink/60"><span>Subtotal</span><span>{cash(subtotal)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-sm text-ink/60"><span>Discount ({Math.min(100, Math.max(0, Number(discountPercent) || 0))}%)</span><span>−{cash(discount)}</span></div>}
                  <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{cash(total)}</span></div>

                  {!paying ? (
                    <div className="grid grid-cols-2 gap-2">
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

                      {payment === 'Room charge' && (
                        <label className="block text-sm font-semibold">
                          Guest room number
                          <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. 204" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 font-normal" />
                        </label>
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

                      <button onClick={checkout} className="w-full rounded-lg bg-brand px-3 py-3 text-sm font-bold text-white">Record payment · {cash(total)}</button>
                      <button onClick={() => setPaying(false)} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold">Back to order</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {selectedReceipt && (
        <div className="pos-receipt-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Sales receipt">
          <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl print:shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-widest text-ink/50">Gastora Hotel</p><h2 className="mt-1 text-xl font-bold">Sales receipt</h2></div>
              <button onClick={() => setSelectedReceipt(null)} className="rounded-md border border-black/10 px-3 py-1 text-sm print:hidden">Close</button>
            </div>

            <div className="mt-5 space-y-1 border-b border-dashed border-black/20 pb-4 text-sm">
              <p><strong>Receipt:</strong> {selectedReceipt.id}</p>
              <p><strong>Date:</strong> {new Date(selectedReceipt.createdAt).toLocaleString()}</p>
              <p><strong>Outlet:</strong> {selectedReceipt.outlet}</p>
              {selectedReceipt.orderType && <p><strong>Order type:</strong> {selectedReceipt.orderType}</p>}
              {selectedReceipt.table && <p><strong>{selectedReceipt.orderType === 'Delivery' ? 'Delivery address' : 'Table'}:</strong> {selectedReceipt.table}</p>}
              {selectedReceipt.customer && <p><strong>Customer:</strong> {selectedReceipt.customer}</p>}
              <p><strong>Payment:</strong> {selectedReceipt.payment}</p>
              {selectedReceipt.paymentReference && <p><strong>Reference:</strong> {selectedReceipt.paymentReference}</p>}
              {selectedReceipt.room && <p><strong>Room:</strong> {selectedReceipt.room}</p>}
              {selectedReceipt.notes && <p><strong>Notes:</strong> {selectedReceipt.notes}</p>}
            </div>

            <div className="py-4">
              {selectedReceipt.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex justify-between gap-3 py-1.5 text-sm">
                  <span>{item.qty} × {item.name}<span className="block text-xs text-ink/50">{cash(item.price)} each</span></span>
                  <strong>{cash(item.qty * item.price)}</strong>
                </div>
              ))}
            </div>

            {(selectedReceipt.discount ?? 0) > 0 && <div className="flex justify-between border-t border-black/10 pt-3 text-sm"><span>Subtotal</span><span>{cash(selectedReceipt.subtotal ?? selectedReceipt.total + (selectedReceipt.discount ?? 0))}</span></div>}
            {(selectedReceipt.discount ?? 0) > 0 && <div className="flex justify-between pt-1 text-sm"><span>Discount</span><span>−{cash(selectedReceipt.discount ?? 0)}</span></div>}
            <div className="flex justify-between border-t border-black/10 pt-4 text-lg font-bold"><span>Total</span><span>{cash(selectedReceipt.total)}</span></div>
            {selectedReceipt.payment === 'Cash' && <div className="mt-2 flex justify-between text-sm"><span>Cash received</span><span>{cash(selectedReceipt.amountTendered ?? selectedReceipt.total)}</span></div>}
            {selectedReceipt.payment === 'Cash' && <div className="flex justify-between text-sm"><span>Change</span><span>{cash(selectedReceipt.changeDue ?? 0)}</span></div>}
            <p className="mt-5 text-center text-xs text-ink/50">Thank you for dining with us.</p>
            <button onClick={() => window.print()} className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white print:hidden">Print receipt</button>
          </section>
        </div>
      )}
    </div>
  )
}
