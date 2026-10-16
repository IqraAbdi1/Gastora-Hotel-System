import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, PageHeader, StatCard } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { frontDeskWaiting, lostFoundWaiting, sortWaiting } from '../../lib/waiting'
import type { WaitItem } from '../../lib/waiting'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { useLostFound } from '../lostfound/lostFoundContext'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'

const TONE = { bad: 'bad', warn: 'warn', info: 'info' } as const

function Row({ item }: { item: WaitItem }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink/10 bg-surface p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink">{item.title}</p>
          <Badge tone={TONE[item.severity]}>{item.kind === 'approve' ? 'Needs approval' : 'To review'}</Badge>
          <span className="text-xs text-ink/50">{item.area}</span>
        </div>
        <p className="mt-0.5 text-sm text-ink/70">{item.detail}</p>
        {item.age !== undefined && item.age > 0 && (
          <p className="mt-0.5 text-xs text-ink/50">Waiting {item.age} day{item.age === 1 ? '' : 's'}.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {item.amount ? <span className="font-semibold tabular-nums text-ink">{ugx(item.amount)}</span> : null}
        <Link to={item.to}>
          <Button size="sm" variant="secondary">
            {item.action}
          </Button>
        </Link>
      </div>
    </li>
  )
}

/**
 * One list of everything sitting on this person's desk, from every module.
 * A requisition lives in Procurement and a credit decision lives in Companies, but the person
 * approving them should not have to remember that.
 */
export default function WaitingPage() {
  const { reservations, rooms } = useHotel()
  const { accounts } = useCorporate()
  const { items } = useLostFound()
  const { options, features } = useFeatures()
  const { requests, needsMe, losses, lossLimit } = useRequests()
  const { can, role } = useAuth()

  const supplies = useMemo<WaitItem[]>(() => {
    if (!features.requests) return []
    return requests
      .filter((r) => needsMe(r))
      .map((r) => ({
        id: `req-${r.id}`,
        kind: 'approve' as const,
        area: 'Supplies' as const,
        title: `${r.department}: ${r.items.map((i) => i.name).slice(0, 2).join(', ')}${r.items.length > 2 ? ` and ${r.items.length - 2} more` : ''}`,
        detail: `Raised by ${r.requester}, ${r.urgency.toLowerCase()}. Now at "${r.status}".`,
        severity: 'warn' as const,
        to: '/procurement/requests',
        action: 'Open the request',
      }))
  }, [requests, needsMe, features.requests])

  // Write-offs above the hotel's limit wait for the general manager.
  const writeOffs = useMemo<WaitItem[]>(() => {
    if (!features.lossReports || lossLimit <= 0 || !can('approveRequest')) return []
    const big = losses.filter((l) => l.qty * l.unitCost > lossLimit)
    if (big.length === 0) return []
    return [
      {
        id: 'write-offs',
        kind: 'review',
        area: 'Stock',
        title: `${big.length} write-off${big.length === 1 ? '' : 's'} above your limit`,
        detail: `Over ${ugx(lossLimit)} each. Check them and dispute any that look wrong.`,
        amount: big.reduce((n, l) => n + l.qty * l.unitCost, 0),
        severity: 'warn',
        to: '/inventory/losses',
        action: 'Open write-offs',
      },
    ]
  }, [losses, lossLimit, features.lossReports, can])

  const desk = useMemo(
    () => (can('manageCorporate') || can('changeSettings') || can('approveRequest') ? frontDeskWaiting(reservations, rooms, accounts, TODAY) : []),
    [reservations, rooms, accounts, can],
  )
  const lost = useMemo(() => lostFoundWaiting(items, options.keepFoundDays, TODAY), [items, options.keepFoundDays])

  const all = sortWaiting([...supplies, ...writeOffs, ...desk, ...lost])
  const toApprove = all.filter((i) => i.kind === 'approve')
  const toReview = all.filter((i) => i.kind === 'review')
  const money = all.reduce((n, i) => n + (i.amount ?? 0), 0)
  const oldest = all.reduce((n, i) => Math.max(n, i.age ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title="Waiting for me"
        description={`Everything across the hotel that needs ${role ? role.label.toLowerCase() : 'you'} to decide, in one list.`}
        meta={<Badge tone={all.length === 0 ? 'good' : 'warn'}>{all.length === 0 ? 'Nothing waiting' : `${all.length} open`}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Needs approval" icon="check" value={toApprove.length} hint="Nothing moves until you act" tone={toApprove.length > 0 ? 'warn' : 'good'} />
        <StatCard label="To review" icon="alert" value={toReview.length} hint="Already done, worth a look" />
        <StatCard label="Money involved" icon="money" value={ugx(money)} hint="Across these items" />
        <StatCard label="Longest wait" icon="calendar" value={oldest > 0 ? `${oldest} days` : '—'} hint="The oldest item here" tone={oldest > 7 ? 'bad' : 'default'} />
      </div>

      <Card title="Needs your approval" icon="check" count={toApprove.length} padded description="Nothing happens on these until someone decides.">
        {toApprove.length === 0 ? (
          <p className="text-sm text-ink/55">Nothing is waiting on you.</p>
        ) : (
          <ul className="space-y-2">
            {toApprove.map((i) => (
              <Row key={i.id} item={i} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Worth a look" icon="alert" count={toReview.length} padded description="Already done, but somebody should see it.">
        {toReview.length === 0 ? (
          <p className="text-sm text-ink/55">Nothing to review.</p>
        ) : (
          <ul className="space-y-2">
            {toReview.map((i) => (
              <Row key={i.id} item={i} />
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-ink/50">
        Gathered from supplies, stock, companies, the front desk and lost property. Each line opens the page that can finish
        it. Approvals already given are listed separately, for the owner and finance.
      </p>
    </div>
  )
}
