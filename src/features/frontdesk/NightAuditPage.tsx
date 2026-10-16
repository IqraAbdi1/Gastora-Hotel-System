import { useState } from 'react'
import { Badge, Button, Card, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import { auditReport } from '../../lib/nightAudit'
import type { AuditItem } from '../../lib/nightAudit'
import { useHotel } from '../../lib/hotelContext'
import { nowTime } from '../../lib/stayTimes'
import { useFeatures } from '../platform/featuresContext'
import FolioPanel from './FolioPanel'
import ReservationPanel from './ReservationPanel'

// The end-of-day check. The front desk clears every item, then runs the audit, which posts tonight's
// room charges and closes the day. Prototype: the business date is fixed sample data, so the run is recorded, not rolled.
export default function NightAuditPage() {
  const { reservations, rooms } = useHotel()
  const { tenant, stayTimes } = useFeatures()
  const [openId, setOpenId] = useState<string | null>(null)
  const [openFolio, setOpenFolio] = useState<string | null>(null)
  const [ranAt, setRanAt] = useState<string | null>(null)

  const report = auditReport(reservations, rooms, TODAY)
  const blockers = report.items.filter((i) => i.severity === 'bad')
  const ready = blockers.length === 0
  const open = openId ? reservations.find((r) => r.id === openId) : undefined
  const folio = openFolio ? reservations.find((r) => r.id === openFolio) : undefined

  const columns: Column<AuditItem>[] = [
    {
      key: 'what',
      header: 'To clear',
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{i.title}</p>
          <p className="text-xs text-ink/60">{i.detail}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Type',
      hideBelow: 'sm',
      cell: (i) => (
        <Badge tone={i.severity === 'bad' ? 'bad' : 'warn'}>{i.severity === 'bad' ? 'Must clear' : 'Check'}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (i) => (i.amount ? <span className="tabular-nums">{ugx(i.amount)}</span> : null),
    },
    {
      key: 'go',
      header: '',
      align: 'right',
      cell: (i) =>
        i.reservation ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              if (i.reservation!.status === 'in-house') setOpenFolio(i.reservation!.id)
              else setOpenId(i.reservation!.id)
            }}
          >
            Open
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Night audit"
        description={`${tenant.name}. The end-of-day check for ${TODAY}. Clear everything below, then close the day.`}
        meta={<Badge tone={ready ? 'good' : 'warn'}>{ready ? 'Ready to run' : `${blockers.length} to clear`}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In house tonight" icon="guests" value={report.inHouse} hint={`${report.occupied} of ${report.sellable} rooms`} />
        <StatCard label="Nights to post" icon="money" value={report.toPost.length} hint={ugx(report.postTotal)} />
        <StatCard label="Still owed" icon="alert" value={ugx(report.owed)} hint="Carried into tomorrow" tone={report.owed > 0 ? 'bad' : 'good'} />
        <StatCard label="Checked out today" icon="departure" value={report.departures} hint={`${report.arrivals} arrival${report.arrivals === 1 ? '' : 's'} not in yet`} />
      </div>

      <Card
        title="Before the audit runs"
        icon="alert"
        count={report.items.length}
        padded={false}
        description="Rules, not AI. Every red item has to be cleared; the others are a check."
      >
        <DataTable
          columns={columns}
          rows={report.items}
          rowKey={(i) => `${i.kind}-${i.reservation?.id ?? i.room}`}
          empty={{ title: 'Nothing to clear', hint: 'Every arrival, departure and room agrees with the folios.' }}
        />
      </Card>

      <Card title="Tonight's room charges" icon="money" count={report.toPost.length} padded>
        {report.toPost.length === 0 ? (
          <p className="text-sm text-ink/55">No stay goes on tonight, so there is nothing to post.</p>
        ) : (
          <>
            <dl className="space-y-2 text-sm">
              {report.toPost.map((x) => (
                <div key={x.reservation.id} className="flex justify-between gap-4">
                  <dt className="text-ink/70">
                    {x.reservation.guest}
                    <span className="block text-xs text-ink/50">
                      Room {x.reservation.room} · {x.reservation.roomType} · leaves {x.reservation.departure}
                    </span>
                  </dt>
                  <dd className="font-medium tabular-nums">{ugx(x.nightly)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
                <dt className="font-semibold">One night for each</dt>
                <dd className="font-bold tabular-nums">{ugx(report.postTotal)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink/55">
              In this prototype each stay's total already covers every night, so running the audit records the check rather
              than adding the charge again. In the real system the audit posts this to the ledger and rolls the business date.
            </p>
          </>
        )}
      </Card>

      <Card title="Close the day" icon="check" padded>
        {ranAt ? (
          <div className="rounded-lg border border-good/30 bg-good/10 p-3 text-sm">
            <p className="font-semibold text-good">Night audit done for {TODAY} at {ranAt}.</p>
            <p className="mt-1 text-xs text-ink/70">
              {report.toPost.length} night{report.toPost.length === 1 ? '' : 's'} checked, {ugx(report.postTotal)}. {ugx(report.owed)} is
              carried into tomorrow. Check-out tomorrow is {stayTimes.checkOutTime}.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink/70">
              {ready
                ? 'Everything agrees. Running the audit closes the day and posts tonight.'
                : `Clear the ${blockers.length} red item${blockers.length === 1 ? '' : 's'} above first. An arrival that never came must be checked in or recorded as a no-show.`}
            </p>
            <div className="mt-3">
              <Button disabled={!ready} onClick={() => setRanAt(nowTime())}>
                Run night audit for {TODAY}
              </Button>
            </div>
          </>
        )}
      </Card>

      {open && <ReservationPanel reservation={open} onClose={() => setOpenId(null)} />}
      {folio && <FolioPanel reservation={folio} onClose={() => setOpenFolio(null)} />}
    </div>
  )
}
