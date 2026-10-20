import type { Product, RecipeIngredient, Recipes } from './posTypes'
import type { StockItem } from '../procurement/requestsModel'

export type UnitDimension = 'mass' | 'volume' | 'count' | 'unknown'
export type RecipeIssue = { productId: string; productName: string; issue: string }
export type RecipeAvailability = {
  portions: number
  limitingIngredient: string | null
  reason: string | null
}
export type RecipeCost = {
  costPerPortion: number
  sellingPrice: number
  grossProfit: number
  marginPercent: number
  foodCostPercent: number
}

const UNIT_FACTORS: Record<string, { dimension: UnitDimension; factor: number }> = {
  g: { dimension: 'mass', factor: 1 },
  gram: { dimension: 'mass', factor: 1 },
  grams: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  kilogram: { dimension: 'mass', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  millilitre: { dimension: 'volume', factor: 1 },
  milliliter: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  litre: { dimension: 'volume', factor: 1000 },
  liter: { dimension: 'volume', factor: 1000 },
  piece: { dimension: 'count', factor: 1 },
  pieces: { dimension: 'count', factor: 1 },
  each: { dimension: 'count', factor: 1 },
  bottle: { dimension: 'count', factor: 1 },
  can: { dimension: 'count', factor: 1 },
  portion: { dimension: 'count', factor: 1 },
}

const unitKey = (unit: string) => unit.trim().toLowerCase()

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null
  const from = UNIT_FACTORS[unitKey(fromUnit)]
  const to = UNIT_FACTORS[unitKey(toUnit)]
  if (!from || !to || from.dimension !== to.dimension) {
    return unitKey(fromUnit) === unitKey(toUnit) ? quantity : null
  }
  return (quantity * from.factor) / to.factor
}

export function validateRecipe(ingredients: RecipeIngredient[], stock: StockItem[]): string[] {
  const issues: string[] = []
  const seen = new Set<string>()
  for (const ingredient of ingredients) {
    if (!ingredient.stockId.trim()) issues.push('Choose an inventory item for every ingredient.')
    if (!Number.isFinite(ingredient.qty) || ingredient.qty <= 0) issues.push('Ingredient quantities must be greater than zero.')
    if (seen.has(ingredient.stockId)) issues.push('A stock item can only appear once in a recipe.')
    seen.add(ingredient.stockId)
    const item = stock.find((entry) => entry.id === ingredient.stockId)
    if (!item) {
      issues.push(`Recipe points to missing stock item ${ingredient.stockId || '(not selected)'}.`)
      continue
    }
    const unit = ingredient.unit || item.unit
    if (convertQuantity(ingredient.qty, unit, item.unit) === null) {
      issues.push(`Cannot convert ${unit} to ${item.unit} for ${item.name}.`)
    }
    if (ingredient.wastePercent !== undefined && (!Number.isFinite(ingredient.wastePercent) || ingredient.wastePercent < 0 || ingredient.wastePercent >= 100)) {
      issues.push(`Waste percentage for ${item.name} must be between 0 and 99.99.`)
    }
    if (ingredient.yieldPercent !== undefined && (!Number.isFinite(ingredient.yieldPercent) || ingredient.yieldPercent <= 0 || ingredient.yieldPercent > 100)) {
      issues.push(`Yield for ${item.name} must be between 1 and 100%.`)
    }
  }
  return [...new Set(issues)]
}

/**
 * Stock to issue for a net recipe quantity: divided by the trim yield, then by (1 - waste%).
 * With no yield set this is exactly the original waste-only rule.
 */
export function grossQuantity(converted: number, ingredient: Pick<RecipeIngredient, 'wastePercent' | 'yieldPercent'>): number {
  const waste = ingredient.wastePercent ?? 0
  const yieldShare = ingredient.yieldPercent && ingredient.yieldPercent > 0 ? Math.min(100, ingredient.yieldPercent) / 100 : 1
  return converted / yieldShare / (1 - waste / 100)
}

export function requiredStockQuantity(ingredient: RecipeIngredient, item: StockItem): number | null {
  const converted = convertQuantity(ingredient.qty, ingredient.unit || item.unit, item.unit)
  if (converted === null || converted <= 0) return null
  return grossQuantity(converted, ingredient)
}

export function calculateAvailability(
  product: Product,
  recipes: Recipes,
  stock: StockItem[],
  stockOf: (name: string) => number,
): RecipeAvailability {
  if (product.trackStock === false) return { portions: Number.MAX_SAFE_INTEGER, limitingIngredient: null, reason: null }
  const recipe = recipes[product.id] ?? []
  if (recipe.length === 0) return { portions: 0, limitingIngredient: null, reason: 'Recipe required' }
  const issues = validateRecipe(recipe, stock)
  if (issues.length) return { portions: 0, limitingIngredient: null, reason: issues[0] }

  let portions = Number.MAX_SAFE_INTEGER
  let limitingIngredient: string | null = null
  for (const ingredient of recipe) {
    const item = stock.find((entry) => entry.id === ingredient.stockId)
    if (!item) return { portions: 0, limitingIngredient: null, reason: 'Recipe references missing inventory' }
    const required = requiredStockQuantity(ingredient, item)
    if (required === null || required <= 0) return { portions: 0, limitingIngredient: item.name, reason: 'Invalid recipe quantity or unit' }
    const possible = Math.floor(Math.max(0, stockOf(item.name)) / required)
    if (possible < portions) {
      portions = possible
      limitingIngredient = item.name
    }
  }
  return { portions: portions === Number.MAX_SAFE_INTEGER ? 0 : portions, limitingIngredient, reason: null }
}

