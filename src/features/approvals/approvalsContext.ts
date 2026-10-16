import { createContext, useContext } from 'react'
import type { ApprovalRecord } from '../../lib/approvals'

export interface ApprovalsValue {
  records: ApprovalRecord[]
  record: (input: Omit<ApprovalRecord, 'id' | 'at'>) => void
}

export const ApprovalsContext = createContext<ApprovalsValue | null>(null)

export function useApprovals(): ApprovalsValue {
  const v = useContext(ApprovalsContext)
  if (!v) throw new Error('useApprovals must be used inside ApprovalsProvider')
  return v
}
