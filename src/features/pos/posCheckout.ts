import type { RequestsValue } from '../procurement/requestsContext'
import { claimLineDeduction, finishLineDeduction, isLineDeducted } from './posStore'
import type { Recipes } from './posTypes'
import type { PricedLine } from './posRules'
import { convertQuantity, grossQuantity, validateRecipe } from './recipeEngine'

export type DeductionResult = { ok: true; refs: string[]; movements: number } | { ok: false; error: string }

/**
 * Takes the ingredients of every line out of stock, once per order line. Every recipe is checked before
 * anything moves; a line the kitchen already deducted is skipped.
 */
export function deductOrderStock(
  lines: PricedLine[],
  recipes: Recipes,
  inventory: Pick<RequestsValue, 'stock' | 'consumeStockForSale'>,
  orderRef: string,
  saleId: string,
  outlet: string,
): DeductionResult {
  for (const line of lines) {
    if (line.product.trackStock === false || line.stockDeducted || isLineDeducted(`${orderRef}:${line.lineId ?? line.productId}`)) continue
    const recipe = recipes[line.product.id] ?? []
    if (!recipe.length) return { ok: false, error: `Configure an inventory recipe for ${line.product.name} before completing this sale.` }
    const recipeIssues = validateRecipe(recipe, inventory.stock)
    if (recipeIssues.length) return { ok: false, error: `${line.product.name}: ${recipeIssues[0]}` }
    for (const ingredient of recipe) {
      const stockItem = inventory.stock.find((item) => item.id === ingredient.stockId)
      if (!stockItem) return { ok: false, error: `A recipe ingredient for ${line.product.name} is no longer in inventory. Please update the recipe.` }
      const converted = convertQuantity(ingredient.qty, ingredient.unit || stockItem.unit, stockItem.unit)
      if (converted === null || converted <= 0) return { ok: false, error: `Invalid or incompatible recipe unit for ${stockItem.name}.` }
      if ((ingredient.wastePercent ?? 0) >= 100) return { ok: false, error: `Waste percentage for ${stockItem.name} must be less than 100%.` }
    }
  }

  const refs: string[] = []
  let movements = 0
  for (const line of lines) {
    if (line.product.trackStock === false) continue
    const ref = `${orderRef}:${line.lineId ?? line.productId}`
    if (line.stockDeducted || isLineDeducted(ref)) continue
    const recipe = recipes[line.product.id] ?? []
    const deductions: { name: string; qty: number }[] = []
    for (const ingredient of recipe) {
      const stockItem = inventory.stock.find((item) => item.id === ingredient.stockId)
      if (!stockItem) return { ok: false, error: `A recipe ingredient for ${line.product.name} is no longer in inventory. Please update the recipe.` }
      const converted = convertQuantity(ingredient.qty, ingredient.unit || stockItem.unit, stockItem.unit)
      if (converted === null || converted <= 0) return { ok: false, error: `Invalid or incompatible recipe unit for ${stockItem.name}.` }
      deductions.push({ name: stockItem.name, qty: grossQuantity(converted, ingredient) * line.qty })
    }
    if (!deductions.length) continue
    if (!claimLineDeduction(ref)) {
      if (isLineDeducted(ref)) continue
      return { ok: false, error: `Stock deduction for ${line.product.name} is already in progress. Refresh and verify inventory before retrying.` }
    }
    const stockResult = inventory.consumeStockForSale(deductions, saleId, outlet, ref)
    if (stockResult.ok === false) {
      finishLineDeduction(ref, stockResult.error)
      return { ok: false, error: stockResult.error }
    }
    finishLineDeduction(ref)
    refs.push(ref)
    movements += stockResult.value.length
  }
  return { ok: true, refs, movements }
}

/** Sale lines for the receipt: modifiers in the name, add-ons and line discounts in the price. */
export function saleItemsOf(lines: PricedLine[]) {
  return lines.map((line) => {
    const mods = (line.modifiers ?? []).map((m) => m.name).join(', ')
    const unit = (line.unitPrice ?? line.product.price) + (line.modifiers ?? []).reduce((s, m) => s + m.price, 0)
    const pctOff = Math.min(100, Math.max(0, line.discountPercent ?? 0))
    return {
      name: `${line.product.name}${mods ? ` (${mods})` : ''}${line.comboName ? ` · ${line.comboName}` : ''}`,
      qty: line.qty,
      price: Math.round(unit * (1 - pctOff / 100)),
    }
  })
}
