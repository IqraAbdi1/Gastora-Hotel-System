import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Chip, ConfirmDialog, Modal, PageHeader, StatCard, buttonClass } from '../../components/ui'
import { addDaysYmd, rosterWarnings, weekDays, weekStart } from '../../lib/workforce'
import type { RosterWarning } from '../../lib/workforce'
import { workforceService } from '../../services'
import type { RosterShift, ShiftTemplate } from '../../services/workforce/workforceTypes'
import { useAction, useWorkforce } from './useWorkforce'
import { shortDay } from './workforceFormat'
import { ErrorNote, Loaded } from './workforceUi'

const TONE: Record<ShiftTemplate['code'], string> = {
  morning: 'bg-accent/25 text-ink ring-accent/40',
  evening: 'bg-info/15 text-info ring-info/30',
  night: 'bg-brand text-white ring-brand',
  day: 'bg-good/15 text-good ring-good/30',
}
const SHORT: Record<ShiftTemplate['code'], string> = { morning: 'M', evening: 'E', night: 'N', day: 'D' }
const OFF = 'off'

export default function RostersPage() {
  const wf = useWorkforce()
  const { data, perms } = wf
  const [ws, setWs] = useState(() => weekStart(wf.today))
  const [dept, setDept] = useState('all')
  const [brush, setBrush] = useState<string | null>(null)
  const [cell, setCell] = useState<{ userId: string; day: string } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const { run, busy, error, setError } = useAction()
  const days = weekDays(ws)
  const thisWeek = weekStart(wf.today)

  const people = useMemo(
    () =>
      (data?.staff ?? []).filter(
        (u) =>
          u.active &&
          (dept === 'all' || u.departmentId === dept) &&
          // An owner who is not on the rota is left out rather than shown off every day.
          !(u.roles.includes('owner') && !data?.shifts.some((s) => s.userId === u.id && s.workDate >= ws && s.workDate <= addDaysYmd(ws, 6))),
      ),
    [data, dept, ws],
  )
  const tpl = useMemo(() => new Map((data?.templates ?? []).map((t) => [t.id, t])), [data])
  const shiftAt = useMemo(() => {
    const m = new Map<string, RosterShift>()
    for (const s of data?.shifts ?? []) m.set(`${s.userId}|${s.workDate}`, s)
    return m
  }, [data])

  // Warnings for the week, from each person's shifts a day either side so rest across weeks counts.
  const warnings = useMemo(() => {
    const out = new Map<string, RosterWarning[]>()
    if (!data) return out
    const span = [addDaysYmd(ws, -7), addDaysYmd(ws, 7)]
    for (const u of people) {
      const mine = data.shifts.filter((s) => s.userId === u.id && s.workDate >= span[0] && s.workDate < span[1])
      for (const [id, w] of rosterWarnings(mine, data.templates, days)) out.set(id, w)
    }
    return out
  }, [data, people, ws, days])

  const weekShifts = (data?.shifts ?? []).filter((s) => days.includes(s.workDate) && people.some((u) => u.id === s.userId))
  const drafts = weekShifts.filter((s) => s.status === 'draft')
  const hours = weekShifts.reduce((n, s) => n + (tpl.get(s.shiftTemplateId)?.paidHours ?? 0), 0)
  const warnList = weekShifts.flatMap((s) => (warnings.get(s.id) ?? []).map((w) => ({ s, w })))
  const hkDept = data?.departments.find((d) => d.code === 'HK')

  function assign(userId: string, day: string, templateId: string | null) {
    if (!perms.editRoster) return
    run(() => workforceService.setShift(wf.propertyId, userId, day, templateId, wf.actor))
  }

  function onCellClick(userId: string, day: string) {
    if (!perms.editRoster || day < wf.today) return
    if (brush) assign(userId, day, brush === OFF ? null : brush)
    else setCell({ userId, day })
  }

  function onDrop(e: DragEvent, userId: string, day: string) {
    e.preventDefault()
    if (day < wf.today) return setError('Past days cannot be changed. Correct attendance instead.')
    const raw = e.dataTransfer.getData('text/plain')
    if (raw.startsWith('move:')) {
      const [, fromUser, fromDay] = raw.split(':')
      const moving = shiftAt.get(`${fromUser}|${fromDay}`)
      if (!moving || (fromUser === userId && fromDay === day)) return
      run(async () => {
        await workforceService.setShift(wf.propertyId, userId, day, moving.shiftTemplateId, wf.actor)
        await workforceService.setShift(wf.propertyId, fromUser, fromDay, null, wf.actor)
      })
    } else assign(userId, day, raw === OFF ? null : raw)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Shifts and rosters"
        description="The week's roster by department, with clash and rest checks."
        actions={
          perms.editRoster ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => run(() => workforceService.copyPreviousWeek(wf.propertyId, ws, dept === 'all' ? null : dept, wf.actor))}>
                Copy last week
              </Button>
              <Button disabled={!drafts.length || busy} onClick={() => setPublishing(true)}>
                Publish {drafts.length ? `(${drafts.length})` : ''}
              </Button>
            </>
          ) : undefined
        }
      />
      <Loaded ready={!!data} error={wf.error} onRetry={wf.reload}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Shifts this week" icon="calendar" value={weekShifts.length} hint={`${people.length} staff`} />
              <StatCard label="Hours rostered" icon="tasks" value={hours} hint="Paid hours" />
              <StatCard label="Drafts to publish" icon="list" value={drafts.length} tone={drafts.length ? 'warn' : 'default'} hint={drafts.length ? 'Staff cannot see them yet' : 'All published'} />
              <StatCard label="Warnings" icon="alert" value={warnList.length} tone={warnList.length ? 'bad' : 'good'} hint="Clash, rest or overtime" />
            </div>

            <Card
              title={`Week of ${shortDay(ws)}`}
              icon="calendar"
              actions={
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setWs(addDaysYmd(ws, -7))} aria-label="Previous week">
                    ‹
                  </Button>
                  <Button size="sm" variant="ghost" disabled={ws === thisWeek} onClick={() => setWs(thisWeek)}>
                    This week
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setWs(addDaysYmd(ws, 7))} aria-label="Next week">
                    ›
                  </Button>
                </div>
              }
              padded={false}
            >
              <div className="space-y-3 border-b border-ink/10 p-4">
                <div className="flex flex-wrap gap-2">
                  <Chip active={dept === 'all'} onClick={() => setDept('all')}>
                    All departments
                  </Chip>
                  {data.departments.map((d) => (
                    <Chip key={d.id} active={dept === d.id} onClick={() => setDept(d.id)}>
                      {d.name}
                    </Chip>
                  ))}
                </div>
                {perms.editRoster && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-ink/55">Drag or pick, then click a day:</span>
                    {data.templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                        onClick={() => setBrush(brush === t.id ? null : t.id)}
                        className={`rounded-md px-2 py-1 font-semibold ring-1 ${TONE[t.code]} ${brush === t.id ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
                      >
                        {t.name} {t.startTime}–{t.endTime}
                      </button>
                    ))}
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', OFF)}
                      onClick={() => setBrush(brush === OFF ? null : OFF)}
                      className={`rounded-md bg-surface px-2 py-1 font-semibold text-ink/60 ring-1 ring-ink/15 ${brush === OFF ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
                    >
                      Off
                    </button>
                  </div>
                )}
                {hkDept && (dept === hkDept.id || dept === 'all') && (
                  <Link to="/housekeeping/roster" className={buttonClass('ghost', 'sm')}>
                    Housekeeping room allocation
                  </Link>
                )}
                <ErrorNote error={error} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink/55">
                      <th className="sticky left-0 z-10 w-44 bg-surface px-3 py-2 font-semibold">Staff</th>
                      {days.map((d) => (
                        <th key={d} className={`px-1 py-2 text-center font-semibold ${d === wf.today ? 'text-brand' : ''}`}>
                          {shortDay(d)}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-semibold">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((u) => {
                      const total = days.reduce((n, d) => n + (tpl.get(shiftAt.get(`${u.id}|${d}`)?.shiftTemplateId ?? '')?.paidHours ?? 0), 0)
                      return (
                        <tr key={u.id} className="border-t border-ink/8">
                          <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                            <p className="truncate font-semibold text-ink">{u.fullName}</p>
                            <p className="truncate text-xs text-ink/50">{u.jobTitle}</p>
                          </td>
                          {days.map((d) => {
                            const s = shiftAt.get(`${u.id}|${d}`)
                            const t = s ? tpl.get(s.shiftTemplateId) : undefined
                            const w = s ? warnings.get(s.id) : undefined
                            const past = d < wf.today
                            return (
                              <td
                                key={d}
                                className={`px-1 py-1.5 text-center ${d === wf.today ? 'bg-brand/[0.03]' : ''}`}
                                onDragOver={(e) => perms.editRoster && !past && e.preventDefault()}
                                onDrop={(e) => onDrop(e, u.id, d)}
                              >
                                <button
                                  type="button"
                                  disabled={!perms.editRoster || past}
                                  onClick={() => onCellClick(u.id, d)}
                                  draggable={!!s && perms.editRoster && !past}
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', `move:${u.id}:${d}`)}
                                  title={w?.map((x) => x.text).join('\n') ?? (t ? `${t.name} ${t.startTime}–${t.endTime}` : 'Off')}
                                  className={`relative flex h-10 w-full min-w-[72px] flex-col items-center justify-center rounded-md text-xs font-semibold ring-1 transition disabled:cursor-default ${
                                    t ? TONE[t.code] : 'text-ink/30 ring-ink/8 hover:ring-brand/40'
                                  } ${s?.status === 'draft' ? 'border border-dashed border-ink/50' : ''} ${w ? 'ring-2 ring-bad' : ''} ${past ? 'opacity-60' : ''}`}
                                >
                                  {t ? (
                                    <>
                                      <span>{t.name}</span>
                                      <span className="text-[10px] font-normal opacity-80">
                                        {t.startTime}–{t.endTime}
                                      </span>
                                    </>
                                  ) : (
                                    'Off'
                                  )}
                                  {w && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-bad text-[10px] text-white">!</span>}
                                </button>
                              </td>
                            )
                          })}
                          <td className={`px-2 text-right tabular-nums ${total > 48 ? 'font-semibold text-bad' : ''}`}>{total}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-ink/10 text-xs text-ink/60">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-semibold">Cover</td>
                      {days.map((d) => (
                        <td key={d} className="px-1 py-2 text-center tabular-nums">
                          {data.templates
                            .map((t) => ({ t, n: people.filter((u) => shiftAt.get(`${u.id}|${d}`)?.shiftTemplateId === t.id).length }))
                            .filter((x) => x.n)
                            .map((x) => `${SHORT[x.t.code]}${x.n}`)
                            .join(' ') || '—'}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="flex flex-wrap gap-3 border-t border-ink/10 px-4 py-2 text-xs text-ink/55">
                <span>Dashed: draft</span>
                <span>Red ring: warning</span>
                <span>M E N D: morning, evening, night, office day</span>
              </p>
            </Card>

            <Card title="Warnings" icon="alert" count={warnList.length} padded={false}>
              {warnList.length === 0 ? (
                <p className="p-4 text-sm text-ink/55">No clashes, short rests or overtime this week.</p>
              ) : (
                <ul className="divide-y divide-ink/8">
                  {warnList.map(({ s, w }, i) => (
                    <li key={`${s.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        <b>{wf.name(s.userId)}</b> · {shortDay(s.workDate)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={w.kind === 'clash' ? 'bad' : 'warn'}>{w.kind === 'run' ? 'No day off' : w.kind[0].toUpperCase() + w.kind.slice(1)}</Badge>
                        <span className="text-ink/70">{w.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </Loaded>

      {cell && data && (
        <Modal title={wf.name(cell.userId)} description={shortDay(cell.day)} onClose={() => setCell(null)}>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  assign(cell.userId, cell.day, t.id)
                  setCell(null)
                }}
                className={`rounded-lg px-3 py-3 text-left text-sm font-semibold ring-1 ${TONE[t.code]}`}
              >
                {t.name}
                <span className="block text-xs font-normal opacity-80">
                  {t.startTime}–{t.endTime} · {t.paidHours} h
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                assign(cell.userId, cell.day, null)
                setCell(null)
              }}
              className="rounded-lg px-3 py-3 text-left text-sm font-semibold text-ink/70 ring-1 ring-ink/15"
            >
              Day off
            </button>
          </div>
        </Modal>
      )}
      {publishing && (
        <ConfirmDialog
          title="Publish the roster?"
          message={`${drafts.length} draft shift${drafts.length === 1 ? '' : 's'} for the week of ${shortDay(ws)}. Staff get a notification.${warnList.length ? ` ${warnList.length} warning${warnList.length === 1 ? '' : 's'} still open.` : ''}`}
          confirmLabel="Publish"
          onCancel={() => setPublishing(false)}
          onConfirm={() => {
            setPublishing(false)
            run(() => workforceService.publishWeek(wf.propertyId, ws, dept === 'all' ? null : dept, wf.actor))
          }}
        />
      )}
    </div>
  )
}
