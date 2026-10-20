import { useState } from 'react'
import { Card } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useRequests } from '../procurement/requestsContext'
import { cash } from './posFormat'
import { BASE_PRODUCTS, EXTRA_PRODUCTS } from './posSeed'
import { POS_STORAGE_KEYS } from './posTypes'
import type { Product, RecipeIngredient, Recipes } from './posTypes'
import { calculateRecipeCost, getRecipeMappingIssues, validateRecipe } from './recipeEngine'

const seed = [...BASE_PRODUCTS, ...EXTRA_PRODUCTS]
const small = 'mt-1 block w-full rounded-lg border border-black/10 bg-white px-2 py-2 text-sm font-normal'

export default function RecipesEditor({ outletNames, initialProductId, onNotice }: { outletNames: string[]; initialProductId?: string; onNotice: (text: string) => void }) {
  const inventory = useRequests()
  const [allProducts] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const [recipes, setRecipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const [foodCostThreshold, setFoodCostThreshold] = useBrowserSyncedState<number>('gastora.pos.foodCostThreshold.v1', 35)
  const [lowPortionThreshold, setLowPortionThreshold] = useBrowserSyncedState<number>('gastora.pos.lowPortionThreshold.v1', 5)
  const products = allProducts.filter((p) => outletNames.length === 0 || outletNames.includes(p.outlet))
  const [recipeProduct, setRecipeProduct] = useState(initialProductId ?? products[0]?.id ?? seed[0].id)
  const recipe = recipes[recipeProduct] ?? []
  const product = products.find((p) => p.id === recipeProduct)
  const cost = product ? calculateRecipeCost(product, recipes, inventory.stock) : null
  const issues = getRecipeMappingIssues(products, recipes, inventory.stock)

  const saveRecipe = (productId: string, ingredients: RecipeIngredient[]) => setRecipes({ ...recipes, [productId]: ingredients })
  const patch = (index: number, change: Partial<RecipeIngredient>) => saveRecipe(recipeProduct, recipe.map((x, i) => (i === index ? { ...x, ...change } : x)))

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card title="Recipe (bill of materials)">
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Menu item
            <select value={recipeProduct} onChange={(e) => setRecipeProduct(e.target.value)} className="mt-1.5 w-full max-w-lg rounded-lg border border-black/10 bg-white px-3 py-2.5 font-normal">
              {products.map((p) => <option key={p.id} value={p.id}>{p.outlet} · {p.name}</option>)}
            </select>
          </label>
          {!products.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Add menu items first.</p>}

          <div className="space-y-3">
            {recipe.map((ingredient, index) => (
              <div key={`${recipeProduct}-${index}`} className="grid grid-cols-2 gap-2 rounded-lg border border-black/5 p-2 sm:grid-cols-[minmax(0,1fr)_90px_80px_80px_80px_auto] sm:border-0 sm:p-0">
                <label className="col-span-2 text-xs font-semibold text-ink/60 sm:col-span-1">
                  Inventory item
                  <select value={ingredient.stockId} onChange={(e) => { const selected = inventory.stock.find((item) => item.id === e.target.value); patch(index, { stockId: e.target.value, unit: selected?.unit ?? ingredient.unit }) }} className={small}>
                    <option value="">Choose stock item…</option>
                    {inventory.stock.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.onHand} {item.unit}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink/60">Qty<input type="number" min="0.001" step="0.001" value={ingredient.qty} onChange={(e) => patch(index, { qty: Number(e.target.value) })} className={small} /></label>
                <label className="text-xs font-semibold text-ink/60">Unit
                  <select value={ingredient.unit || inventory.stock.find((item) => item.id === ingredient.stockId)?.unit || 'piece'} onChange={(e) => patch(index, { unit: e.target.value })} className={small}>
                    {['g', 'kg', 'ml', 'l', 'piece', 'bottle', 'can'].map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink/60">Yield %<input type="number" min="1" max="100" step="1" value={ingredient.yieldPercent ?? 100} onChange={(e) => patch(index, { yieldPercent: Number(e.target.value) })} className={small} /></label>
                <label className="text-xs font-semibold text-ink/60">Waste %<input type="number" min="0" max="99.99" step="0.1" value={ingredient.wastePercent ?? 0} onChange={(e) => patch(index, { wastePercent: Number(e.target.value) })} className={small} /></label>
                <button onClick={() => saveRecipe(recipeProduct, recipe.filter((_, i) => i !== index))} className="col-span-2 self-end rounded-lg border border-black/10 px-3 py-2 text-sm sm:col-span-1">Remove</button>
              </div>
            ))}
          </div>

          {!inventory.stock.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No inventory items yet.</p>}
          {validateRecipe(recipe, inventory.stock).map((issue, index) => <p key={`${recipeProduct}-validation-${index}`} className="text-sm text-red-700">{issue}</p>)}
          {!recipe.length && product?.trackStock !== false && <p className="text-sm text-amber-800">No recipe: checkout of this item is blocked.</p>}

          <div className="flex flex-wrap gap-2">
            <button disabled={!inventory.stock.length || !products.length} onClick={() => saveRecipe(recipeProduct, [...recipe, { stockId: inventory.stock[0].id, qty: 1, unit: inventory.stock[0].unit }])} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">+ Add ingredient</button>
            <button disabled={!products.length} onClick={() => { saveRecipe(recipeProduct, []); onNotice('Recipe cleared. Sales of this item are blocked until a new recipe is configured.') }} className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold disabled:opacity-40">Clear recipe</button>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <Card title="Costing">
          {!product || !cost ? (
            <p className="text-sm text-amber-800">Map every ingredient to see the cost.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="flex justify-between"><span>Cost per portion</span><strong>{cash(cost.costPerPortion)}</strong></p>
              <p className="flex justify-between"><span>Selling price</span><strong>{cash(cost.sellingPrice)}</strong></p>
              <p className="flex justify-between"><span>Gross profit</span><strong className={cost.grossProfit < 0 ? 'text-red-700' : ''}>{cash(cost.grossProfit)}</strong></p>
              <p className="flex justify-between"><span>Margin</span><strong>{cost.marginPercent.toFixed(1)}%</strong></p>
              <p className="flex justify-between"><span>Food cost</span><strong className={cost.foodCostPercent > foodCostThreshold ? 'text-amber-700' : ''}>{cost.foodCostPercent.toFixed(1)}%</strong></p>
              {cost.foodCostPercent > foodCostThreshold && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">Above the {foodCostThreshold}% target.</p>}
            </div>
          )}
          <div className="mt-4 space-y-2 border-t border-black/5 pt-3 text-sm">
            <label className="flex items-center justify-between gap-2">Food-cost target (%)
              <input type="number" min="1" max="100" value={foodCostThreshold} onChange={(e) => setFoodCostThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 35)))} className="w-20 rounded-lg border border-black/10 px-2 py-1" />
            </label>
            <label className="flex items-center justify-between gap-2">Low-portion alert
              <input type="number" min="1" max="100" value={lowPortionThreshold} onChange={(e) => setLowPortionThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 5)))} className="w-20 rounded-lg border border-black/10 px-2 py-1" />
            </label>
          </div>
        </Card>
        <Card title="Recipe health" count={issues.length}>
          <div className="space-y-2">
            {issues.length === 0
              ? <p className="text-sm text-emerald-700">All tracked items have valid recipes.</p>
              : issues.map((issue, index) => (
                <button key={`${issue.productId}-${index}`} onClick={() => setRecipeProduct(issue.productId)} className="block w-full rounded-lg bg-amber-50 p-2 text-left text-sm text-amber-900">
                  <strong>{issue.productName}:</strong> {issue.issue}
                </button>
              ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
