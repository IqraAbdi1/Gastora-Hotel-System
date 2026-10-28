import { useState } from 'react'
import { Card } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useRequests } from '../procurement/requestsContext'
import { BASE_PRODUCTS, EXTRA_PRODUCTS } from './posSeed'
import { POS_STORAGE_KEYS } from './posTypes'
import type { Outlet, Product, Recipes } from './posTypes'
import { calculateAvailability } from './recipeEngine'

const seed = [...BASE_PRODUCTS, ...EXTRA_PRODUCTS]
const field = 'mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-normal'

export default function MenuManagement({
  outletNames,
  cartProductIds,
  onNotice,
}: {
  outletNames: string[]
  cartProductIds: string[]
  onNotice: (text: string) => void
}) {
  const inventory = useRequests()
  const [products, setProducts] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const [recipes, setRecipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const [newMenuOutlet, setNewMenuOutlet] = useState<Outlet>(outletNames[0] ?? 'Restaurant')
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuCategory, setNewMenuCategory] = useState('Main dishes')
  const [newMenuPrice, setNewMenuPrice] = useState('')
  const [newMenuUnit, setNewMenuUnit] = useState('portion')
  const [newMenuEmoji, setNewMenuEmoji] = useState('🍽️')
  const [outletFilter, setOutletFilter] = useState('All outlets')

  const availability = (product: Product) => calculateAvailability(product, recipes, inventory.stock, inventory.stockOf)
  const shown = products.filter((p) => (outletNames.length === 0 || outletNames.includes(p.outlet)) && (outletFilter === 'All outlets' || p.outlet === outletFilter))

  function addMenuItem() {
    const price = Number(newMenuPrice)
    if (!newMenuName.trim() || !newMenuCategory.trim() || !Number.isFinite(price) || price <= 0) {
      onNotice('Enter a menu item name, category, and price greater than zero.')
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
    setProducts((old) => [...old, item])
    setNewMenuName('')
    setNewMenuPrice('')
    onNotice(`${item.name} added to the ${newMenuOutlet} menu. Configure its recipe before sale.`)
  }

  function updateMenuPrice(id: string, value: string) {
    const price = Number(value)
    if (Number.isFinite(price) && price > 0) setProducts((old) => old.map((item) => (item.id === id ? { ...item, price } : item)))
  }

  return (
    <div className="space-y-5">
      <Card title="Add a menu item">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">Item name<input value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} placeholder="e.g. Grilled tilapia" className={field} /></label>
          <label className="text-sm font-medium">Outlet<select value={newMenuOutlet} onChange={(e) => setNewMenuOutlet(e.target.value)} className={field}>{(outletNames.length ? outletNames : ['Restaurant', 'Bar']).map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="text-sm font-medium">Category<input value={newMenuCategory} onChange={(e) => setNewMenuCategory(e.target.value)} placeholder="Main dishes" className={field} /></label>
          <label className="text-sm font-medium">Price (UGX)<input type="number" min="1" value={newMenuPrice} onChange={(e) => setNewMenuPrice(e.target.value)} placeholder="25000" className={field} /></label>
          <label className="text-sm font-medium">Unit<input value={newMenuUnit} onChange={(e) => setNewMenuUnit(e.target.value)} placeholder="plate, glass, bottle…" className={field} /></label>
          <label className="text-sm font-medium">Emoji / icon<input value={newMenuEmoji} onChange={(e) => setNewMenuEmoji(e.target.value)} maxLength={8} className={field} /></label>
          <div className="flex items-end sm:col-span-2"><button onClick={addMenuItem} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Add menu item</button></div>
        </div>
      </Card>

      <Card
        title="Menu"
        count={shown.length}
        padded={false}
        actions={outletNames.length > 1 ? (
          <select aria-label="Filter by outlet" value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm">
            <option>All outlets</option>
            {outletNames.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas/70"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Outlet</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Price (UGX)</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Live portions</th><th className="px-3 py-2">Availability</th><th className="px-3 py-2">Stock tracking</th><th className="px-3 py-2">Action</th></tr></thead>
            <tbody>
              {shown.map((item) => {
                const avail = availability(item)
                return (
                  <tr key={`${item.id}-${item.price}`} className="border-t border-black/5">
                    <td className="whitespace-nowrap px-3 py-2">{item.emoji} {item.name}</td>
                    <td className="px-3 py-2">{item.outlet}</td>
                    <td className="px-3 py-2">{item.category}</td>
                    <td className="px-3 py-2"><input type="number" min="1" defaultValue={item.price} onBlur={(e) => updateMenuPrice(item.id, e.target.value)} aria-label={`Price for ${item.name}`} className="w-28 rounded-md border border-black/10 px-2 py-1" /></td>
                    <td className="px-3 py-2">{item.unit}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {item.trackStock === false ? 'Untracked' : (recipes[item.id]?.length ?? 0) === 0 ? 'Recipe needed' : avail.portions <= 0 ? <span className="font-semibold text-red-700">Sold out (86)</span> : <span>{avail.portions} available{avail.limitingIngredient ? ` · ${avail.limitingIngredient}` : ''}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => { setProducts((old) => old.map((product) => (product.id === item.id ? { ...product, available: product.available === false } : product))); onNotice(`${item.name} marked ${item.available === false ? 'available' : 'unavailable'}.`) }} className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${item.available === false ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                        {item.available === false ? 'Unavailable · Enable' : 'Available · Disable'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => {
                        setProducts((old) => old.map((product) => (product.id === item.id ? { ...product, trackStock: product.trackStock === false } : product)))
                        onNotice(`${item.name}: inventory tracking ${item.trackStock === false ? 'enabled' : 'disabled'}. ${item.trackStock === false ? 'Configure a valid recipe before selling.' : 'This item will not deduct inventory.'}`)
                      }} className="whitespace-nowrap rounded-md border border-black/10 px-2 py-1 text-xs">{item.trackStock === false ? 'Untracked · Enable' : 'Tracked · Disable'}</button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => {
                        if (cartProductIds.includes(item.id)) {
                          onNotice('Remove this item from the current order before removing it from the menu.')
                          return
                        }
                        setProducts((old) => old.filter((x) => x.id !== item.id))
                        setRecipes((old) => {
                          const next = { ...old }
                          delete next[item.id]
                          return next
                        })
                        onNotice(`${item.name} removed from the menu and its recipe cleared.`)
                      }} className="rounded-md border border-black/10 px-2 py-1 text-xs">Remove</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
