import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ApprovalRecord } from '../../lib/approvals'
import { stamp } from '../../lib/folio'
import { ApprovalsContext } from './approvalsContext'
import type { ApprovalsValue } from './approvalsContext'

// Every approval is kept so a manager can look back at the day. Nothing here can be edited or deleted.
export default function ApprovalsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ApprovalRecord[]>([])

  const record = useCallback((input: Omit<ApprovalRecord, 'id' | 'at'>) => {
    setRecords((list) => [{ ...input, id: `AP-${list.length + 1}`, at: stamp() }, ...list])
  }, [])

  const value = useMemo<ApprovalsValue>(() => ({ records, record }), [records, record])
  return <ApprovalsContext.Provider value={value}>{children}</ApprovalsContext.Provider>
}
