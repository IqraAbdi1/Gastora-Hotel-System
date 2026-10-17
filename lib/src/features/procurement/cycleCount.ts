import type { StockCount, StockItem } from './requestsModel'

export type CountClass = 'A' | 'B' | 'C'

/** Rule: A items (top 20% by value on hand) monthly, B (next 30%) quarterly, C (the rest) twice a year. */
export const CLASS_DAYS: Record<CountClass, number> = { A: 30, B: 90, C: 180 }

/** Ranks items by value on hand and gives each a class. */
export function classify(stock: StockItem[]): Record<string, CountClass> {
  const ranked = [...stock].sort((a, b) => b.onHand * b.unitCost - a.onHand * a.unitCost)
  const aEnd = Math.ceil(ranked.length * 0.2)
  const bEnd = Math.ceil(ranked.length * 0.5)
  const out: Record<string, CountClass> = {}
  ranked.forEach((s, i) => {
    out[s.id] = i < aEnd ? 'A' : i < bEnd ? 'B' : 'C'
  })
  return out
}

export interface CountDue {
  item: StockItem
  cls: CountClass
  value: number
  /** When it was last counted and posted. Missing means never counted. */
  last?: string
  /** Days past its due date. 0 means due today. */
  daysOver: number
}

/** Items whose cycle count is due, class A first, then by value. */
export function dueForCount(
  stock: StockItem[],
  counts: StockCount[],
  days: Record<CountClass, number>,
  now = Date.now(),
): CountDue[] {
  const cls = classify(stock)
  const last = new Map<string, string>()
  for (const c of counts) {
    if (c.status !== 'Posted') continue
    const at = c.decidedAt ?? c.at
    for (const l of c.lines) {
      const prev = last.get(l.itemId)
      if (!prev || at > prev) last.set(l.itemId, at)
    }
  }
  return stock
    .map((item) => {
      const c = cls[item.id]
      const l = last.get(item.id)
      const age = l ? Math.floor((now - new Date(l).getTime()) / 86_400_000) : undefined
      return {
        item,
        cls: c,
        value: item.onHand * item.unitCost,
        last: l,
        daysOver: age === undefined ? 9999 : age - days[c],
      }
    })
    .filter((x) => x.daysOver >= 0)
    .sort((a, b) => a.cls.localeCompare(b.cls) || b.value - a.value)
}