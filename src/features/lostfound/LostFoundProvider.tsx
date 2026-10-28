import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { lostItems } from '../../data/lostFound'
import type { LostItem, NewLostItem } from '../../lib/lostFound'
import { LostFoundContext } from './lostFoundContext'
import type { LostFoundValue } from './lostFoundContext'

// Lost and found lives above the app, so housekeeping and the front desk see the same list.
export default function LostFoundProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<LostItem[]>(lostItems)

  const addItem = useCallback((input: NewLostItem) => {
    const created: LostItem = { ...input, id: `LF-${Date.now().toString().slice(-6)}`, status: 'held' }
    setItems((list) => [created, ...list])
    return created
  }, [])

  const releaseItem = useCallback((id: string, release: NonNullable<LostItem['release']>) => {
    setItems((list) => list.map((i) => (i.id === id && i.status === 'held' ? { ...i, status: 'returned', release } : i)))
  }, [])

  const disposeItem = useCallback((id: string, disposal: NonNullable<LostItem['disposal']>) => {
    setItems((list) => list.map((i) => (i.id === id && i.status === 'held' ? { ...i, status: 'disposed', disposal } : i)))
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<Pick<LostItem, 'storedAt' | 'notes'>>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  const value = useMemo<LostFoundValue>(
    () => ({ items, addItem, releaseItem, disposeItem, updateItem }),
    [items, addItem, releaseItem, disposeItem, updateItem],
  )
  return <LostFoundContext.Provider value={value}>{children}</LostFoundContext.Provider>
}
