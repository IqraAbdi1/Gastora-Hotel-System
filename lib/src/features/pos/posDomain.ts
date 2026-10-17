import type { HeldOrder, OrderLine, OrderStatus, Product, RecipeIngredient } from './posTypes'

export interface StockAmount { stockId: string; quantity: number; unit: string }
export interface RecipeCostResult { costPerPortion: number; sellingPrice: number; margin: number; foodCostPercent: number }
export interface DeductionPlanLine { lineId: string; productId: string; quantity: number; reference: string }

export type RoomReservationResolution<T> =
  | { kind: 'missing' }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'found'; reservation: T }

/** Resolve a room-charge target only when exactly one guest is checked in to that room. */
export function resolveInHouseReservationForRoom<T extends { status: string; room: string | null }>(
  reservations: readonly T[],
  room: string,
): RoomReservationResolution<T> {
  const normalizedRoom = room.trim().toLocaleLowerCase()
  if (!normalizedRoom) return { kind: 'missing' }
  const matches = reservations.filter(
    reservation => reservation.status === 'in-house' && reservation.room?.trim().toLocaleLowerCase() === normalizedRoom,
  )
  if (matches.length === 0) return { kind: 'missing' }
  if (matches.length > 1) return { kind: 'ambiguous', count: matches.length }
  return { kind: 'found', reservation: matches[0] }
}


const UNIT_FACTORS: Record<string, { family: string; factor: number }> = {
  g: { family: 'mass', factor: 1 }, kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 }, l: { family: 'volume', factor: 1000 },
  each: { family: 'count', factor: 1 }, piece: { family: 'count', factor: 1 }, bottle: { family: 'count', factor: 1 }, cup: { family: 'count', factor: 1 },
}

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be a finite non-negative number.')
  const from = UNIT_FACTORS[fromUnit.trim().toLowerCase()]
  const to = UNIT_FACTORS[toUnit.trim().toLowerCase()]
  if (!from || !to || from.family !== to.family) throw new Error(`Incompatible units: ${fromUnit} and ${toUnit}.`)
  return quantity * from.factor / to.factor
}

export function calculateRecipeCost(ingredients: RecipeIngredient[], unitCosts: ReadonlyMap<string, number>, sellingPrice: number): RecipeCostResult {
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) throw new Error('Selling price must be non-negative.')
  const costPerPortion = ingredients.reduce((total, ingredient) => {
    if (!Number.isFinite(ingredient.qty) || ingredient.qty <= 0) throw new Error('Recipe quantities must be greater than zero.')
    const unitCost = unitCosts.get(ingredient.stockId)
    if (unitCost === undefined || !Number.isFinite(unitCost) || unitCost < 0) throw new Error(`Missing valid unit cost for stock item ${ingredient.stockId}.`)
    const yieldPercent = ingredient.yieldPercent ?? 100
    if (yieldPercent <= 0 || yieldPercent > 100) throw new Error('Yield must be greater than 0 and at most 100 percent.')
    return total + ingredient.qty * unitCost * (100 / yieldPercent)
  }, 0)
  return { costPerPortion, sellingPrice, margin: sellingPrice - costPerPortion, foodCostPercent: sellingPrice === 0 ? (costPerPortion === 0 ? 0 : Infinity) : costPerPortion / sellingPrice * 100 }
}

export function calculateAvailablePortions(ingredients: RecipeIngredient[], stockQuantities: ReadonlyMap<string, number>): number {
  if (ingredients.length === 0) return 0
  return Math.min(...ingredients.map(ingredient => {
    if (!Number.isFinite(ingredient.qty) || ingredient.qty <= 0) return 0
    return Math.floor(Math.max(0, stockQuantities.get(ingredient.stockId) ?? 0) / ingredient.qty)
  }))
}

export function createDeductionPlan(order: Pick<HeldOrder, 'id' | 'items'>): DeductionPlanLine[] {
  return order.items.filter(line => line.stockDeducted !== true && line.qty > 0).map((line, index) => ({
    lineId: line.id ?? `${line.productId}-${index}`,
    productId: line.productId,
    quantity: line.qty,
    reference: `${order.id}:${line.id ?? `${line.productId}-${index}`}`,
  }))
}

export function transitionOrderStatus(order: HeldOrder, status: OrderStatus, at = new Date().toISOString()): HeldOrder {
  const updated: HeldOrder = { ...order, status, updatedAt: at, kitchenStatus: status === 'Draft' || status === 'Cancelled' ? order.kitchenStatus : status === 'Served' ? 'Ready' : status }
  if (status === 'Preparing') updated.preparingAt = at
  if (status === 'Ready') updated.readyAt = at
  if (status === 'Served') updated.servedAt = at
  if (status === 'Cancelled') updated.cancelledAt = at
  return updated
}

export function productById(products: readonly Product[], productId: string): Product | undefined {
  return products.find(product => product.id === productId)
}

export function validateRecipe(ingredients: RecipeIngredient[], stockIds: ReadonlySet<string>): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const ingredient of ingredients) {
    if (!Number.isFinite(ingredient.qty) || ingredient.qty <= 0) errors.push(`Ingredient ${ingredient.stockId}: quantity must be greater than zero.`)
    if (seen.has(ingredient.stockId)) errors.push(`Duplicate stock item: ${ingredient.stockId}.`)
    if (!stockIds.has(ingredient.stockId)) errors.push(`Missing stock item: ${ingredient.stockId}.`)
    seen.add(ingredient.stockId)
  }
  return errors
}

export function lineToDeductionInput(line: OrderLine, orderId: string, index: number): DeductionPlanLine | null {
  if (line.stockDeducted || line.qty <= 0) return null
  const lineId = line.id ?? `${line.productId}-${index}`
  return { lineId, productId: line.productId, quantity: line.qty, reference: `${orderId}:${lineId}` }
}
