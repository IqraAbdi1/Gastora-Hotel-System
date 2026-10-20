import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, DataTable, PageHeader, Segmented, StatCard, buttonClass } from '../../components/ui'
import { dateTime } from '../../lib/format'
import { monthPeriod, previousPeriod, round2 } from '../../lib/workforce'
import { workforceService } from '../../services'
import type { ExportStatus, PayrollExportLine, Timesheet } from '../../services/workforce/workforceTypes'
import { useAction, useWorkforce } from './useWorkforce'
import { hoursText, shortDay } from './workforceFormat'
import { ErrorNote, Loaded } from './workforceUi'

type Line = PayrollExportLine & { linked: boolean; approved: boolean }

const EXPORT_TONE: Record<ExportStatus, 'neutral' | 'info' | 'good' | 'bad'> = { draft: 'neutral', sent: 'info', acknowledged: 'good', failed: 'bad' }
const EXPORT_LABEL: Record<ExportStatus, string> = { draft: 'Not sent', sent: 'Sent, waiting for Trademate', acknowledged: 'Received by Trademate', failed: 'Failed' }

export default function PayrollHandoffPage() {
  const wf = useWorkforce()
  const { data } = wf
  const current = monthPeriod(wf.today)
  const [which, setWhich] = useState<'current' | 'previous'>('current')
  const period = which === 'current' ? current : previousPeriod(current)
  const [sheets, setSheets] = useState<Timesheet[]>([])
  const [confirming, setConfirming] = useState(false)
  const { run, busy, error } = useAction()

  useEffect(() => {
    let live = true
    workforceService.listTimesheets(wf.propertyId, period, Date.now()).then((s) => live && setSheets(s))
    return () => {
      live = false
    }
  }, [wf.data, wf.propertyId, period.start, period.end]) // eslint-disable-line react-hooks/exhaustive-deps

  const sent = data?.exports.find((x) => x.periodStart === period.start && x.status !== 'failed')
  const live: Line[] = sheets
    .filter((t) => t.workedHours + t.overtimeHours > 0 || t.absentDays > 0)
    .map((t) => {
      const link = data?.links.find((l) => l.userId === t.userId)
      return {
        userId: t.userId,
        trademateEmployeeId: link?.trademateEmployeeId ?? '',
        fullName: wf.name(t.userId),
        regularHours: t.workedHours,
        overtimeHours: t.overtimeHours,
        nightHours: t.nightHours,
        absentDays: t.absentDays,
        lateCount: t.lateCount,
        linked: !!link,
        approved: t.status === 'approved',
      }
    })
  const lines: Line[] = sent ? sent.lines.map((l) => ({ ...l, linked: true, approved: true })) : live
  const unlinked = lines.filter((l) => !l.linked)
  const unapproved = lines.filter((l) => !l.approved)
  const open = wf.today <= period.end
  const sum = (k: 'regularHours' | 'overtimeHours' | 'absentDays') => round2(lines.reduce((n, l) => n + l[k], 0))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Payroll handoff"
        description="Hours, overtime and absences for the pay period, sent to Trademate."
        actions={
          wf.perms.sendPayroll && !sent ? (
            <Button disabled={busy || unlinked.length > 0 || !lines.length} onClick={() => setConfirming(true)}>
              Send to Trademate
            </Button>
          ) : undefined
        }
      />
      <Loaded ready={!!data} error={wf.error} onRetry={wf.reload}>
        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Pay period"
                value={which}
                onChange={setWhich}
                options={[
                  { key: 'current', label: 'This month' },
                  { key: 'previous', label: 'Last month' },
                ]}
              />
              <span className="flex items-center gap-2 text-sm text-ink/60">
                {shortDay(period.start)} to {shortDay(period.end)}
                <Badge tone={EXPORT_TONE[sent?.status ?? 'draft']}>{EXPORT_LABEL[sent?.status ?? 'draft']}</Badge>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Staff with hours" icon="guests" value={lines.length} hint={unlinked.length ? `${unlinked.length} not linked` : 'All linked'} tone={unlinked.length ? 'warn' : 'default'} />
              <StatCard label="Regular hours" icon="calendar" value={sum('regularHours').toLocaleString('en-US')} />
              <StatCard label="Overtime hours" icon="tasks" value={sum('overtimeHours')} tone={sum('overtimeHours') ? 'warn' : 'default'} />
              <StatCard label="Absent days" icon="alert" value={sum('absentDays')} tone={sum('absentDays') ? 'bad' : 'default'} />
            </div>

            <ErrorNote error={error} />
            {sent ? (
              <Card title="Sent to Trademate" icon="check">
                <dl className="grid gap-3 text-sm sm:grid-cols-4">
                  {[
                    ['Batch', sent.trademateBatchRef ?? '—'],
                    ['Sent', sent.sentAt ? dateTime(sent.sentAt) : '—'],
                    ['By', sent.sentBy?.name ?? '—'],
                    ['Status', EXPORT_LABEL[sent.status]],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-ink/50">{k}</dt>
                      <dd className="font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ) : (
              (unlinked.length > 0 || unapproved.length > 0 || open) && (
                <Card title="Before sending" icon="alert">
                  <ul className="space-y-2 text-sm">
                    {unlinked.length > 0 && (
                      <li className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <Badge tone="bad">Blocks sending</Badge> {unlinked.length} staff not linked to Trademate: {unlinked.map((l) => l.fullName).join(', ')}
                        </span>
                        <Link to="/hr" className={buttonClass('ghost', 'sm')}>
                          Link staff
                        </Link>
                      </li>
                    )}
                    {unapproved.length > 0 && (
                      <li className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <Badge tone="warn">Check</Badge> {unapproved.length} timesheet{unapproved.length === 1 ? '' : 's'} not approved
                        </span>
                        <Link to="/hr/attendance" className={buttonClass('ghost', 'sm')}>
                          Timesheets
                        </Link>
                      </li>
                    )}
                    {open && (
                      <li>
                        <Badge tone="info">Open</Badge> The period runs to {shortDay(period.end)}. Hours so far.
                      </li>
                    )}
                  </ul>
                </Card>
              )
            )}

            <Card title="Hours per employee" icon="list" count={lines.length} padded={false}>
              <DataTable<Line>
                rows={lines}
                rowKey={(l) => l.userId}
                empty={{ title: 'No hours in this period' }}
                columns={[
                  {
                    key: 'n',
                    header: 'Employee',
                    cell: (l) => (
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{l.fullName}</p>
                        <p className="truncate text-xs text-ink/55">
                          {l.linked ? (data.trademate.find((t) => t.trademateEmployeeId === l.trademateEmployeeId)?.employeeNo ?? l.trademateEmployeeId) : <span className="text-bad">Not linked</span>}
                        </p>
                      </div>
                    ),
                  },
                  { key: 'r', header: 'Regular', align: 'right', cell: (l) => hoursText(l.regularHours) },
                  { key: 'o', header: 'Overtime', align: 'right', cell: (l) => (l.overtimeHours ? <b className="text-warn">{hoursText(l.overtimeHours)}</b> : '—') },
                  { key: 'ni', header: 'Night', align: 'right', hideBelow: 'md', cell: (l) => (l.nightHours ? hoursText(l.nightHours) : '—') },
                  { key: 'a', header: 'Absent', align: 'right', cell: (l) => (l.absentDays ? <b className="text-bad">{l.absentDays}</b> : '—') },
                  { key: 'l', header: 'Late', align: 'right', hideBelow: 'sm', cell: (l) => l.lateCount || '—' },
                  { key: 's', header: 'Timesheet', align: 'right', hideBelow: 'sm', cell: (l) => (l.approved ? <Badge tone="good">Approved</Badge> : <Badge>Open</Badge>) },
                ]}
              />
            </Card>

            <Card title="Sent periods" icon="calendar" count={data.exports.length} padded={false}>
              <DataTable
                rows={data.exports}
                rowKey={(x) => x.id}
                empty={{ title: 'Nothing sent yet' }}
                columns={[
                  { key: 'p', header: 'Period', cell: (x) => `${shortDay(x.periodStart)} to ${shortDay(x.periodEnd)}` },
                  { key: 'b', header: 'Batch', hideBelow: 'md', cell: (x) => x.trademateBatchRef ?? '—' },
                  { key: 'n', header: 'Employees', align: 'right', hideBelow: 'sm', cell: (x) => x.lines.length },
                  { key: 'by', header: 'Sent', hideBelow: 'sm', cell: (x) => (x.sentAt ? `${dateTime(x.sentAt)} · ${x.sentBy?.name}` : '—') },
                  { key: 's', header: 'Status', align: 'right', cell: (x) => <Badge tone={EXPORT_TONE[x.status]}>{EXPORT_LABEL[x.status]}</Badge> },
                ]}
              />
            </Card>
          </>
        )}
      </Loaded>
      {confirming && (
        <ConfirmDialog
          title="Send hours to Trademate?"
          message={`${lines.length} employees, ${sum('regularHours')} regular and ${sum('overtimeHours')} overtime hours for ${shortDay(period.start)} to ${shortDay(period.end)}.${open ? ' The period has not ended yet.' : ''}${unapproved.length ? ` ${unapproved.length} timesheets will be approved as sent.` : ''} This cannot be undone here.`}
          confirmLabel="Send"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            run(() => workforceService.sendPayroll(wf.propertyId, period, Date.now(), wf.actor))
          }}
        />
      )}
    </div>
  )
}
