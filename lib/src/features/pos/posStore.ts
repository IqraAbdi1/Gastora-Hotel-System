import type { HeldOrder, Product, Sale, Recipes } from './posTypes'

/** Keep these existing keys stable: users may already have saved data in them. */
export const POS_STORAGE_KEYS = {
  products: 'gastora.pos.products.v1',
  heldOrders: 'gastora.pos.heldOrders.v1',
  tables: 'gastora.pos.tables.v1',
  sales: 'gastora.pos.sales.v1',
  recipes: 'gastora.pos.recipes.v1',
} as const

export const POS_SCHEMA_VERSION_KEY = 'gastora.pos.schemaVersion'
export const POS_SCHEMA_VERSION = 1

export interface PosSnapshot {
  products: Product[]
  heldOrders: HeldOrder[]
  sales: Sale[]
  recipes: Recipes
}

/**
 * Non-destructive migration: add only optional lifecycle fields to legacy orders.
 * It does not delete orders, rename keys, or alter the shape of existing records.
 */
export function migrateHeldOrders(value: unknown): HeldOrder[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is HeldOrder => {
    return typeof item === 'object' && item !== null && typeof (item as HeldOrder).id === 'string'
      && Array.isArray((item as HeldOrder).items)
  }).map(order => ({
    ...order,
    status: order.status ?? order.kitchenStatus ?? 'New',
  }))
}

/** Safe pure migration entry point for a parsed legacy POS snapshot. */
export function migratePosSnapshot(snapshot: Partial<PosSnapshot>): Partial<PosSnapshot> {
  return {
    ...snapshot,
    ...(snapshot.heldOrders !== undefined ? { heldOrders: migrateHeldOrders(snapshot.heldOrders) } : {}),
  }
}
