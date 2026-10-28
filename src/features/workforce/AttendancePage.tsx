import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dateTime } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { DAY_STATE_LABEL, DAY_STATE_TONE, LATE_GRACE_MIN, addDaysYmd, dayAttendance, monthPeriod, previousPeriod } from '../../lib/workforce'
import type { DayAttendance } from '../../lib/workforce'
import { workforceService } from '../../services'
import type { CorrectionInput, RosterShift, StaffUser, Timesheet } from '../../services/workforce/workforceTypes'
import { useAction, useWorkforce } from './useWorkforce'
import { hoursText, shortDay, timeOf } from './workforceFormat'
import { ErrorNote, Loaded } from './workforceUi'

type Tab = 'today' | 'timesheets' | 'corrections'
type WF = ReturnType<typeof useWorkforce>
type Row = { user: StaffUser; shift?: RosterShift; day: DayAttendance; workDate: string }

function useDayRows(wf: WF, workDate: string, now: number): Row[] {
  const data = wf.data
  return useMemo(() => {
    if (!data) return []
    const tpl = new Map(data.templates.map((t) => [t.id, t]))
    const rows: Row[] = []
    for (const user of data.staff) {
      const shift = data.shifts.find((s) => s.userId === user.id && s.workDate === workDate && s.status === 'published')
      const events = data.events.filter((e) => e.userId === user.id && e.workDate === workDate)
      if (!shift && !events.length) continue
      rows.push({ user, shift, workDate, day: dayAttendance(shift, shift ? tpl.get(shift.shiftTemplateId) : undefined, events, now) })
    }
    const order = (r: Row) => (r.shift ? tpl.get(r.shift.shiftTemplateId)?.startTime ?? '' : '99')
    return rows.sort((a, b) => order(a).localeCompare(order(b)) || a.user.fullName.localeCompare(b.user.fullName))
  }, [data, workDate, now])
}

