import { useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard, Textarea } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dateTime, timeAgo, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { clockOf, clockWords, CLOCK_TONE } from '../../lib/sla'
import { useNow } from '../../lib/useNow'
import { workforceService } from '../../services'
import type { CaseCategory, CaseInput, CaseSource, CompensationKind, FollowUpOutcome, ServiceCase, WorkPriority } from '../../services/workforce/workforceTypes'
import { CASE_STATUS_LABEL, CATEGORY_LABEL, COMPENSATION_LABEL, PRIORITIES, SOURCE_LABEL } from '../../services/workforce/workforceTypes'
import { useGuestRequests } from '../portal/useGuestRequests'
import type { GuestRequest } from '../portal/useGuestRequests'
import { useFeatures } from '../platform/featuresContext'
import { useAction, useWorkforce } from './useWorkforce'
import { ErrorNote, Loaded, PriorityBadge } from './workforceUi'

type WF = ReturnType<typeof useWorkforce>
type View = 'open' | 'resolved' | 'all'

const STATUS_TONE = { open: 'warn', 'in-progress': 'info', resolved: 'good', closed: 'neutral' } as const

/** The department a portal request most likely belongs to, from its words. */
function guessDepartment(text: string): string {
  const t = text.toLowerCase()
  if (/towel|pillow|clean|sheet|blanket|iron|laundry|soap|toilet paper/.test(t)) return 'HK'
  if (/breakfast|dinner|lunch|food|drink|coffee|tea|cake|wine|menu|room service/.test(t)) return 'FB'
  if (/broken|repair|air ?con|ac\b|tv|light|bulb|water|leak|shower|wifi|socket/.test(t)) return 'ENG'
  return 'FO'
}

export default function ServiceCasesPage() {
  const wf = useWorkforce()
  const { data } = wf
  const { options } = useFeatures()
  const now = useNow(30000)
  const { requests } = useGuestRequests()
  const [view, setView] = useState<View>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const dueHours = (p: WorkPriority) => options.sla.targets[p].fixHours

  const cases = useMemo(() => data?.cases ?? [], [data])
  const toImport = useMemo(
    () => requests.filter((r) => r.state === 'new' && !cases.some((c) => c.guestRequestId === r.id)),
    [requests, cases],
  )
  const isOpen = (c: ServiceCase) => c.status === 'open' || c.status === 'in-progress'
  const rows = cases.filter((c) => view === 'all' || (view === 'open' ? isOpen(c) : !isOpen(c)))
  const late = cases.filter((c) => isOpen(c) && Date.parse(c.dueAt) < now)
  const toApprove = cases.filter((c) => c.compensation?.status === 'proposed')
  const followUps = cases.filter((c) => c.status === 'resolved' && !c.followUp)
  const opened = cases.find((c) => c.id === openId)

  const columns: Column<ServiceCase>[] = [
    {
      key: 'case',
      header: 'Case',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{c.title}</p>
          <p className="truncate text-xs text-ink/55">
            {c.caseNo} · {CATEGORY_LABEL[c.category]}
          </p>
        </div>
      ),
    },
    {
      key: 'guest',
      header: 'Guest',
      hideBelow: 'sm',
      cell: (c) => (
        <div>
          <p>{c.guestName}</p>
          <p className="text-xs text-ink/55">{c.roomNumber ? `Room ${c.roomNumber}` : 'No room'}</p>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Responsible',
      hideBelow: 'md',
      cell: (c) => (
        <div>
          <p>{wf.dept(c.departmentId)}</p>
          <p className="text-xs text-ink/55">{c.ownerUserId ? wf.name(c.ownerUserId) : 'Nobody yet'}</p>
        </div>
      ),
    },
    { key: 'p', header: 'Priority', hideBelow: 'lg', cell: (c) => <PriorityBadge priority={c.priority} /> },
    {
      key: 'sla',
      header: 'SLA',
      hideBelow: 'sm',
      cell: (c) => {
        const clock = clockOf(c.createdAt, c.resolvedAt, (Date.parse(c.dueAt) - Date.parse(c.createdAt)) / 3600000, now)
        return <Badge tone={CLOCK_TONE[clock.state]}>{clockWords(clock)}</Badge>
      },
    },
    {
      key: 'st',
      header: 'Status',
      align: 'right',
      cell: (c) => (
        <span className="flex flex-wrap justify-end gap-1">
          {c.compensation?.status === 'proposed' && <Badge tone="warn">Offer to approve</Badge>}
          <Badge tone={STATUS_TONE[c.status]}>{CASE_STATUS_LABEL[c.status]}</Badge>
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Service cases"
        description="Guest requests and service recovery, by room, guest and department."
        actions={
          <>
            {toImport.length > 0 && (
              <Button variant="secondary" onClick={() => setImporting(true)}>
                Import portal requests ({toImport.length})
              </Button>
            )}
            <Button onClick={() => setAdding(true)}>New case</Button>
          </>
        }
      />
      <Loaded ready={!!data} error={wf.error} onRetry={wf.reload}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Open cases" icon="list" value={cases.filter(isOpen).length} onClick={() => setView('open')} active={view === 'open'} />
              <StatCard label="Past due" icon="alert" value={late.length} tone={late.length ? 'bad' : 'good'} hint="Against the SLA" />
              <StatCard label="Offers to approve" icon="money" value={toApprove.length} tone={toApprove.length ? 'warn' : 'default'} hint={toApprove.length ? ugx(toApprove.reduce((n, c) => n + (c.compensation?.amount ?? 0), 0)) : 'None waiting'} />
              <StatCard label="Follow-ups due" icon="guests" value={followUps.length} hint="Resolved, guest not asked" onClick={() => setView('resolved')} active={view === 'resolved'} />
            </div>
            <Card
              title="Cases"
              icon="list"
              count={rows.length}
              actions={
                <Segmented
                  label="Show"
                  value={view}
                  onChange={setView}
                  options={[
                    { key: 'open', label: 'Open' },
                    { key: 'resolved', label: 'Resolved' },
                    { key: 'all', label: 'All' },
                  ]}
                />
              }
              padded={false}
            >
              <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} onRowClick={(c) => setOpenId(c.id)} empty={{ title: 'No cases here' }} />
            </Card>
          </>
        )}
      </Loaded>
      {opened && data && <CasePanel wf={wf} c={opened} now={now} dueHours={dueHours} onClose={() => setOpenId(null)} />}
      {adding && data && <NewCaseDialog wf={wf} dueHours={dueHours} onClose={() => setAdding(false)} />}
      {importing && data && <ImportDialog wf={wf} requests={toImport} dueHours={dueHours} onClose={() => setImporting(false)} />}
    </div>
  )
}

