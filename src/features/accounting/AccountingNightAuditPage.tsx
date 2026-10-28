import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Tabs,
  Textarea,
  buttonClass,
} from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { noShowsAtClose, ran } from '../../lib/dayRun'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { auditReport } from '../../lib/nightAudit'
import { USERS, roleById } from '../../lib/roles'
import { nowTime } from '../../lib/stayTimes'
import { applyRules } from '../../services/accounting/posting'
import type { BusinessDate, NightAudit } from '../../services/accounting/accountingTypes'
import { useAuth } from '../auth/authContext'
import FolioPanel from '../frontdesk/FolioPanel'
import ReservationPanel from '../frontdesk/ReservationPanel'
import { useFeatures } from '../platform/featuresContext'
import TransferDialog from './TransferDialog'
import { ErrorNote, JournalBadge, Notice } from './accountingUi'
import { stampOf, useRun } from './accountingHelpers'
import { EXCEPTION_LABEL, auditChecks } from './daySource'
import type { LiveException } from './daySource'
import { useAccounting } from './useAccounting'
import { useDay } from './useDay'

type Tab = 'close' | 'history'
type Row = LiveException & { waived: boolean; note?: string }

// End of day for the accounts: check, post, roll the date, and reopen a closed day under control.
// The front desk's own audit (/desk/night-audit) stays as it is; closing here records it too.
export default function AccountingNightAuditPage() {
  const acc = useAccounting()
  const { reservations, rooms, auditRuns, closeDay } = useHotel()
  const { features, tenant } = useFeatures()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('close')
  const [waiving, setWaiving] = useState<Row | null>(null)
  const [transferFor, setTransferFor] = useState<string | null>(null)
  const [openRes, setOpenRes] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [reopening, setReopening] = useState<BusinessDate | null>(null)
  const [detail, setDetail] = useState<NightAudit | null>(null)
  const [closedMsg, setClosedMsg] = useState<string | null>(null)
  const close = useRun()

  const date = acc.businessDate
  const day = useDay(date, acc.transfers)
  const report = useMemo(() => auditReport(reservations, rooms, date || TODAY), [reservations, rooms, date])

  const waivers = acc.exceptions.filter((e) => e.businessDate === date && e.status === 'waived')
  const rows: Row[] = day.exceptions.map((e) => {
    const w = waivers.find((x) => x.key === e.key)
    return { ...e, waived: !!w, note: w?.note }
  })
  const posting = applyRules(day.source, acc.codes, acc.rules, acc.chart)
  const ratesToday = acc.rates.filter((r) => r.rateDate === date).map((r) => r.currencyCode)
  const checks = auditChecks({
    exceptions: rows,
    postingErrors: posting.errors,
    balanced: posting.totalDebit === posting.totalCredit,
    hasLines: posting.lines.length > 0,
    ratesMissing: features.multiCurrency ? acc.currencies.filter((c) => c.active && !c.isBase && !ratesToday.includes(c.code)).map((c) => c.code) : null,
    previousRejected: acc.batches.filter((b) => b.status === 'rejected').length,
    frontDeskDone: !!ran(auditRuns, date),
  })
  const blockers = checks.filter((c) => c.required && !c.passed)
  const ready = blockers.length === 0
  const openCount = rows.filter((r) => !r.waived).length

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  async function doClose() {
    const ok = await close.run(async () => {
      await acc.service.closeDay(
        acc.propertyId,
        {
          businessDate: date,
          checks,
          exceptions: rows.map(({ key, kind, severity, reference, description, amount }) => ({ key, kind, severity, reference, description, amount })),
          source: day.source,
          roomRevenue: day.roomRevenue,
          totalRevenue: day.totalRevenue,
        },
        acc.need(),
      )
      // The front desk's record of the day, and its no-shows, as the desk's own close would leave them.
      if (!ran(auditRuns, date))
        closeDay({
          date,
          at: nowTime(),
          by: user?.name ?? 'Accounts',
          auto: false,
          inHouse: report.inHouse,
          arrivals: report.arrivals,
          departures: report.departures,
          owed: report.owed,
          noShows: noShowsAtClose(reservations, date).map((x) => x.id),
          open: report.items.filter((i) => i.kind !== 'not-arrived').length,
        })
    })
    setConfirmClose(false)
    if (ok) setClosedMsg(`${dayMonth(date)} closed. The journal is ready to send, and the business date has rolled.`)
  }

  const exceptionCols: Column<Row>[] = [
    {
      key: 'kind',
      header: 'Type',
      hideBelow: 'sm',
      cell: (r) => <Badge tone={r.waived ? 'neutral' : r.severity === 'block' ? 'bad' : 'warn'}>{EXCEPTION_LABEL[r.kind]}</Badge>,
    },
    {
      key: 'what',
      header: 'Detail',
      cell: (r) => (
        <div className="min-w-[10rem] max-w-[22rem] whitespace-normal">
          <p className="mb-1 sm:hidden">
            <Badge tone={r.waived ? 'neutral' : r.severity === 'block' ? 'bad' : 'warn'}>{EXCEPTION_LABEL[r.kind]}</Badge>
          </p>
          <p className="text-ink">{r.description}</p>
          {r.waived && <p className="text-xs text-ink/55">Accepted: {r.note}</p>}
        </div>
      ),
    },
    { key: 'amt', header: 'Amount', align: 'right', hideBelow: 'sm', cell: (r) => (r.amount ? <span className="tabular-nums">{ugx(r.amount)}</span> : null) },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end">
          {r.reservationId && (
            <Button size="sm" variant="ghost" onClick={() => setOpenRes(r.reservationId!)}>
              Open
            </Button>
          )}
          {r.kind === 'unbalanced-folio' && (r.amount ?? 0) > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setTransferFor(r.reservationId!)}>
              To city ledger
            </Button>
          )}
          {r.severity === 'warn' && !r.waived && (
            <Button size="sm" variant="ghost" onClick={() => setWaiving(r)}>
              Accept
            </Button>
          )}
        </div>
      ),
    },
  ]

  const history = [...acc.dates].sort((a, b) => b.businessDate.localeCompare(a.businessDate))
  const lastClosed = history.find((d) => d.status === 'closed')
  const auditFor = (d: string) => [...acc.audits].filter((a) => a.businessDate === d).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]
  const batchFor = (d: string) => [...acc.batches].filter((b) => b.businessDate === d).sort((a, b) => b.revision - a.revision)[0]

  const historyCols: Column<BusinessDate>[] = [
    { key: 'date', header: 'Business date', cell: (d) => <span className="font-medium">{dayMonth(d.businessDate)}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => <Badge tone={d.status === 'closed' ? 'good' : d.status === 'reopened' ? 'warn' : 'brand'}>{d.status === 'closed' ? 'Closed' : d.status === 'reopened' ? 'Reopened' : 'Open'}</Badge>,
    },
    { key: 'by', header: 'Closed by', hideBelow: 'md', cell: (d) => (d.closedBy ? `${d.closedBy.name}, ${stampOf(d.closedAt!)}` : '') },
    { key: 'rev', header: 'Revenue', align: 'right', hideBelow: 'sm', cell: (d) => { const a = auditFor(d.businessDate); return a && d.status === 'closed' ? <span className="tabular-nums">{ugx(a.totalRevenue)}</span> : null } },
    { key: 'jb', header: 'Journal', hideBelow: 'sm', cell: (d) => { const b = batchFor(d.businessDate); return b ? <JournalBadge status={b.status} /> : null } },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (d) =>
        d.id === lastClosed?.id && acc.businessStatus !== 'reopened' ? (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setReopening(d) }}>
            Reopen
          </Button>
        ) : null,
    },
  ]

  const res = openRes ? reservations.find((r) => r.id === openRes) : undefined

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accounting"
        title="Night audit"
        description={`${tenant.name}. Check, post and roll ${dayMonth(date)}.`}
        meta={<Badge tone={ready ? 'good' : 'bad'}>{ready ? 'Ready to close' : `${blockers.length} blocking`}</Badge>}
        actions={
          <Link to="/desk/night-audit" className={buttonClass('ghost', 'md')}>
            Front desk audit
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Business date" icon="calendar" value={dayMonth(date)} hint={acc.businessStatus === 'reopened' ? 'Reopened' : 'Open'} tone={acc.businessStatus === 'reopened' ? 'warn' : 'default'} />
        <StatCard label="In house tonight" icon="guests" value={report.inHouse} hint={`${report.occupied} of ${report.sellable} rooms`} />
        <StatCard label="Revenue today" icon="money" value={ugx(day.totalRevenue)} hint={`Rooms ${ugx(day.roomRevenue)}`} />
        <StatCard label="Exceptions" icon="alert" value={openCount} hint={`${rows.length - openCount} accepted`} tone={rows.some((r) => r.severity === 'block') ? 'bad' : openCount ? 'warn' : 'good'} />
      </div>

      <Tabs<Tab>
        label="Night audit"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'close', label: 'Close the day', alert: !ready },
          { key: 'history', label: 'Closed days', count: acc.audits.length },
        ]}
      />

      {closedMsg && <Notice>{closedMsg}</Notice>}

      {tab === 'close' && (
        <>
          <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card title="Validation" icon="check" padded={false}>
              <ul className="divide-y divide-ink/8">
                {checks.map((c) => (
                  <li key={c.key} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.passed ? 'bg-good' : c.required ? 'bg-bad' : 'bg-warn'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{c.label}</span>
                        <span className="block text-xs text-ink/55">{c.detail}</span>
                      </span>
                    </span>
                    <Badge tone={c.passed ? 'good' : c.required ? 'bad' : 'warn'}>{c.passed ? 'OK' : c.required ? 'Required' : 'Check'}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Exceptions" icon="alert" count={rows.length} padded={false}>
              <DataTable columns={exceptionCols} rows={rows} rowKey={(r) => r.key} empty={{ title: 'No exceptions', hint: 'Folios, rooms and POS agree.' }} />
            </Card>
          </div>

          <Card title={`Close ${dayMonth(date)}`} icon="calendar">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-ink/55">Journal lines</dt>
                  <dd className="font-semibold tabular-nums">{posting.lines.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/55">Debits</dt>
                  <dd className="font-semibold tabular-nums">{ugx(posting.totalDebit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/55">Next date</dt>
                  <dd className="font-semibold">{date ? dayMonth(new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) : ''}</dd>
                </div>
              </dl>
              <Button disabled={!ready || close.busy || !acc.actor} onClick={() => setConfirmClose(true)}>
                Close day and roll date
              </Button>
            </div>
            {!ready && <p className="mt-2 text-xs text-bad">Clear: {blockers.map((b) => b.label).join(', ')}.</p>}
            <div className="mt-2">
              <ErrorNote>{close.error}</ErrorNote>
            </div>
          </Card>
        </>
      )}

      {tab === 'history' && (
        <Card title="Business dates" icon="calendar" padded={false}>
          <DataTable
            columns={historyCols}
            rows={history}
            rowKey={(d) => d.id}
            onRowClick={(d) => {
              const a = auditFor(d.businessDate)
              if (a) setDetail(a)
            }}
          />
        </Card>
      )}

      {confirmClose && (
        <ConfirmDialog
          title={`Close ${dayMonth(date)}?`}
          message={
            <ul className="list-disc space-y-1 pl-5">
              <li>A journal of {posting.lines.length} lines ({ugx(posting.totalDebit)}) is built for Trademate.</li>
              <li>{rows.length} exception{rows.length === 1 ? '' : 's'} are recorded with the audit.</li>
              {report.items.some((i) => i.kind === 'not-arrived') && <li>Arrivals that never came become no-shows.</li>}
              <li>The business date rolls to the next day.</li>
            </ul>
          }
          confirmLabel={close.busy ? 'Closing…' : 'Close day'}
          onConfirm={doClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}

      {waiving && <WaiveDialog row={waiving} date={date} acc={acc} onClose={() => setWaiving(null)} />}
      {reopening && <ReopenDialog day={reopening} acc={acc} onClose={() => setReopening(null)} onDone={(msg) => { setReopening(null); setClosedMsg(msg); setTab('close') }} />}
      {transferFor && <TransferDialog acc={acc} reservationId={transferFor} onClose={() => setTransferFor(null)} />}
      {detail && <AuditDetail audit={detail} acc={acc} onClose={() => setDetail(null)} />}
      {res && (res.status === 'in-house' ? <FolioPanel reservation={res} onClose={() => setOpenRes(null)} /> : <ReservationPanel reservation={res} onClose={() => setOpenRes(null)} />)}
    </div>
  )
}

function WaiveDialog({ row, date, acc, onClose }: { row: Row; date: string; acc: ReturnType<typeof useAccounting>; onClose: () => void }) {
  const [note, setNote] = useState('')
  const { run, busy, error } = useRun()
  return (
    <Modal
      title="Accept this exception"
      description={row.description}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => acc.service.waiveException(acc.propertyId, date, row.key, note, acc.need()), onClose)}>
            Accept
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Why it can wait" required>
          {(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}

function ReopenDialog({ day, acc, onClose, onDone }: { day: BusinessDate; acc: ReturnType<typeof useAccounting>; onClose: () => void; onDone: (msg: string) => void }) {
  const approvers = USERS.filter((u) => ['owner', 'gm', 'finance'].includes(u.role) && u.id !== acc.actor?.id)
  const [reason, setReason] = useState('')
  const [approverId, setApproverId] = useState(approvers[0]?.id ?? '')
  const [confirming, setConfirming] = useState(false)
  const { run, busy, error, setError } = useRun()
  const approver = approvers.find((u) => u.id === approverId)
  const batch = [...acc.batches].filter((b) => b.businessDate === day.businessDate && b.status !== 'void').sort((a, b) => b.revision - a.revision)[0]

  return (
    <>
      <Modal
        title={`Reopen ${dayMonth(day.businessDate)}`}
        description="Needs a reason and a second person's approval. Both are logged."
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (reason.trim().length < 10) return setError('Give the reason in a sentence (at least 10 characters)')
                if (!approver) return setError('Pick who approved it')
                setError(null)
                setConfirming(true)
              }}
            >
              Reopen day
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reason" required>
            {(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: bar sales from table 6 were not posted" />}
          </Field>
          <Field label="Approved by" required hint="Owner, general manager or finance; not yourself">
            {(id) => (
              <Select id={id} value={approverId} onChange={(e) => setApproverId(e.target.value)}>
                {approvers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({roleById(u.role).label})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {batch && (batch.status === 'accepted' || batch.status === 'sent') && (
            <Notice tone="warn">Journal {batch.reference} is already in Trademate. Reopening asks Trademate to reverse it.</Notice>
          )}
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Modal>
      {confirming && approver && (
        <ConfirmDialog
          title="Reopen this day?"
          danger
          message={`${dayMonth(day.businessDate)} becomes the business date again, approved by ${approver.name}. Its journal is voided and rebuilt when the day closes again.`}
          confirmLabel={busy ? 'Reopening…' : 'Reopen'}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            const ok = await run(() =>
              acc.service.reopenDay(acc.propertyId, day.businessDate, reason, { id: approver.id, name: approver.name, role: approver.role }, acc.need()),
            )
            setConfirming(false)
            if (ok) onDone(`${dayMonth(day.businessDate)} reopened, approved by ${approver.name}.`)
          }}
        />
      )}
    </>
  )
}

function AuditDetail({ audit, acc, onClose }: { audit: NightAudit; acc: ReturnType<typeof useAccounting>; onClose: () => void }) {
  const exceptions = acc.exceptions.filter((e) => e.businessDate === audit.businessDate)
  return (
    <Modal title={`Night audit ${dayMonth(audit.businessDate)}`} description={`${audit.runBy.name}, ${stampOf(audit.finishedAt)}`} onClose={onClose} side>
      <div className="space-y-5 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-ink/55">Room revenue</dt>
            <dd className="font-semibold tabular-nums">{ugx(audit.roomRevenue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/55">All revenue</dt>
            <dd className="font-semibold tabular-nums">{ugx(audit.totalRevenue)}</dd>
          </div>
        </dl>
        {audit.checks.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Checks</h3>
            <ul className="space-y-1">
              {audit.checks.map((c) => (
                <li key={c.key} className="flex justify-between gap-2">
                  <span>{c.label}</span>
                  <Badge tone={c.passed ? 'good' : c.required ? 'bad' : 'warn'}>{c.passed ? 'OK' : c.detail}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Exceptions</h3>
          {exceptions.length === 0 ? (
            <p className="text-ink/55">None.</p>
          ) : (
            <ul className="space-y-2">
              {exceptions.map((e) => (
                <li key={e.id}>
                  <Badge tone={e.status === 'waived' ? 'neutral' : 'warn'}>{EXCEPTION_LABEL[e.kind]}</Badge> <span className="text-ink/80">{e.description}</span>
                  {e.note && <p className="text-xs text-ink/55">{e.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Log</h3>
          <ul className="space-y-2">
            {audit.events.map((e, i) => (
              <li key={i}>
                <p className="font-medium">{e.action}</p>
                <p className="text-xs text-ink/55">
                  {e.by.name}, {stampOf(e.at)}
                  {e.detail ? ` · ${e.detail}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  )
}