export function calculateRecipeCost(
  product: Product,
  recipes: Recipes,
  stock: StockItem[],
): RecipeCost | null {
  if (product.trackStock === false) return { costPerPortion: 0, sellingPrice: product.price, grossProfit: product.price, marginPercent: 100, foodCostPercent: 0 }
  const recipe = recipes[product.id] ?? []
  if (!recipe.length || validateRecipe(recipe, stock).length) return null
  const costPerPortion = recipe.reduce((total, ingredient) => {
    const item = stock.find((entry) => entry.id === ingredient.stockId)
    if (!item) return total
    const quantity = requiredStockQuantity(ingredient, item)
    return total + (quantity === null ? 0 : quantity * item.unitCost)
  }, 0)
  const grossProfit = product.price - costPerPortion
  return {
    costPerPortion,
    sellingPrice: product.price,
    grossProfit,
    marginPercent: product.price > 0 ? (grossProfit / product.price) * 100 : 0,
    foodCostPercent: product.price > 0 ? (costPerPortion / product.price) * 100 : 0,
  }
}

/** Seed recipes are additive: migration only fills product IDs without an existing recipe. */
export const SEED_RECIPES: Recipes = {
  m1: [
    { stockId: 'fnb-chicken', qty: 220, unit: 'g' },
    { stockId: 'fnb-potato', qty: 250, unit: 'g', wastePercent: 5 },
    { stockId: 'fnb-oil', qty: 20, unit: 'ml' },
    { stockId: 'fnb-salt', qty: 3, unit: 'g' },
  ],
  m2: [
    { stockId: 'fnb-beef', qty: 150, unit: 'g' },
    { stockId: 'fnb-bun', qty: 1, unit: 'piece' },
    { stockId: 'fnb-lettuce', qty: 20, unit: 'g' },
    { stockId: 'fnb-tomato', qty: 30, unit: 'g' },
    { stockId: 'fnb-oil', qty: 10, unit: 'ml' },
  ],
  m3: [
    { stockId: 'fnb-fish', qty: 180, unit: 'g', wastePercent: 4, yieldPercent: 85 },
    { stockId: 'fnb-oil', qty: 15, unit: 'ml' },
    { stockId: 'fnb-lemon', qty: 0.25, unit: 'piece' },
  ],
  m4: [
    { stockId: 'fnb-rice', qty: 150, unit: 'g' },
    { stockId: 'fnb-vegetables', qty: 80, unit: 'g' },
    { stockId: 'fnb-oil', qty: 10, unit: 'ml' },
  ],
  m5: [
    { stockId: 'fnb-lettuce', qty: 80, unit: 'g' },
    { stockId: 'fnb-tomato', qty: 60, unit: 'g' },
    { stockId: 'fnb-cucumber', qty: 50, unit: 'g' },
  ],
  d1: [{ stockId: 'fnb-orange', qty: 3, unit: 'piece' }],
  d2: [{ stockId: 'fnb-soda', qty: 1, unit: 'bottle' }],
  d3: [{ stockId: 'fnb-water', qty: 1, unit: 'bottle' }],
  d4: [
    { stockId: 'fnb-juice-base', qty: 100, unit: 'ml' },
    { stockId: 'fnb-syrup', qty: 20, unit: 'ml' },
    { stockId: 'fnb-lemon', qty: 0.1, unit: 'piece' },
  ],
  d5: [
    { stockId: 'fnb-coffee', qty: 18, unit: 'g' },
    { stockId: 'fnb-milk', qty: 30, unit: 'ml' },
  ],
  d6: [{ stockId: 'fnb-beer', qty: 1, unit: 'bottle' }],
  d7: [{ stockId: 'fnb-wine', qty: 150, unit: 'ml' }],
}

export function getRecipeMappingIssues(products: Product[], recipes: Recipes, stock: StockItem[]): RecipeIssue[] {
  const issues: RecipeIssue[] = []
  for (const product of products) {
    if (product.trackStock === false) continue
    const recipe = recipes[product.id] ?? []
    if (!recipe.length) {
      issues.push({ productId: product.id, productName: product.name, issue: 'No recipe configured' })
      continue
    }
    for (const message of validateRecipe(recipe, stock)) {
      issues.push({ productId: product.id, productName: product.name, issue: message })
    }
    const cost = calculateRecipeCost(product, recipes, stock)
    if (cost && cost.grossProfit < 0) {
      issues.push({ productId: product.id, productName: product.name, issue: 'Recipe cost exceeds selling price' })
    }
  }
  return issues
}
