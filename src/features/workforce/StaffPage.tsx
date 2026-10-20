import { useMemo, useState } from 'react'
import { Badge, Button, Card, Chip, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dateTime, dayMonthYear } from '../../lib/format'
import { ROLES, roleById } from '../../lib/roles'
import type { RoleId } from '../../lib/roles'
import { weekDays, weekStart } from '../../lib/workforce'
import { workforceService } from '../../services'
import type { ContractType, StaffInput, StaffUser } from '../../services/workforce/workforceTypes'
import { LOGIN_LABEL } from '../../services/workforce/workforceTypes'
import { useAction, useWorkforce } from './useWorkforce'
import { ErrorNote, Initials, Loaded } from './workforceUi'

type LinkFilter = 'all' | 'linked' | 'unlinked'
type WF = ReturnType<typeof useWorkforce>

const HOTEL_ROLES = ROLES.filter((r) => r.id !== 'platform')
const LOGIN_TONE = { active: 'good', invited: 'info', none: 'neutral', disabled: 'bad' } as const
const CONTRACT_LABEL: Record<ContractType, string> = { permanent: 'Permanent', contract: 'Fixed contract', casual: 'Casual' }

export default function StaffPage() {
  const wf = useWorkforce()
  const { data, perms } = wf
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const [link, setLink] = useState<LinkFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const linkOf = (id: string) => data?.links.find((l) => l.userId === id)
  const rows = useMemo(() => {
    if (!data) return []
    const text = q.trim().toLowerCase()
    return data.staff
      .filter((u) => dept === 'all' || u.departmentId === dept || u.allocations.some((a) => a.departmentId === dept))
      .filter((u) => link === 'all' || (link === 'linked') === data.links.some((l) => l.userId === u.id))
      .filter((u) => !text || `${u.fullName} ${u.jobTitle}`.toLowerCase().includes(text))
  }, [data, q, dept, link])

  const total = data?.staff.length ?? 0
  const linked = data?.links.length ?? 0
  const logins = data?.staff.filter((u) => u.loginStatus === 'active').length ?? 0
  const opened = data?.staff.find((u) => u.id === openId) ?? null

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Initials name={u.fullName} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{u.fullName}</p>
            <p className="truncate text-xs text-ink/55">{u.jobTitle}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Department',
      hideBelow: 'md',
      cell: (u) => (
        <div>
          <p>{wf.dept(u.departmentId)}</p>
          {u.allocations.length > 0 && (
            <p className="text-xs text-ink/55">+ {u.allocations.map((a) => `${wf.dept(a.departmentId)} ${a.percent}%`).join(', ')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Gastora role',
      hideBelow: 'lg',
      cell: (u) => (u.roles.length ? u.roles.map((r) => roleById(r).label).join(', ') : <span className="text-ink/45">—</span>),
    },
    { key: 'login', header: 'Login', hideBelow: 'sm', cell: (u) => <Badge tone={LOGIN_TONE[u.loginStatus]}>{LOGIN_LABEL[u.loginStatus]}</Badge> },
    {
      key: 'tm',
      header: 'Trademate HR',
      align: 'right',
      cell: (u) => {
        const l = linkOf(u.id)
        if (l) {
          const tm = data?.trademate.find((t) => t.trademateEmployeeId === l.trademateEmployeeId)
          return (
            <Badge tone="good" dot>
              Linked {tm?.employeeNo}
            </Badge>
          )
        }
        return <Badge tone="warn">Not linked</Badge>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Staff"
        description="Who works here, their Gastora login and their Trademate HR record."
        actions={perms.manageStaff ? <Button onClick={() => setAdding(true)}>Add staff</Button> : undefined}
      />
      <Loaded ready={!!data} error={wf.error} onRetry={wf.reload}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Staff" icon="guests" value={total} hint={`${data.departments.length} departments`} />
              <StatCard label="Active logins" icon="check" value={logins} hint={`${total - logins} without one`} />
              <StatCard
                label="Linked to Trademate"
                icon="list"
                value={`${linked} / ${total}`}
                hint={total - linked ? `${total - linked} to link` : 'All linked'}
                tone={total - linked ? 'warn' : 'good'}
                onClick={() => setLink(link === 'unlinked' ? 'all' : 'unlinked')}
                active={link === 'unlinked'}
              />
              <StatCard label="On a contract or casual" icon="calendar" value={data.staff.filter((u) => u.contractType !== 'permanent').length} hint="Not permanent" />
            </div>

            <Card title="Staff list" icon="guests" count={rows.length} padded={false}>
              <div className="space-y-3 border-b border-ink/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input placeholder="Search name or job" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" aria-label="Search staff" />
                  <Segmented
                    label="Trademate link"
                    value={link}
                    onChange={setLink}
                    options={[
                      { key: 'all', label: 'All' },
                      { key: 'linked', label: 'Linked' },
                      { key: 'unlinked', label: 'Not linked' },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip active={dept === 'all'} onClick={() => setDept('all')} count={total}>
                    All
                  </Chip>
                  {data.departments.map((d) => (
                    <Chip key={d.id} active={dept === d.id} onClick={() => setDept(d.id)} count={data.staff.filter((u) => u.departmentId === d.id).length}>
                      {d.name}
                    </Chip>
                  ))}
                </div>
              </div>
              <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} onRowClick={(u) => setOpenId(u.id)} empty={{ title: 'No staff match' }} />
            </Card>

            <Card title="Department allocation" icon="occupancy" padded={false}>
              <DataTable
                rows={data.departments}
                rowKey={(d) => d.id}
                columns={[
                  { key: 'd', header: 'Department', cell: (d) => <span className="font-semibold">{d.name}</span> },
                  { key: 'h', header: 'Head', hideBelow: 'sm', cell: (d) => wf.name(d.headUserId) },
                  { key: 'n', header: 'Staff', align: 'right', cell: (d) => data.staff.filter((u) => u.departmentId === d.id).length },
                  {
                    key: 'fte',
                    header: 'Full-time equivalent',
                    align: 'right',
                    cell: (d) => {
                      const fte = data.staff.reduce((n, u) => {
                        const away = u.allocations.reduce((s, a) => s + a.percent, 0)
                        if (u.departmentId === d.id) return n + (100 - away) / 100
                        return n + (u.allocations.find((a) => a.departmentId === d.id)?.percent ?? 0) / 100
                      }, 0)
                      return <span className="tabular-nums">{fte.toFixed(1)}</span>
                    },
                  },
                ]}
              />
            </Card>
          </>
        )}
      </Loaded>

      {opened && data && <StaffPanel wf={wf} user={opened} onClose={() => setOpenId(null)} />}
      {adding && data && <AddStaffDialog wf={wf} onClose={() => setAdding(false)} />}
    </div>
  )
}

function StaffPanel({ wf, user, onClose }: { wf: WF; user: StaffUser; onClose: () => void }) {
  const data = wf.data!
  const { run, busy, error } = useAction()
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [home, setHome] = useState(user.departmentId)
  const [alloc, setAlloc] = useState(user.allocations)
  const link = data.links.find((l) => l.userId === user.id)
  const tm = link ? data.trademate.find((t) => t.trademateEmployeeId === link.trademateEmployeeId) : undefined
  const week = weekDays(weekStart(wf.today))
  const shifts = data.shifts.filter((s) => s.userId === user.id && week.includes(s.workDate))
  const tasks = data.tasks.filter((t) => t.assigneeUserId === user.id && t.status !== 'done')
  const changed = home !== user.departmentId || JSON.stringify(alloc) !== JSON.stringify(user.allocations)
  const can = wf.perms.manageStaff

  return (
    <Modal side title={user.fullName} description={`${user.jobTitle} · ${CONTRACT_LABEL[user.contractType]}`} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <ErrorNote error={error} />
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Gastora login</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={LOGIN_TONE[user.loginStatus]}>{LOGIN_LABEL[user.loginStatus]}</Badge>
            {user.roles.map((r) => (
              <Badge key={r} tone="brand">
                {roleById(r).label}
              </Badge>
            ))}
          </div>
          <p className="text-ink/60">{[user.email, user.phone].filter(Boolean).join(' · ')}</p>
          {can && (
            <div className="flex flex-wrap gap-2">
              {(user.loginStatus === 'none' || user.loginStatus === 'disabled') && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => workforceService.setLoginStatus(wf.propertyId, user.id, user.email && user.loginStatus === 'disabled' ? 'active' : 'invited', wf.actor))}>
                  {user.loginStatus === 'disabled' ? 'Enable login' : 'Send invitation'}
                </Button>
              )}
              {user.loginStatus === 'invited' && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.setLoginStatus(wf.propertyId, user.id, 'invited', wf.actor))}>
                  Resend invitation
                </Button>
              )}
              {(user.loginStatus === 'active' || user.loginStatus === 'invited') && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => workforceService.setLoginStatus(wf.propertyId, user.id, 'disabled', wf.actor))}>
                  Disable login
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Department allocation</h3>
          <Field label="Home department">
            {(id) => (
              <Select id={id} value={home} disabled={!can} onChange={(e) => setHome(e.target.value)}>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {alloc.map((a, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label="Also covers">
                {(id) => (
                  <Select id={id} value={a.departmentId} disabled={!can} onChange={(e) => setAlloc(alloc.map((x, j) => (j === i ? { ...x, departmentId: e.target.value } : x)))}>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Share %">
                {(id) => (
                  <Input id={id} type="number" className="w-20" value={a.percent} disabled={!can} onChange={(e) => setAlloc(alloc.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) || 0 } : x)))} />
                )}
              </Field>
              {can && (
                <Button size="sm" variant="ghost" onClick={() => setAlloc(alloc.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              )}
            </div>
          ))}
          {can && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAlloc([...alloc, { departmentId: data.departments.find((d) => d.id !== home)?.id ?? home, percent: 20 }])}
              >
                Add another department
              </Button>
              {changed && (
                <Button size="sm" disabled={busy} onClick={() => run(() => workforceService.updateStaff(wf.propertyId, user.id, { departmentId: home, allocations: alloc }, wf.actor))}>
                  Save allocation
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Trademate HR</h3>
            {tm ? <Badge tone="good">Linked</Badge> : <Badge tone="warn">Not linked</Badge>}
          </div>
          {tm && link ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-canvas p-3">
                {[
                  ['Employee no.', tm.employeeNo],
                  ['Name in HR', tm.fullName],
                  ['Grade', tm.grade],
                  ['Pay group', tm.payGroup],
                  ['Started', dayMonthYear(tm.startDate)],
                  ['National ID', tm.nationalIdMasked],
                  ['Bank account', tm.bankMasked],
                  ['Linked', `${dateTime(link.linkedAt)} by ${link.linkedBy.name}`],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-ink/50">{k}</dt>
                    <dd className="truncate">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-ink/50">Read-only, from Trademate. Edit it there.</p>
              {can && (
                <Button size="sm" variant="ghost" onClick={() => setUnlinking(true)}>
                  Unlink
                </Button>
              )}
            </>
          ) : (
            can && (
              <Button size="sm" onClick={() => setLinking(true)}>
                Link to Trademate employee
              </Button>
            )
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">This week</h3>
          <p>
            {shifts.length} shift{shifts.length === 1 ? '' : 's'} rostered · {tasks.length} open task{tasks.length === 1 ? '' : 's'}
          </p>
        </section>
      </div>
      {linking && <LinkDialog wf={wf} user={user} onClose={() => setLinking(false)} />}
      {unlinking && (
        <ConfirmDialog
          title="Unlink from Trademate?"
          message={`${user.fullName}'s hours will not reach payroll until linked again.`}
          confirmLabel="Unlink"
          danger
          onCancel={() => setUnlinking(false)}
          onConfirm={() => run(() => workforceService.unlinkEmployee(wf.propertyId, user.id, wf.actor), () => setUnlinking(false))}
        />
      )}
    </Modal>
  )
}

function LinkDialog({ wf, user, onClose }: { wf: WF; user: StaffUser; onClose: () => void }) {
  const data = wf.data!
  const free = data.trademate.filter((t) => !data.links.some((l) => l.trademateEmployeeId === t.trademateEmployeeId))
  const match = free.find((t) => t.fullName.toLowerCase() === user.fullName.toLowerCase())
  const [pick, setPick] = useState(match?.trademateEmployeeId ?? free[0]?.trademateEmployeeId ?? '')
  const { run, busy, error } = useAction()
  return (
    <Modal
      title="Link to Trademate"
      description={user.fullName}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!pick || busy} onClick={() => run(() => workforceService.linkEmployee(wf.propertyId, user.id, pick, wf.actor), onClose)}>
            Link
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorNote error={error} />
        {free.length === 0 ? (
          <p className="text-sm text-ink/60">Every Trademate employee is already linked. Add the person in Trademate first.</p>
        ) : (
          <Field label="Trademate employee" hint={match ? 'Matched by name.' : undefined}>
            {(id) => (
              <Select id={id} value={pick} onChange={(e) => setPick(e.target.value)}>
                {free.map((t) => (
                  <option key={t.trademateEmployeeId} value={t.trademateEmployeeId}>
                    {t.fullName} · {t.employeeNo} · {t.grade}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
    </Modal>
  )
}

function AddStaffDialog({ wf, onClose }: { wf: WF; onClose: () => void }) {
  const data = wf.data!
  const [f, setF] = useState<StaffInput>({ fullName: '', phone: '', email: '', jobTitle: '', departmentId: data.departments[0]?.id ?? '', contractType: 'permanent', roles: [] })
  const set = (p: Partial<StaffInput>) => setF((x) => ({ ...x, ...p }))
  const { run, busy, error } = useAction()
  return (
    <Modal
      title="Add staff"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => workforceService.addStaff(wf.propertyId, f, wf.actor), onClose)}>
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorNote error={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required>
            {(id) => <Input id={id} value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} />}
          </Field>
          <Field label="Job title" required>
            {(id) => <Input id={id} value={f.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />}
          </Field>
          <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={(e) => set({ phone: e.target.value })} />}</Field>
          <Field label="Email" hint="Needed for a login.">
            {(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />}
          </Field>
          <Field label="Department">
            {(id) => (
              <Select id={id} value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value })}>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Contract">
            {(id) => (
              <Select id={id} value={f.contractType} onChange={(e) => set({ contractType: e.target.value as ContractType })}>
                {Object.entries(CONTRACT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Gastora role" hint="None means no login.">
            {(id) => (
              <Select id={id} value={f.roles[0] ?? ''} onChange={(e) => set({ roles: e.target.value ? [e.target.value as RoleId] : [] })}>
                <option value="">None</option>
                {HOTEL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  )
}