function CasePanel({ wf, c, now, dueHours, onClose }: { wf: WF; c: ServiceCase; now: number; dueHours: (p: WorkPriority) => number; onClose: () => void }) {
  const data = wf.data!
  const { features } = useFeatures()
  const { run, busy, error } = useAction()
  const [dept, setDept] = useState(c.departmentId)
  const [owner, setOwner] = useState(c.ownerUserId ?? '')
  const [comp, setComp] = useState<{ kind: CompensationKind; description: string; amount: number }>({ kind: 'discount', description: '', amount: 0 })
  const [deciding, setDeciding] = useState<null | 'approve' | 'decline'>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [outcome, setOutcome] = useState<FollowUpOutcome>('satisfied')
  const [followNote, setFollowNote] = useState('')
  const [note, setNote] = useState('')
  const history = data.caseActions.filter((a) => a.caseId === c.id).sort((a, b) => b.at.localeCompare(a.at))
  const tasks = data.tasks.filter((t) => t.caseId === c.id)
  const open = c.status === 'open' || c.status === 'in-progress'
  const staff = data.staff.filter((u) => u.departmentId === dept || u.allocations.some((a) => a.departmentId === dept))
  const canDecide = wf.perms.approve && c.compensation?.status === 'proposed' && c.compensation.proposedBy.id !== wf.actor.id

  const h3 = 'text-xs font-semibold uppercase tracking-wide text-ink/50'
  return (
    <Modal side title={`${c.caseNo} · ${c.title}`} description={`${c.guestName}${c.roomNumber ? `, room ${c.roomNumber}` : ''} · ${SOURCE_LABEL[c.source]}`} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[c.status]}>{CASE_STATUS_LABEL[c.status]}</Badge>
          <PriorityBadge priority={c.priority} />
          <Badge>{CATEGORY_LABEL[c.category]}</Badge>
          {c.reservationId && <Badge tone="brand">{c.reservationId}</Badge>}
        </div>
        {c.detail && <p>{c.detail}</p>}
        <p className="text-xs text-ink/55">
          Logged {dateTime(c.createdAt)} by {c.createdBy.name} · due {dateTime(c.dueAt)}
        </p>

        <section className="space-y-2">
          <h3 className={h3}>Responsible</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Department">
              {(id) => (
                <Select id={id} value={dept} disabled={!open} onChange={(e) => (setDept(e.target.value), setOwner(''))}>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Owner">
              {(id) => (
                <Select id={id} value={owner} disabled={!open} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">Department head</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            {(dept !== c.departmentId || owner !== (c.ownerUserId ?? '')) && (
              <Button size="sm" disabled={busy} onClick={() => run(() => workforceService.assignCase(wf.propertyId, c.id, dept, owner || null, wf.actor))}>
                Save assignment
              </Button>
            )}
            {c.status === 'open' && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.setCaseStatus(wf.propertyId, c.id, 'in-progress', wf.actor))}>
                Start work
              </Button>
            )}
            {features.taskSla && open && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    workforceService.createTask(
                      wf.propertyId,
                      { title: c.title, description: `${c.caseNo}: ${c.detail}`, departmentId: c.departmentId, assigneeUserId: c.ownerUserId, priority: c.priority, roomNumber: c.roomNumber, caseId: c.id, dueInHours: dueHours(c.priority) },
                      wf.actor,
                    ),
                  )
                }
              >
                Create task
              </Button>
            )}
          </div>
          {tasks.length > 0 && (
            <ul className="text-xs text-ink/60">
              {tasks.map((t) => (
                <li key={t.id}>
                  Task: {t.title} · {wf.name(t.assigneeUserId)} · {t.status === 'done' ? 'done' : 'open'}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className={h3}>Compensation</h3>
          {c.compensation && c.compensation.status !== 'declined' ? (
            <div className="rounded-lg bg-canvas p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {c.compensation.description} · {ugx(c.compensation.amount)}
                </p>
                <Badge tone={c.compensation.status === 'approved' ? 'good' : 'warn'}>{c.compensation.status === 'approved' ? 'Approved' : 'Waiting approval'}</Badge>
              </div>
              <p className="text-xs text-ink/55">
                {COMPENSATION_LABEL[c.compensation.kind]} · offered by {c.compensation.proposedBy.name}, {dateTime(c.compensation.proposedAt)}
                {c.compensation.decidedBy && ` · approved by ${c.compensation.decidedBy.name}, ${dateTime(c.compensation.decidedAt!)}`}
              </p>
              {canDecide && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setDeciding('approve')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeciding('decline')}>
                    Decline
                  </Button>
                </div>
              )}
              {c.compensation.status === 'proposed' && !canDecide && <p className="mt-1 text-xs text-ink/55">A manager other than the proposer approves it.</p>}
            </div>
          ) : open ? (
            <div className="space-y-2">
              {c.compensation?.status === 'declined' && (
                <p className="text-xs text-bad">
                  Declined by {c.compensation.decidedBy?.name}: {c.compensation.note}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Kind">
                  {(id) => (
                    <Select id={id} value={comp.kind} onChange={(e) => setComp({ ...comp, kind: e.target.value as CompensationKind })}>
                      {Object.entries(COMPENSATION_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="What">{(id) => <Input id={id} value={comp.description} onChange={(e) => setComp({ ...comp, description: e.target.value })} />}</Field>
                <Field label="Value (UGX)">
                  {(id) => <Input id={id} type="number" min={0} value={comp.amount} onChange={(e) => setComp({ ...comp, amount: Number(e.target.value) })} />}
                </Field>
              </div>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => workforceService.proposeCompensation(wf.propertyId, c.id, comp, wf.actor))}>
                Offer for approval
              </Button>
            </div>
          ) : (
            <p className="text-ink/50">None</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className={h3}>Resolution</h3>
          {c.resolution ? (
            <p>
              {c.resolution}
              <span className="block text-xs text-ink/55">
                {c.resolvedBy?.name}, {dateTime(c.resolvedAt!)}
              </span>
            </p>
          ) : (
            <>
              <Textarea rows={2} aria-label="Resolution" placeholder="What was done for the guest" value={resolution} onChange={(e) => setResolution(e.target.value)} />
              <Button size="sm" disabled={busy} onClick={() => run(() => workforceService.resolveCase(wf.propertyId, c.id, resolution, wf.actor), () => setResolution(''))}>
                Mark resolved
              </Button>
            </>
          )}
        </section>

        {(c.status === 'resolved' || c.status === 'closed' || c.followUp) && (
          <section className="space-y-2">
            <h3 className={h3}>Guest follow-up</h3>
            {c.followUp ? (
              <p>
                <Badge tone={c.followUp.outcome === 'satisfied' ? 'good' : c.followUp.outcome === 'not-satisfied' ? 'bad' : 'neutral'}>
                  {c.followUp.outcome === 'satisfied' ? 'Satisfied' : c.followUp.outcome === 'not-satisfied' ? 'Not satisfied' : 'No answer'}
                </Badge>{' '}
                {c.followUp.note}
                <span className="block text-xs text-ink/55">
                  {c.followUp.by.name}, {dateTime(c.followUp.at)}
                </span>
              </p>
            ) : null}
            {(!c.followUp || c.followUp.outcome === 'no-answer') && c.status !== 'in-progress' && (
              <>
                <Segmented
                  label="Outcome"
                  value={outcome}
                  onChange={setOutcome}
                  options={[
                    { key: 'satisfied', label: 'Satisfied' },
                    { key: 'not-satisfied', label: 'Not satisfied' },
                    { key: 'no-answer', label: 'No answer' },
                  ]}
                />
                <Input aria-label="Follow-up note" placeholder="What the guest said" value={followNote} onChange={(e) => setFollowNote(e.target.value)} />
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => workforceService.recordFollowUp(wf.propertyId, c.id, outcome, followNote, wf.actor), () => setFollowNote(''))}>
                  Record follow-up
                </Button>
              </>
            )}
            {c.status === 'resolved' && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.setCaseStatus(wf.propertyId, c.id, 'closed', wf.actor))}>
                Close case
              </Button>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h3 className={h3}>History</h3>
          <div className="flex gap-2">
            <Input aria-label="Add a note" placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" variant="ghost" disabled={busy || !note.trim()} onClick={() => run(() => workforceService.addCaseNote(wf.propertyId, c.id, note, wf.actor), () => setNote(''))}>
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {history.map((a) => (
              <li key={a.id} className="border-l-2 border-ink/10 pl-3">
                <p>{a.note}</p>
                <p className="text-xs text-ink/50">
                  {a.by.name} · {timeAgo(a.at, now)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {deciding && c.compensation && (
        <ConfirmDialog
          title={deciding === 'approve' ? 'Approve compensation?' : 'Decline compensation?'}
          message={
            <div className="space-y-2">
              <p>
                {c.compensation.description} for {c.guestName}, {ugx(c.compensation.amount)}.
              </p>
              <Input aria-label="Note" placeholder={deciding === 'decline' ? 'Reason (required)' : 'Note (optional)'} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
            </div>
          }
          confirmLabel={deciding === 'approve' ? 'Approve' : 'Decline'}
          danger={deciding === 'decline'}
          onCancel={() => setDeciding(null)}
          onConfirm={() => run(() => workforceService.decideCompensation(wf.propertyId, c.id, deciding === 'approve', decisionNote, wf.actor), () => (setDeciding(null), setDecisionNote('')))}
        />
      )}
    </Modal>
  )
}

function NewCaseDialog({ wf, dueHours, onClose }: { wf: WF; dueHours: (p: WorkPriority) => number; onClose: () => void }) {
  const data = wf.data!
  const { reservations } = useHotel()
  const inHouse = reservations.filter((r) => r.status === 'in-house')
  const [f, setF] = useState<CaseInput>({
    source: 'desk',
    category: 'complaint',
    guestName: '',
    departmentId: data.departments.find((d) => d.code === 'FO')?.id ?? data.departments[0]?.id ?? '',
    priority: 'High',
    title: '',
    detail: '',
    dueInHours: dueHours('High'),
  })
  const set = (p: Partial<CaseInput>) => setF((x) => ({ ...x, ...p }))
  const { run, busy, error } = useAction()
  return (
    <Modal
      title="New service case"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => workforceService.createCase(wf.propertyId, f, wf.actor), onClose)}>
            Log case
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorNote error={error} />
        <Field label="Guest in the house">
          {(id) => (
            <Select
              id={id}
              value={f.reservationId ?? ''}
              onChange={(e) => {
                const r = inHouse.find((x) => x.id === e.target.value)
                set(r ? { reservationId: r.id, guestId: r.guestId, guestName: r.guest, roomNumber: r.room ?? undefined } : { reservationId: undefined, guestId: undefined, roomNumber: undefined })
              }}
            >
              <option value="">Not in the house / type below</option>
              {inHouse.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.guest} · room {r.room} · {r.id}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guest name" required>
            {(id) => <Input id={id} value={f.guestName} onChange={(e) => set({ guestName: e.target.value })} />}
          </Field>
          <Field label="Room">{(id) => <Input id={id} value={f.roomNumber ?? ''} onChange={(e) => set({ roomNumber: e.target.value })} />}</Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={f.category} onChange={(e) => set({ category: e.target.value as CaseCategory })}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Came in by">
            {(id) => (
              <Select id={id} value={f.source} onChange={(e) => set({ source: e.target.value as CaseSource })}>
                {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Responsible department">
            {(id) => (
              <Select id={id} value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value, ownerUserId: undefined })}>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={f.priority} onChange={(e) => set({ priority: e.target.value as WorkPriority, dueInHours: dueHours(e.target.value as WorkPriority) })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p} · {dueHours(p)} h
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="What happened" required>
          {(id) => <Input id={id} value={f.title} onChange={(e) => set({ title: e.target.value })} />}
        </Field>
        <Field label="Details">{(id) => <Textarea id={id} rows={2} value={f.detail} onChange={(e) => set({ detail: e.target.value })} />}</Field>
      </div>
    </Modal>
  )
}

function ImportDialog({ wf, requests, dueHours, onClose }: { wf: WF; requests: GuestRequest[]; dueHours: (p: WorkPriority) => number; onClose: () => void }) {
  const data = wf.data!
  const deptId = (code: string) => data.departments.find((d) => d.code === code)?.id ?? data.departments.find((d) => d.code === 'FO')?.id ?? data.departments[0].id
  const [picked, setPicked] = useState<Set<string>>(() => new Set(requests.map((r) => r.id)))
  const { run, busy, error } = useAction()
  function importAll() {
    run(async () => {
      for (const r of requests.filter((x) => picked.has(x.id))) {
        await workforceService.createCase(
          wf.propertyId,
          {
            source: 'portal',
            category: 'request',
            guestName: r.guestName,
            guestId: r.guestId,
            reservationId: r.reservationId,
            roomNumber: r.room,
            departmentId: deptId(guessDepartment(`${r.title} ${r.detail ?? ''} ${r.offerKind ?? ''}`)),
            priority: 'Normal',
            title: r.title,
            detail: r.detail ?? '',
            dueInHours: dueHours('Normal'),
            guestRequestId: r.id,
          },
          wf.actor,
        )
      }
    }, onClose)
  }
  return (
    <Modal
      title="Import portal requests"
      description="Open requests guests sent from their stay page"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || picked.size === 0} onClick={importAll}>
            Import {picked.size}
          </Button>
        </>
      }
    >
      <ErrorNote error={error} />
      <ul className="divide-y divide-ink/8 text-sm">
        {requests.map((r) => (
          <li key={r.id}>
            <label className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={picked.has(r.id)}
                onChange={(e) => {
                  const next = new Set(picked)
                  if (e.target.checked) next.add(r.id)
                  else next.delete(r.id)
                  setPicked(next)
                }}
              />
              <span className="min-w-0">
                <b>{r.title}</b>
                <span className="block text-xs text-ink/55">
                  {r.guestName}
                  {r.room ? `, room ${r.room}` : ''} · {wf.dept(deptId(guessDepartment(`${r.title} ${r.detail ?? ''} ${r.offerKind ?? ''}`)))}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
