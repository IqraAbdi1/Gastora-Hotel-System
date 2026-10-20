import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Chip, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import { dateTime, timeAgo } from '../../lib/format'
import { clockOf, clockWords, CLOCK_TONE } from '../../lib/sla'
import { useNow } from '../../lib/useNow'
import { ESCALATION_LABEL, weekDays, weekStart } from '../../lib/workforce'
import { taskService, workforceService } from '../../services'
import type { FrontDeskTask } from '../../services/tasks/taskTypes'
import type { TaskInput, TaskStatus, WorkNotification, WorkPriority, WorkTask } from '../../services/workforce/workforceTypes'
import { PRIORITIES, TASK_STATUS_LABEL } from '../../services/workforce/workforceTypes'
import { useFeatures } from '../platform/featuresContext'
import { useAction, useWorkforce } from './useWorkforce'
import { hoursText } from './workforceFormat'
import { ErrorNote, Loaded, PriorityBadge } from './workforceUi'

type Tab = 'board' | 'workload' | 'notifications' | 'escalations'
type WF = ReturnType<typeof useWorkforce>

/** A front-desk task shown on the same board, so the desk's list is not kept twice. */
type DeskItem = { kind: 'desk'; task: FrontDeskTask }
type Item = { kind: 'work'; task: WorkTask } | DeskItem

const DESK_PRIORITY: Record<FrontDeskTask['priority'], WorkPriority> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Normal' }
const NOTE_TONE = { queued: 'info', sent: 'good', read: 'neutral', failed: 'bad' } as const

function useDeskTasks() {
  const [list, setList] = useState<FrontDeskTask[]>([])
  useEffect(() => {
    const load = () => void taskService.list().then(setList)
    load()
    return taskService.subscribe(load)
  }, [])
  return list
}

