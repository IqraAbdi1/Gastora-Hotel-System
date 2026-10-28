import { POS_SCHEMA_VERSION, POS_SCHEMA_VERSION_KEY, POS_STORAGE_KEYS } from './posTypes'
import type { HeldOrder, KitchenStatus, Product, Recipes } from './posTypes'
import { SEED_RECIPES } from './recipeEngine'
import { EXTRA_PRODUCTS, EXTRA_RECIPES } from './posSeed'

/**
 * Versioned, non-destructive migration for existing browser data.
 * Existing storage keys and record fields are retained. Missing kitchen status
 * already behaved as `New` in the KDS, so persisting that default is behaviour-neutral.
 */
export function migratePosStorage(): void {
  if (typeof window === 'undefined') return

  const savedVersion = Number(window.localStorage.getItem(POS_SCHEMA_VERSION_KEY) ?? 0)
  if (savedVersion >= POS_SCHEMA_VERSION) return

  try {
    const rawOrders = window.localStorage.getItem(POS_STORAGE_KEYS.heldOrders)
    if (rawOrders !== null) {
      const parsed: unknown = JSON.parse(rawOrders)
      if (Array.isArray(parsed)) {
        const migrated = parsed.map((value: unknown) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return value
          const order = value as Record<string, unknown>
          const status = order.kitchenStatus
          const validStatus: KitchenStatus | undefined =
            status === 'New' || status === 'Preparing' || status === 'Ready' || status === 'Served' || status === 'Cancelled'
              ? status
              : undefined
          return {
            ...order,
            ...(validStatus ? { kitchenStatus: validStatus } : { kitchenStatus: 'New' }),
            items: Array.isArray(order.items) ? order.items.map((lineValue, index) => {
              if (!lineValue || typeof lineValue !== 'object' || Array.isArray(lineValue)) return lineValue
              const line = lineValue as Record<string, unknown>
              return { ...line, lineId: typeof line.lineId === 'string' && line.lineId ? line.lineId : `${String(order.id ?? 'legacy-order')}-line-${index + 1}`, status: line.status === 'Preparing' || line.status === 'Ready' || line.status === 'Served' || line.status === 'Cancelled' ? line.status : 'New' }
            }) : order.items,
          }
        }) as HeldOrder[]
        window.localStorage.setItem(POS_STORAGE_KEYS.heldOrders, JSON.stringify(migrated))
      }
    }

    // The legacy Product.stock field was unused. Remove it while retaining all other saved product data.
    const rawProducts = window.localStorage.getItem(POS_STORAGE_KEYS.products)
    if (rawProducts !== null) {
      const parsedProducts: unknown = JSON.parse(rawProducts)
      if (Array.isArray(parsedProducts)) {
        const migratedProducts = parsedProducts.map((value: unknown) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return value
          const product = { ...(value as Record<string, unknown>) }
          delete product.stock
          return product
        }) as Product[]
        // v4: menu items for the new outlet types, added only where the id is missing.
        const ids = new Set(migratedProducts.map((product) => product?.id))
        const added = EXTRA_PRODUCTS.filter((product) => !ids.has(product.id))
        window.localStorage.setItem(POS_STORAGE_KEYS.products, JSON.stringify([...migratedProducts, ...added]))
      }
    }

    // Seed only missing recipe IDs. Existing staff-defined recipes are never overwritten.
    const rawRecipes = window.localStorage.getItem(POS_STORAGE_KEYS.recipes)
    const parsedRecipes: unknown = rawRecipes === null ? {} : JSON.parse(rawRecipes)
    if (parsedRecipes && typeof parsedRecipes === 'object' && !Array.isArray(parsedRecipes)) {
      const existing = parsedRecipes as Recipes
      const merged: Recipes = { ...SEED_RECIPES, ...EXTRA_RECIPES, ...existing }
      window.localStorage.setItem(POS_STORAGE_KEYS.recipes, JSON.stringify(merged))
    }

    window.localStorage.setItem(POS_SCHEMA_VERSION_KEY, String(POS_SCHEMA_VERSION))
  } catch {
    // Do not mark the migration complete if browser storage is unavailable or malformed.
    // Most importantly, never clear or replace existing data on a failed migration.
  }
}


export type DeductionLedgerEntry = {
  ref: string
  status: 'pending' | 'deducted'
  updatedAt: string
  error?: string
}

/** Synchronous localStorage claim prevents duplicate calls in the same browser event loop. */
export function claimLineDeduction(ref: string): boolean {
  if (typeof window === 'undefined' || !ref.trim()) return false
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEYS.deductionLedger)
    const ledger: DeductionLedgerEntry[] = raw ? JSON.parse(raw) as DeductionLedgerEntry[] : []
    if (ledger.some(entry => entry.ref === ref && (entry.status === 'pending' || entry.status === 'deducted'))) return false
    window.localStorage.setItem(POS_STORAGE_KEYS.deductionLedger, JSON.stringify([
      ...ledger.filter(entry => entry.ref !== ref),
      { ref, status: 'pending', updatedAt: new Date().toISOString() },
    ]))
    return true
  } catch {
    return false
  }
}

export function isLineDeducted(ref: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEYS.deductionLedger)
    const ledger: DeductionLedgerEntry[] = raw ? JSON.parse(raw) as DeductionLedgerEntry[] : []
    return ledger.some(entry => entry.ref === ref && entry.status === 'deducted')
  } catch { return false }
}

export function finishLineDeduction(ref: string, error?: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEYS.deductionLedger)
    const ledger: DeductionLedgerEntry[] = raw ? JSON.parse(raw) as DeductionLedgerEntry[] : []
    const next = ledger.filter(entry => entry.ref !== ref)
    if (!error) next.push({ ref, status: 'deducted', updatedAt: new Date().toISOString() })
    window.localStorage.setItem(POS_STORAGE_KEYS.deductionLedger, JSON.stringify(next))
  } catch { /* The inventory movement ledger remains the secondary idempotency guard. */ }
}

export function archiveOrder(order: HeldOrder): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEYS.orderHistory)
    const history: HeldOrder[] = raw ? JSON.parse(raw) as HeldOrder[] : []
    window.localStorage.setItem(POS_STORAGE_KEYS.orderHistory, JSON.stringify([
      { ...order, updatedAt: new Date().toISOString() },
      ...history.filter(item => item.id !== order.id),
    ]))
    return true
  } catch { return false /* Keep the active queue intact if history cannot be written. */ }
}