export default function AttendancePage() {
  const wf = useWorkforce()
  const { data } = wf
  const now = useNow(30000)
  const [tab, setTab] = useState<Tab>('today')
  const [boardDay, setBoardDay] = useState<'today' | 'yesterday'>('today')
  const workDate = boardDay === 'today' ? wf.today : addDaysYmd(wf.today, -1)
  const rows = useDayRows(wf, workDate, now)
  const [correcting, setCorrecting] = useState<{ userId: string; workDate: string } | null>(null)
  const { run, busy, error } = useAction()
  const tpl = useMemo(() => new Map((data?.templates ?? []).map((t) => [t.id, t])), [data])

  const late = rows.filter((r) => r.day.state === 'late' || r.day.state === 'late-missing' || (r.day.state === 'done' && r.day.lateMin > LATE_GRACE_MIN))
  const absent = rows.filter((r) => r.day.state === 'absent')
  const onDuty = rows.filter((r) => r.day.state === 'on-duty' || r.day.state === 'late')
  const corrections = (data?.events ?? []).filter((e) => e.source === 'correction').sort((a, b) => b.at.localeCompare(a.at))

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Staff',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.user.fullName}</p>
          <p className="truncate text-xs text-ink/55">{wf.dept(r.user.departmentId)}</p>
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Shift',
      hideBelow: 'sm',
      cell: (r) => {
        const t = r.shift ? tpl.get(r.shift.shiftTemplateId) : undefined
        return t ? `${t.name} ${t.startTime}–${t.endTime}` : <span className="text-ink/45">Not rostered</span>
      },
    },
    {
      key: 'in',
      header: 'In',
      cell: (r) => (
        <span className="tabular-nums">
          {r.day.inAt ? timeOf(r.day.inAt) : '—'}
          {r.day.lateMin > LATE_GRACE_MIN && <span className="ml-1 text-xs text-warn">+{r.day.lateMin}m</span>}
        </span>
      ),
    },
    { key: 'out', header: 'Out', hideBelow: 'sm', cell: (r) => <span className="tabular-nums">{r.day.outAt ? timeOf(r.day.outAt) : '—'}</span> },
    {
      key: 'state',
      header: 'Status',
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={DAY_STATE_TONE[r.day.state]}>{DAY_STATE_LABEL[r.day.state]}</Badge>
          {r.day.corrected && <Badge tone="info">Corrected</Badge>}
          {r.day.overtimeHours > 0 && <Badge tone="warn">OT {hoursText(r.day.overtimeHours)}</Badge>}
        </span>
      ),
    },
    {
      key: 'act',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => {
        const canIn = !r.day.inAt && !['leave', 'sick'].includes(r.day.state) && r.workDate === wf.today
        const canOut = !!r.day.inAt && !r.day.outAt
        return (
          <div className="flex justify-end gap-1">
            {canIn && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => workforceService.clock(wf.propertyId, r.user.id, r.workDate, 'in', wf.actor))}>
                Clock in
              </Button>
            )}
            {canOut && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => workforceService.clock(wf.propertyId, r.user.id, r.workDate, 'out', wf.actor))}>
                Clock out
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setCorrecting({ userId: r.user.id, workDate: r.workDate })}>
              Correct
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Attendance" description="Clock-ins today, late and absent staff, and timesheets for the pay period." />
      <Loaded ready={!!data} error={wf.error} onRetry={wf.reload}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Rostered today" icon="calendar" value={rows.filter((r) => r.shift).length} hint={shortDay(workDate)} />
              <StatCard label="On duty now" icon="check" value={onDuty.length} tone="good" hint="Clocked in, not out" />
              <StatCard label="Late" icon="alert" value={late.length} tone={late.length ? 'warn' : 'default'} hint={`More than ${LATE_GRACE_MIN} min`} />
              <StatCard label="Absent" icon="alert" value={absent.length} tone={absent.length ? 'bad' : 'default'} hint="No clock-in" />
            </div>
            <Tabs
              label="Attendance views"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'today', label: 'Clock board', alert: absent.length > 0 },
                { key: 'timesheets', label: 'Timesheets' },
                { key: 'corrections', label: 'Corrections', count: corrections.length },
              ]}
            />
            {tab === 'today' && (
              <Card
                title="Clock board"
                icon="tasks"
                count={rows.length}
                actions={
                  <Segmented
                    label="Day"
                    value={boardDay}
                    onChange={setBoardDay}
                    options={[
                      { key: 'today', label: 'Today' },
                      { key: 'yesterday', label: 'Yesterday' },
                    ]}
                  />
                }
                padded={false}
              >
                {error && (
                  <div className="p-4 pb-0">
                    <ErrorNote error={error} />
                  </div>
                )}
                <DataTable columns={columns} rows={rows} rowKey={(r) => r.user.id} empty={{ title: 'Nobody rostered' }} />
              </Card>
            )}
            {tab === 'timesheets' && <Timesheets wf={wf} now={now} onCorrect={setCorrecting} />}
            {tab === 'corrections' && (
              <Card title="Corrections" icon="list" count={corrections.length} padded={false}>
                <DataTable
                  rows={corrections}
                  rowKey={(e) => e.id}
                  empty={{ title: 'No corrections yet' }}
                  columns={[
                    { key: 'who', header: 'Staff', cell: (e) => <span className="font-semibold">{wf.name(e.userId)}</span> },
                    { key: 'day', header: 'Day', cell: (e) => shortDay(e.workDate) },
                    {
                      key: 'what',
                      header: 'Change',
                      cell: (e) => (e.absence ? <Badge tone="info">{e.absence === 'unexplained' ? 'Absent' : e.absence === 'sick' ? 'Sick' : 'Leave'}</Badge> : `${e.kind === 'in' ? 'In' : 'Out'} ${timeOf(e.at)}`),
                    },
                    { key: 'why', header: 'Reason', hideBelow: 'md', cell: (e) => e.reason },
                    {
                      key: 'by',
                      header: 'Approved',
                      hideBelow: 'sm',
                      cell: (e) => (
                        <div className="text-xs">
                          <p>{e.approvedBy?.name}</p>
                          <p className="text-ink/50">
                            by {e.recordedBy?.name}, {dateTime(e.at)}
                          </p>
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </Loaded>
      {correcting && data && <CorrectionDialog wf={wf} target={correcting} onClose={() => setCorrecting(null)} />}
    </div>
  )
}

function Timesheets({ wf, now, onCorrect }: { wf: WF; now: number; onCorrect: (t: { userId: string; workDate: string }) => void }) {
  const current = monthPeriod(wf.today)
  const [which, setWhich] = useState<'current' | 'previous'>('current')
  const period = which === 'current' ? current : previousPeriod(current)
  const [sheets, setSheets] = useState<Timesheet[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const { run, busy, error } = useAction()
  const sent = wf.data?.exports.some((x) => x.periodStart === period.start && x.status !== 'failed')

  useEffect(() => {
    let live = true
    workforceService.listTimesheets(wf.propertyId, period, now).then((s) => live && setSheets(s.filter((t) => t.scheduledShifts > 0 || t.workedHours > 0)))
    return () => {
      live = false
    }
    // Reload when the data changes, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf.data, wf.propertyId, period.start])

  const opened = sheets.find((t) => t.id === openId)
  const open = sheets.filter((t) => t.status === 'open')

  return (
    <Card
      title="Timesheets"
      icon="calendar"
      count={sheets.length}
      description={`${shortDay(period.start)} to ${shortDay(period.end)}${sent ? ' · sent to Trademate' : ''}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Period"
            value={which}
            onChange={setWhich}
            options={[
              { key: 'current', label: 'This month' },
              { key: 'previous', label: 'Last month' },
            ]}
          />
          {wf.perms.approve && open.length > 0 && !sent && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(async () => {
                for (const t of open) if (t.userId !== wf.actor.id) await workforceService.approveTimesheet(wf.propertyId, t.userId, period, wf.actor)
              })}
            >
              Approve all ({open.filter((t) => t.userId !== wf.actor.id).length})
            </Button>
          )}
        </div>
      }
      padded={false}
    >
      {error && (
        <div className="p-4 pb-0">
          <ErrorNote error={error} />
        </div>
      )}
      <DataTable
        rows={sheets}
        rowKey={(t) => t.id}
        onRowClick={(t) => setOpenId(t.id)}
        empty={{ title: 'No hours in this period' }}
        columns={[
          {
            key: 'n',
            header: 'Staff',
            cell: (t) => (
              <div className="min-w-0">
                <p className="truncate font-semibold">{wf.name(t.userId)}</p>
                <p className="truncate text-xs text-ink/55">{t.scheduledShifts} shifts</p>
              </div>
            ),
          },
          { key: 's', header: 'Rostered', align: 'right', hideBelow: 'md', cell: (t) => hoursText(t.scheduledHours) },
          { key: 'w', header: 'Worked', align: 'right', cell: (t) => hoursText(t.workedHours) },
          { key: 'o', header: 'Overtime', align: 'right', cell: (t) => (t.overtimeHours ? <b className="text-warn">{hoursText(t.overtimeHours)}</b> : '—') },
          { key: 'ni', header: 'Night', align: 'right', hideBelow: 'lg', cell: (t) => (t.nightHours ? hoursText(t.nightHours) : '—') },
          { key: 'l', header: 'Late', align: 'right', hideBelow: 'sm', cell: (t) => t.lateCount || '—' },
          { key: 'a', header: 'Absent', align: 'right', hideBelow: 'sm', cell: (t) => (t.absentDays ? <b className="text-bad">{t.absentDays}</b> : '—') },
          {
            key: 'st',
            header: 'Status',
            align: 'right',
            cell: (t) =>
              t.status === 'approved' ? (
                <Badge tone="good">Approved</Badge>
              ) : wf.perms.approve && !sent && t.userId !== wf.actor.id ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation()
                    run(() => workforceService.approveTimesheet(wf.propertyId, t.userId, period, wf.actor))
                  }}
                >
                  Approve
                </Button>
              ) : (
                <Badge>Open</Badge>
              ),
          },
        ]}
      />
      {opened && <TimesheetDays wf={wf} sheet={opened} now={now} onClose={() => setOpenId(null)} onCorrect={onCorrect} />}
    </Card>
  )
}

function TimesheetDays({ wf, sheet, now, onClose, onCorrect }: { wf: WF; sheet: Timesheet; now: number; onClose: () => void; onCorrect: (t: { userId: string; workDate: string }) => void }) {
  const data = wf.data!
  const tpl = new Map(data.templates.map((t) => [t.id, t]))
  const shifts = data.shifts
    .filter((s) => s.userId === sheet.userId && s.status === 'published' && s.workDate >= sheet.periodStart && s.workDate <= sheet.periodEnd && s.workDate <= wf.today)
    .sort((a, b) => b.workDate.localeCompare(a.workDate))
  return (
    <Modal side title={wf.name(sheet.userId)} description={`${hoursText(sheet.workedHours)} worked · ${hoursText(sheet.overtimeHours)} overtime`} onClose={onClose}>
      <ul className="divide-y divide-ink/8 text-sm">
        {shifts.map((s) => {
          const t = tpl.get(s.shiftTemplateId)
          const d = dayAttendance(s, t, data.events.filter((e) => e.userId === s.userId && e.workDate === s.workDate), now)
          return (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-semibold">{shortDay(s.workDate)}</p>
                <p className="text-xs text-ink/55">
                  {t?.name} · {d.inAt ? timeOf(d.inAt) : '—'} to {d.outAt ? timeOf(d.outAt) : '—'}
                  {d.overtimeHours ? ` · OT ${hoursText(d.overtimeHours)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge tone={DAY_STATE_TONE[d.state]}>{DAY_STATE_LABEL[d.state]}</Badge>
                <Button size="sm" variant="ghost" onClick={() => onCorrect({ userId: s.userId, workDate: s.workDate })}>
                  Correct
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

function CorrectionDialog({ wf, target, onClose }: { wf: WF; target: { userId: string; workDate: string }; onClose: () => void }) {
  const data = wf.data!
  const approvers = data.staff.filter((u) => (u.roles.includes('gm') || u.roles.includes('owner') || u.roles.includes('hkhead')) && u.id !== target.userId)
  const selfApprover = wf.perms.approve && approvers.find((u) => u.id === wf.actor.id)
  const [kind, setKind] = useState<'times' | 'absence'>('times')
  const [inTime, setIn] = useState('')
  const [outTime, setOut] = useState('')
  const [absence, setAbsence] = useState<NonNullable<CorrectionInput['absence']>>('sick')
  const [reason, setReason] = useState('')
  const [approver, setApprover] = useState(selfApprover ? selfApprover.id : approvers[0]?.id ?? '')
  const { run, busy, error } = useAction()

  function save() {
    const a = data.staff.find((u) => u.id === approver)
    run(
      () =>
        workforceService.correct(
          wf.propertyId,
          {
            userId: target.userId,
            workDate: target.workDate,
            inTime: kind === 'times' ? inTime || undefined : undefined,
            outTime: kind === 'times' ? outTime || undefined : undefined,
            absence: kind === 'absence' ? absence : undefined,
            reason,
            approver: a ? { id: a.id, name: a.fullName } : { id: '', name: '' },
          },
          wf.actor,
        ),
      onClose,
    )
  }

  return (
    <Modal
      title="Correct attendance"
      description={`${wf.name(target.userId)} · ${shortDay(target.workDate)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={save}>
            Save correction
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorNote error={error} />
        <Segmented
          label="Correction type"
          value={kind}
          onChange={setKind}
          options={[
            { key: 'times', label: 'Clock times' },
            { key: 'absence', label: 'Absence' },
          ]}
        />
        {kind === 'times' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Clock in">{(id) => <Input id={id} type="time" value={inTime} onChange={(e) => setIn(e.target.value)} />}</Field>
            <Field label="Clock out">{(id) => <Input id={id} type="time" value={outTime} onChange={(e) => setOut(e.target.value)} />}</Field>
          </div>
        ) : (
          <Field label="Absence">
            {(id) => (
              <Select id={id} value={absence} onChange={(e) => setAbsence(e.target.value as typeof absence)}>
                <option value="sick">Sick</option>
                <option value="leave">Approved leave</option>
                <option value="unexplained">Absent, no reason</option>
              </Select>
            )}
          </Field>
        )}
        <Field label="Reason" required>
          {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to clock out, left at 14:10" />}
        </Field>
        <Field label="Approved by" required>
          {(id) => (
            <Select id={id} value={approver} onChange={(e) => setApprover(e.target.value)}>
              <option value="">Choose…</option>
              {approvers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} · {u.jobTitle}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