export default function WorkTasksPage() {
  const wf = useWorkforce()
  const { data } = wf
  const { options } = useFeatures()
  const now = useNow(30000)
  const desk = useDeskTasks()
  const [tab, setTab] = useState<Tab>('board')
  const [dept, setDept] = useState('all')
  const [mine, setMine] = useState(false)
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const { run, busy, error } = useAction()

  const foDept = data?.departments.find((d) => d.code === 'FO')
  const items: Item[] = useMemo(() => {
    const work: Item[] = (data?.tasks ?? []).map((task) => ({ kind: 'work', task }))
    const fd: Item[] = desk.map((task) => ({ kind: 'desk', task }))
    return [...work, ...fd]
  }, [data, desk])

  const deptOf = (i: Item) => (i.kind === 'work' ? i.task.departmentId : foDept?.id ?? '')
  const statusOf = (i: Item): TaskStatus => (i.kind === 'work' ? i.task.status : i.task.status === 'done' ? 'done' : 'open')
  const overdue = (i: Item) => statusOf(i) !== 'done' && Date.parse(i.task.dueAt) < now
  const doneToday = (i: Item) => statusOf(i) === 'done' && (i.task.completedAt ?? '').slice(0, 10) === new Date(now).toISOString().slice(0, 10)
  const shown = items.filter(
    (i) => (dept === 'all' || deptOf(i) === dept) && (!mine || (i.kind === 'work' ? i.task.assigneeUserId === wf.actor.id : i.task.assignee?.id === wf.actor.id)),
  )
  const open = items.filter((i) => statusOf(i) !== 'done')
  const late = open.filter(overdue)
  const atGm = (data?.tasks ?? []).filter((t) => t.status !== 'done' && t.escalationLevel === 2)
  const problems = (data?.notifications ?? []).filter((n) => n.status === 'failed').length
  const opened = data?.tasks.find((t) => t.id === openId)

  const lanes: { key: TaskStatus; label: string }[] = [
    { key: 'open', label: 'To do' },
    { key: 'in-progress', label: 'In progress' },
    { key: 'done', label: 'Done today' },
  ]

  function taskCard(item: Item) {
    const t = item.task
    const status = statusOf(item)
    const clock = clockOf(t.createdAt, t.completedAt, (Date.parse(t.dueAt) - Date.parse(t.createdAt)) / 3600000, now)
    const level = item.kind === 'work' ? item.task.escalationLevel : 0
    const assignee = item.kind === 'work' ? item.task.assigneeUserId : undefined
    const priority = item.kind === 'work' ? item.task.priority : DESK_PRIORITY[item.task.priority]
    const room = item.kind === 'work' ? item.task.roomNumber : item.task.reservationId
    return (
      <li
        key={`${item.kind}-${t.id}`}
        className={`rounded-lg border bg-surface p-3 text-sm shadow-sm ${level === 2 ? 'border-bad/50' : level === 1 ? 'border-warn/50' : 'border-ink/10'} ${item.kind === 'work' ? 'cursor-pointer hover:border-brand/40' : ''}`}
        onClick={() => item.kind === 'work' && setOpenId(t.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-ink">{t.title}</p>
          <PriorityBadge priority={priority} />
        </div>
        <p className="mt-0.5 text-xs text-ink/55">
          {wf.dept(deptOf(item))}
          {room ? ` · ${item.kind === 'work' ? 'Room ' : ''}${room}` : ''}
          {item.kind === 'desk' && ' · front desk list'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={CLOCK_TONE[clock.state]}>{clockWords(clock)}</Badge>
          {level > 0 && status !== 'done' && <Badge tone={level === 2 ? 'bad' : 'warn'}>To {ESCALATION_LABEL[level].toLowerCase()}</Badge>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          {item.kind === 'work' ? (
            <Select
              aria-label="Assigned to"
              className="!py-1 text-xs"
              value={assignee ?? ''}
              disabled={status === 'done' || busy}
              onChange={(e) => run(() => workforceService.assignTask(wf.propertyId, t.id, e.target.value || null, wf.actor))}
            >
              <option value="">Nobody yet</option>
              {data!.staff
                .filter((u) => u.departmentId === item.task.departmentId || u.allocations.some((a) => a.departmentId === item.task.departmentId))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
            </Select>
          ) : (
            <span className="truncate text-xs text-ink/55">{item.task.assignee?.name ?? 'Nobody yet'}</span>
          )}
          <div className="flex shrink-0 gap-1">
            {item.kind === 'work' && status === 'open' && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.setTaskStatus(wf.propertyId, t.id, 'in-progress', wf.actor))}>
                Start
              </Button>
            )}
            {status !== 'done' ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => run(() => (item.kind === 'work' ? workforceService.setTaskStatus(wf.propertyId, t.id, 'done', wf.actor) : taskService.complete(t.id, wf.actor)))}
              >
                Done
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => run(() => (item.kind === 'work' ? workforceService.setTaskStatus(wf.propertyId, t.id, 'open', wf.actor) : taskService.reopen(t.id, wf.actor)))}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Tasks"
        description="Work across departments, with due times and escalation."
        actions={<Button onClick={() => setAdding(true)}>New task</Button>}
      />
      <Loaded ready={!!data} error={wf.error} onRetry={wf.reload}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Open tasks" icon="tasks" value={open.length} hint={`${data.departments.length} departments`} />
              <StatCard label="Overdue" icon="alert" value={late.length} tone={late.length ? 'bad' : 'good'} hint="Past the due time" />
              <StatCard label="With the manager" icon="alert" value={atGm.length} tone={atGm.length ? 'warn' : 'default'} hint="Second escalation" />
              <StatCard label="Done today" icon="check" value={items.filter(doneToday).length} tone="good" />
            </div>
            <Tabs
              label="Task views"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'board', label: 'Board', count: shown.filter((i) => statusOf(i) !== 'done').length },
                { key: 'workload', label: 'Workload' },
                { key: 'notifications', label: 'Notifications', count: data.notifications.length, alert: problems > 0 },
                { key: 'escalations', label: 'Escalations', count: data.escalations.length },
              ]}
            />
            <ErrorNote error={error} />

            {tab === 'board' && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Chip active={mine} onClick={() => setMine(!mine)}>
                    Mine
                  </Chip>
                  <Chip active={dept === 'all'} onClick={() => setDept('all')}>
                    All departments
                  </Chip>
                  {data.departments.map((d) => (
                    <Chip key={d.id} active={dept === d.id} onClick={() => setDept(d.id)} count={items.filter((i) => deptOf(i) === d.id && statusOf(i) !== 'done').length}>
                      {d.name}
                    </Chip>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {lanes.map((lane) => {
                    const list = shown
                      .filter((i) => statusOf(i) === lane.key && (lane.key !== 'done' || doneToday(i)))
                      .sort((a, b) => a.task.dueAt.localeCompare(b.task.dueAt))
                    return (
                      <Card key={lane.key} title={lane.label} count={list.length} className="bg-canvas/40">
                        {list.length === 0 ? (
                          <p className="text-sm text-ink/50">Nothing here</p>
                        ) : (
                          <ul className="space-y-2">
                            {list.map((i) => taskCard(i))}
                          </ul>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </>
            )}

            {tab === 'workload' && <Workload wf={wf} items={items} deptOf={deptOf} statusOf={statusOf} overdue={overdue} />}
            {tab === 'notifications' && <Notifications wf={wf} now={now} />}
            {tab === 'escalations' && (
              <Card title="Escalations" icon="alert" count={data.escalations.length} padded={false}>
                <DataTable
                  rows={data.escalations}
                  rowKey={(e) => e.id}
                  onRowClick={(e) => setOpenId(e.taskId)}
                  empty={{ title: 'Nothing has gone up' }}
                  columns={[
                    { key: 't', header: 'Task', cell: (e) => <span className="font-semibold">{data.tasks.find((t) => t.id === e.taskId)?.title}</span> },
                    { key: 'l', header: 'Level', cell: (e) => <Badge tone={e.level === 2 ? 'bad' : 'warn'}>{e.level === 2 ? 'Manager' : 'Supervisor'}</Badge> },
                    { key: 'to', header: 'Told', hideBelow: 'sm', cell: (e) => wf.name(e.toUserId) },
                    { key: 'why', header: 'Why', hideBelow: 'md', cell: (e) => e.reason },
                    { key: 'at', header: 'When', align: 'right', cell: (e) => timeAgo(e.at, now) },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </Loaded>
      {adding && data && <NewTaskDialog wf={wf} slaHours={(p) => options.sla.targets[p].fixHours} onClose={() => setAdding(false)} />}
      {opened && data && (
        <Modal side title={opened.title} description={`${wf.dept(opened.departmentId)} · ${TASK_STATUS_LABEL[opened.status]}`} onClose={() => setOpenId(null)}>
          <div className="space-y-4 text-sm">
            {opened.description && <p>{opened.description}</p>}
            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Priority', opened.priority],
                ['Assigned to', wf.name(opened.assigneeUserId)],
                ['Due', dateTime(opened.dueAt)],
                ['Room', opened.roomNumber ?? '—'],
                ['Created', `${dateTime(opened.createdAt)} by ${opened.createdBy.name}`],
                ['Escalation', ESCALATION_LABEL[opened.escalationLevel]],
                ...(opened.completedAt ? [['Done', `${dateTime(opened.completedAt)} by ${opened.completedBy?.name}`]] : []),
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink/50">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Escalation history</h3>
              {data.escalations.filter((e) => e.taskId === opened.id).length === 0 ? (
                <p className="text-ink/50">None</p>
              ) : (
                <ul className="space-y-1">
                  {data.escalations
                    .filter((e) => e.taskId === opened.id)
                    .map((e) => (
                      <li key={e.id}>
                        <b>{e.toLabel}</b> · {dateTime(e.at)} · <span className="text-ink/60">{e.reason}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Workload({
  wf,
  items,
  deptOf,
  statusOf,
  overdue,
}: {
  wf: WF
  items: Item[]
  deptOf: (i: Item) => string
  statusOf: (i: Item) => TaskStatus
  overdue: (i: Item) => boolean
}) {
  const data = wf.data!
  const week = weekDays(weekStart(wf.today))
  const tpl = new Map(data.templates.map((t) => [t.id, t]))
  const open = items.filter((i) => statusOf(i) !== 'done')
  const people = data.staff
    .map((u) => {
      const mine = open.filter((i) => i.kind === 'work' && i.task.assigneeUserId === u.id)
      const hours = data.shifts.filter((s) => s.userId === u.id && week.includes(s.workDate)).reduce((n, s) => n + (tpl.get(s.shiftTemplateId)?.paidHours ?? 0), 0)
      return { u, open: mine.length, late: mine.filter(overdue).length, progress: mine.filter((i) => statusOf(i) === 'in-progress').length, hours }
    })
    .filter((p) => p.open > 0 || p.hours > 0)
    .sort((a, b) => b.open - a.open || b.late - a.late)
  const depts = data.departments.map((d) => {
    const list = open.filter((i) => deptOf(i) === d.id)
    return { d, open: list.length, late: list.filter(overdue).length, unassigned: list.filter((i) => i.kind === 'work' && !i.task.assigneeUserId).length }
  })
  const max = Math.max(1, ...depts.map((x) => x.open))
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="By department" icon="occupancy" className="lg:col-span-2">
        <ul className="space-y-3">
          {depts.map((x) => (
            <li key={x.d.id} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{x.d.name}</span>
                <span className="text-xs text-ink/55">
                  {x.open} open{x.late ? ` · ${x.late} late` : ''}
                  {x.unassigned ? ` · ${x.unassigned} unassigned` : ''}
                </span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-ink/8">
                <span className="bg-bad" style={{ width: `${(x.late / max) * 100}%` }} />
                <span className="bg-brand" style={{ width: `${((x.open - x.late) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="By person" icon="guests" padded={false} className="lg:col-span-3">
        <DataTable
          rows={people}
          rowKey={(p) => p.u.id}
          empty={{ title: 'No one has tasks' }}
          columns={[
            {
              key: 'n',
              header: 'Staff',
              cell: (p) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.u.fullName}</p>
                  <p className="truncate text-xs text-ink/55">{wf.dept(p.u.departmentId)}</p>
                </div>
              ),
            },
            { key: 'o', header: 'Open', align: 'right', cell: (p) => p.open },
            { key: 'p', header: 'In progress', align: 'right', hideBelow: 'sm', cell: (p) => p.progress },
            { key: 'l', header: 'Late', align: 'right', cell: (p) => (p.late ? <b className="text-bad">{p.late}</b> : '—') },
            { key: 'h', header: 'Rostered this week', align: 'right', hideBelow: 'md', cell: (p) => hoursText(p.hours) },
          ]}
        />
      </Card>
    </div>
  )
}

function Notifications({ wf, now }: { wf: WF; now: number }) {
  const data = wf.data!
  const [filter, setFilter] = useState<'all' | 'queued' | 'failed'>('all')
  const { run, busy, error } = useAction()
  const list = data.notifications.filter((n) => filter === 'all' || n.status === filter)
  const unread = data.notifications.filter((n) => n.status === 'sent').map((n) => n.id)
  return (
    <Card
      title="Notification queue"
      icon="list"
      count={list.length}
      description="Push messages to staff phones"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All' },
              { key: 'queued', label: 'Queued' },
              { key: 'failed', label: 'Failed' },
            ]}
          />
          {unread.length > 0 && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.markNotificationsRead(wf.propertyId, unread))}>
              Mark all read
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
      <DataTable<WorkNotification>
        rows={list}
        rowKey={(n) => n.id}
        empty={{ title: 'No messages' }}
        columns={[
          {
            key: 'm',
            header: 'Message',
            cell: (n) => (
              <div className="min-w-0">
                <p className="font-semibold">{n.title}</p>
                <p className="text-xs text-ink/55">{n.body}</p>
              </div>
            ),
          },
          { key: 'to', header: 'To', hideBelow: 'sm', cell: (n) => n.toLabel || wf.name(n.userId) },
          { key: 'c', header: 'Channel', hideBelow: 'lg', cell: (n) => (n.channel === 'push' ? 'Phone push' : n.channel === 'sms' ? 'SMS' : 'In app') },
          { key: 'at', header: 'When', hideBelow: 'md', cell: (n) => timeAgo(n.createdAt, now) },
          {
            key: 's',
            header: 'Status',
            align: 'right',
            cell: (n) =>
              n.status === 'failed' ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.retryNotification(wf.propertyId, n.id))}>
                  Failed · retry
                </Button>
              ) : (
                <Badge tone={NOTE_TONE[n.status]}>{n.status === 'queued' ? 'Queued' : n.status === 'sent' ? 'Delivered' : 'Read'}</Badge>
              ),
          },
        ]}
      />
    </Card>
  )
}

function NewTaskDialog({ wf, slaHours, onClose }: { wf: WF; slaHours: (p: WorkPriority) => number; onClose: () => void }) {
  const data = wf.data!
  const [f, setF] = useState<TaskInput>({
    title: '',
    description: '',
    departmentId: data.departments.find((d) => d.code === 'HK')?.id ?? data.departments[0]?.id ?? '',
    priority: 'Normal',
    dueInHours: slaHours('Normal'),
  })
  const set = (p: Partial<TaskInput>) => setF((x) => ({ ...x, ...p }))
  const { run, busy, error } = useAction()
  const staff = data.staff.filter((u) => u.departmentId === f.departmentId || u.allocations.some((a) => a.departmentId === f.departmentId))
  return (
    <Modal
      title="New task"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => workforceService.createTask(wf.propertyId, f, wf.actor), onClose)}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorNote error={error} />
        <Field label="Title" required>
          {(id) => <Input id={id} value={f.title} onChange={(e) => set({ title: e.target.value })} />}
        </Field>
        <Field label="Details">{(id) => <Textarea id={id} rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department">
            {(id) => (
              <Select id={id} value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value, assigneeUserId: undefined })}>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Assign to">
            {(id) => (
              <Select id={id} value={f.assigneeUserId ?? ''} onChange={(e) => set({ assigneeUserId: e.target.value || undefined })}>
                <option value="">Nobody yet</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={f.priority} onChange={(e) => set({ priority: e.target.value as WorkPriority, dueInHours: slaHours(e.target.value as WorkPriority) })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Due in (hours)" hint="From the hotel's SLA targets.">
            {(id) => <Input id={id} type="number" min={0.25} step={0.25} value={f.dueInHours} onChange={(e) => set({ dueInHours: Number(e.target.value) })} />}
          </Field>
          <Field label="Room">{(id) => <Input id={id} value={f.roomNumber ?? ''} onChange={(e) => set({ roomNumber: e.target.value })} />}</Field>
        </div>
      </div>
    </Modal>
  )
}
