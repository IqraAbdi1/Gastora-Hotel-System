import { Badge, Card, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import type { ApprovalRecord } from '../../lib/approvals'
import { ugx } from '../../lib/format'
import { useApprovals } from './approvalsContext'

// What a manager looks at once a day. Every charge cancelled and every valuable released, with the reason,
// who approved it and their photo. Nothing here can be edited or deleted.
export default function ApprovalsPage() {
  const { records } = useApprovals()

  const today = records.filter((r) => r.at.startsWith(TODAY))
  const reversals = records.filter((r) => r.kind === 'charge-reversal')
  const money = reversals.reduce((n, r) => n + (r.amount ?? 0), 0)
  const noPhoto = records.filter((r) => r.photoSkipped || r.approvers.every((a) => !a.photo)).length

  const columns: Column<ApprovalRecord>[] = [
    {
      key: 'what',
      header: 'What was approved',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.what}</p>
          <p className="text-xs text-ink/60">
            {r.kind === 'charge-reversal' ? 'Charge cancelled' : 'Valuable released'} · {r.at} · asked by {r.requestedBy}
          </p>
          <p className="text-xs text-ink/55">{r.reason}</p>
        </div>
      ),
    },
    {
      key: 'who',
      header: 'Approved by',
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          {r.approvers.map((a) => (
            <span key={a.name} className="flex items-center gap-1.5">
              {a.photo ? (
                <img src={a.photo} alt={a.name} className="h-9 w-12 rounded border border-ink/15 object-cover" />
              ) : (
                <span className="flex h-9 w-12 items-center justify-center rounded border border-dashed border-ink/25 text-[10px] text-ink/40">
                  No photo
                </span>
              )}
              <span className="text-xs font-medium text-ink">{a.name}</span>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => (r.amount ? <span className="tabular-nums">{ugx(r.amount)}</span> : null),
    },
    {
      key: 'flag',
      header: '',
      align: 'right',
      cell: (r) =>
        r.approvers.length > 1 ? (
          <Badge tone="info">Two signed</Badge>
        ) : r.photoSkipped || r.approvers.every((a) => !a.photo) ? (
          <Badge tone="warn">No photo</Badge>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Manager"
        title="Approvals to review"
        description="Money taken off folios and valuables released. Check the photo matches the name."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" icon="calendar" value={today.length} hint="Approvals so far" />
        <StatCard label="Charges cancelled" icon="money" value={reversals.length} hint={ugx(money)} tone={money > 0 ? 'warn' : 'default'} />
        <StatCard label="Valuables released" icon="check" value={records.filter((r) => r.kind === 'valuable-release').length} hint="From the safe" />
        <StatCard label="Without a photo" icon="alert" value={noPhoto} hint="Look at these first" tone={noPhoto > 0 ? 'bad' : 'good'} />
      </div>

      <Card title="Everything approved" icon="tasks" count={records.length} padded={false}>
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(r) => r.id}
          empty={{
            title: 'Nothing has been approved yet',
            hint: 'Cancelling a charge or releasing a valuable from the safe appears here.',
          }}
        />
      </Card>

      <p className="text-xs text-ink/55">
        Rule: if a photo is not the person whose PIN was used, the PIN was borrowed. Change that PIN and ask why.
      </p>
    </div>
  )
}
