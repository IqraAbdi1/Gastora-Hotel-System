import { useAuth } from '../features/auth/authContext'
import { useCorporate } from '../features/corporate/corporateContext'
import { useHousekeeping } from '../features/housekeeping/hkContext'
import { useRequests } from '../features/procurement/requestsContext'
import { canSignStep, missingSteps } from '../lib/corporate'

export type BadgeKind =
  | 'toClean'
  | 'openTasks'
  | 'toInspect'
  | 'issues'
  | 'workOrders'
  | 'requests'
  | 'storeRequests'
  | 'financeRequests'
  | 'losses'
  | 'companies'

export default function NavBadge({ kind }: { kind: BadgeKind }) {
  const { counts, allDefects } = useHousekeeping()
  const { waitingIn, losses } = useRequests()
  const { can, role, user } = useAuth()
  const { accounts } = useCorporate()

  let value: number
  if (kind === 'workOrders') {
    value = allDefects.filter((d) => d.defect.status !== 'Open' && d.defect.status !== 'Resolved').length
  } else if (kind === 'requests') {
    value = waitingIn('purchasing')
  } else if (kind === 'storeRequests') {
    value = waitingIn('store')
  } else if (kind === 'financeRequests') {
    value = waitingIn('finance')
  } else if (kind === 'companies') {
    // Accounts waiting for an approval this person can give.
    value = role
      ? accounts.filter(
          (a) =>
            a.status === 'pending' &&
            !a.approvals.some((x) => x.by.id === user?.id) &&
            missingSteps(a).some((s) => canSignStep(role.id, s)),
        ).length
      : 0
  } else if (kind === 'losses') {
    // Only the people who approve write-offs see a count.
    value = can('approveRequest') ? losses.filter((l) => l.status === 'Waiting approval').length : 0
  } else {
    value = counts[kind]
  }

  if (value <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
      {value > 99 ? '99+' : value}
    </span>
  )
}