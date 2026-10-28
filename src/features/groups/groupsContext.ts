import { createContext, useContext } from 'react'
import type { GroupBlock, GroupStatus } from '../../lib/groups'

export type NewBlock = Omit<GroupBlock, 'id' | 'code' | 'status' | 'at' | 'by'> & { code?: string }

export interface GroupsValue {
  blocks: GroupBlock[]
  byId: (id: string | undefined) => GroupBlock | undefined
  /** Hold the rooms. Every room in the block becomes an ordinary booking, named or not. */
  create: (input: NewBlock, by: string) => GroupBlock
  update: (id: string, patch: Partial<GroupBlock>) => void
  setStatus: (id: string, status: GroupStatus) => void
}

export const GroupsContext = createContext<GroupsValue | null>(null)

export function useGroups(): GroupsValue {
  const v = useContext(GroupsContext)
  if (!v) throw new Error('useGroups must be used inside GroupsProvider')
  return v
}
