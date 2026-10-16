import { createContext, useContext } from 'react'
import type { LostItem, NewLostItem } from '../../lib/lostFound'

export interface LostFoundValue {
  items: LostItem[]
  /** Housekeeping logs something they picked up. */
  addItem: (input: NewLostItem) => LostItem
  /** The item is handed over. The details are the hotel's proof it went to the right person. */
  releaseItem: (id: string, release: NonNullable<LostItem['release']>) => void
  disposeItem: (id: string, disposal: NonNullable<LostItem['disposal']>) => void
  updateItem: (id: string, patch: Partial<Pick<LostItem, 'storedAt' | 'notes'>>) => void
}

export const LostFoundContext = createContext<LostFoundValue | null>(null)

export function useLostFound(): LostFoundValue {
  const v = useContext(LostFoundContext)
  if (!v) throw new Error('useLostFound must be used inside LostFoundProvider')
  return v
}
