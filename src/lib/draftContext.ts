import { createContext, useContext } from 'react'
import type { DraftAction } from '../types'

type DraftContextValue = { openDraft: (draft: DraftAction) => void }

export const DraftContext = createContext<DraftContextValue>({ openDraft: () => {} })

export function useDraft() {
  return useContext(DraftContext)
}