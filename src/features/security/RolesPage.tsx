import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import type { Column, TabItem } from '../../components/ui'
import { ROLES, USERS, roleById } from '../../lib/roles'
import type { RoleId } from '../../lib/roles'
import { dateTime } from '../../lib/format'
import { useApprovals } from '../approvals/approvalsContext'
import { useFeatures } from '../platform/featuresContext'
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  SENSITIVE_FIELDS,
  VERB_LABEL,
  defaultGrant,
  defaultVisible,
  effectiveGrant,
  maskValue,
  permissionKey,
  permissionLabel,
} from '../../services/security/catalog'
import type { SecurityService } from '../../services/security/securityService'
import type { NewSodRule, PermissionVerb, UserRole } from '../../services/security/securityTypes'
import { ErrorBanner, ReadOnly } from './parts'
import { selfApprovals, sodConflicts } from './sod'
import { useAction, useSecurityActor, useSecurityData } from './useSecurity'

type TabKey = 'matrix' | 'people' | 'fields' | 'sod'
const VERBS: PermissionVerb[] = ['view', 'create', 'edit', 'approve']
const HOTEL_ROLES = ROLES.filter((r) => r.id !== 'platform')

const load = async (s: SecurityService, p: string) => {
  const [overrides, userRoles, masked, sod] = await Promise.all([s.listRolePermissions(p), s.listUserRoles(p), s.listMaskedColumns(p), s.listSodRules(p)])
  return { overrides, userRoles, masked, sod }
}

export default function RolesPage() {
  const { features, tenant, tenants } = useFeatures()
  const { actor, canAdmin, propertyId, service } = useSecurityActor()
  const { records } = useApprovals()
  const { data, error: loadError } = useSecurityData(load)
  const { run, error, clear, busy } = useAction()

  const canEditMatrix = canAdmin && features.fieldPermissions
  const group = tenant.group ? tenants.filter((t) => t.group === tenant.group) : [tenant]
  const multi = group.length > 1 && features.fieldPermissions

  const tabs: TabItem<TabKey>[] = [
    { key: 'matrix', label: 'Permissions' },
    { key: 'people', label: 'People and properties' },
    ...(features.fieldPermissions ? [{ key: 'fields' as const, label: 'Sensitive fields' }] : []),
    ...(features.sodRules ? [{ key: 'sod' as const, label: 'Segregation of duties' }] : []),
  ]
  const [tab, setTab] = useState<TabKey>('matrix')
  const [roleId, setRoleId] = useState<RoleId>('frontdesk')
  const [scopeFor, setScopeFor] = useState<UserRole | null>(null)
  const [addingRule, setAddingRule] = useState(false)
  const [previewRole, setPreviewRole] = useState<RoleId>('frontdesk')

  const overrides = useMemo(() => data?.overrides ?? [], [data])
  const conflicts = useMemo(() => (data ? sodConflicts(data.sod, data.userRoles, overrides) : []), [data, overrides])
  const selfSigned = useMemo(() => selfApprovals(records), [records])

  if (!data) return <div className="space-y-5"><PageHeader title="Roles and permissions" /><ErrorBanner message={loadError} /></div>

  const changedFor = (r: RoleId) =>
    overrides.filter((o) => {
      const [id, verb] = o.permissionKey.split('.') as [string, PermissionVerb]
      return o.roleId === r && o.granted !== defaultGrant(r, id, verb)
    }).length
  const totalChanged = HOTEL_ROLES.reduce((n, r) => n + changedFor(r.id), 0)
  const conflictUsers = new Set(conflicts.map((c) => c.user.id)).size
  const visible = (field: (typeof SENSITIVE_FIELDS)[number]['field'], r: RoleId) =>
    data.masked.find((m) => m.field === field && m.roleId === r)?.visible ?? defaultVisible(field, r)

  const toggle = (key: string) => {
    if (!actor || busy) return
    void run(() => service.setRolePermission(propertyId, roleId, key, !effectiveGrant(roleId, key, overrides), actor))
  }

  const role = roleById(roleId)
  const holders = data.userRoles.filter((u) => u.roleId === roleId)
  const modules = [...new Set(PERMISSIONS.map((p) => p.module))]

  const peopleColumns: Column<UserRole>[] = [
    {
      key: 'name',
      header: 'Person',
      cell: (u) => {
        const user = USERS.find((x) => x.id === u.userId)
        return (
          <div>
            <p className="font-medium text-ink">{user?.name ?? u.userId}</p>
            <p className="text-xs text-ink/55">{user?.email}</p>
          </div>
        )
      },
    },
    { key: 'role', header: 'Role', cell: (u) => roleById(u.roleId)?.label },
    {
      key: 'scope',
      header: 'Properties',
      cell: (u) =>
        !multi ? (
          tenant.name
        ) : u.scope === 'all' ? (
          <Badge tone="brand">All properties</Badge>
        ) : (
          <span className="text-ink/75">{u.propertyIds.map((id) => tenants.find((t) => t.id === id)?.name ?? id).join(', ')}</span>
        ),
    },
    ...(features.sodRules
      ? [
          {
            key: 'sod',
            header: 'Duty conflicts',
            cell: (u: UserRole) => {
              const n = conflicts.filter((c) => c.userRole.id === u.id).length
              return n ? <Badge tone="bad">{n}</Badge> : <Badge tone="good">None</Badge>
            },
          },
        ]
      : []),
    { key: 'since', header: 'Since', hideBelow: 'md', cell: (u) => dateTime(u.grantedAt) },
    ...(multi && canAdmin
      ? [
          {
            key: 'act',
            header: '',
            align: 'right' as const,
            cell: (u: UserRole) => (
              <Button size="sm" variant="ghost" onClick={() => setScopeFor(u)}>
                Properties
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Roles and permissions"
        description="Who can do what, at which property, and which duties never mix."
        meta={!canEditMatrix ? <ReadOnly /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Roles" icon="guests" value={HOTEL_ROLES.length} hint="From the standard roles table" />
        <StatCard label="Hotel changes" icon="list" value={totalChanged} hint="On top of the standard table" />
        <StatCard label="Staff with a role" icon="check" value={data.userRoles.length} hint={multi ? `${group.length} properties` : tenant.name} />
        {features.sodRules ? (
          <StatCard label="Duty conflicts" icon="alert" value={conflictUsers} hint={`${conflicts.length} rule breaks`} tone={conflictUsers ? 'bad' : 'good'} onClick={() => setTab('sod')} />
        ) : (
          <StatCard label="Changing roles" icon="alert" value={features.fieldPermissions ? 'Allowed' : 'View only'} hint={features.fieldPermissions ? 'Owner and hotel admin' : 'Edit rights come with Standard'} />
        )}
      </div>

      <ErrorBanner message={error} onClose={clear} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Roles sections" />

      {tab === 'matrix' && (
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Select aria-label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value as RoleId)} className="w-auto py-1.5">
                {HOTEL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {changedFor(r.id) ? ` (${changedFor(r.id)} changed)` : ''}
                  </option>
                ))}
              </Select>
            </span>
          }
          description={`${role.blurb} ${holders.length} ${holders.length === 1 ? 'person' : 'people'}.`}
          actions={
            canEditMatrix && changedFor(roleId) > 0 ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => actor && run(() => service.resetRole(propertyId, roleId, actor))}>
                Reset to standard
              </Button>
            ) : undefined
          }
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-canvas/50">
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-ink/55">
                    Function
                  </th>
                  {VERBS.map((v) => (
                    <th key={v} scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-ink/55">
                      {VERB_LABEL[v]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <ModuleRows key={m} module={m} roleId={roleId} overrides={overrides} editable={canEditMatrix} onToggle={toggle} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'people' && (
        <Card title="People and their roles" count={data.userRoles.length} padded={false}>
          <DataTable columns={peopleColumns} rows={data.userRoles} rowKey={(u) => u.id} empty={{ title: 'Nobody has a role here yet' }} />
        </Card>
      )}

      {tab === 'fields' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card title="Who sees sensitive fields" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-canvas/50">
                    <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-ink/55">
                      Role
                    </th>
                    {SENSITIVE_FIELDS.map((f) => (
                      <th key={f.field} scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-ink/55">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {HOTEL_ROLES.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">{r.label}</td>
                      {SENSITIVE_FIELDS.map((f) => {
                        const on = visible(f.field, r.id)
                        return (
                          <td key={f.field} className="px-3 py-2 text-center">
                            <button
                              type="button"
                              disabled={!canAdmin || busy}
                              aria-pressed={on}
                              aria-label={`${f.label} for ${r.label}: ${on ? 'visible' : 'masked'}`}
                              onClick={() => actor && run(() => service.setFieldVisible(propertyId, f.field, r.id, !on, actor))}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset disabled:cursor-default ${
                                on ? 'bg-good/10 text-good ring-good/20' : 'bg-ink/8 text-ink/55 ring-ink/10'
                              } ${canAdmin ? 'hover:ring-brand/40' : ''}`}
                            >
                              {on ? 'Visible' : 'Masked'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Preview" actions={
            <Select aria-label="Preview as" value={previewRole} onChange={(e) => setPreviewRole(e.target.value as RoleId)} className="w-auto py-1.5">
              {HOTEL_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          }>
            <dl className="space-y-3 text-sm">
              {SENSITIVE_FIELDS.map((f) => (
                <div key={f.field} className="flex items-center justify-between gap-3">
                  <dt className="text-ink/60">{f.label}</dt>
                  <dd className="font-mono text-ink">{visible(f.field, previewRole) ? f.sample : maskValue(f.field, f.sample)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {tab === 'sod' && (
        <div className="space-y-4">
          <Card
            title="Rules"
            count={data.sod.length}
            padded={false}
            actions={canAdmin ? <Button size="sm" onClick={() => setAddingRule(true)}>Add rule</Button> : undefined}
          >
            <ul className="divide-y divide-ink/8">
              {data.sod.map((r) => {
                const n = conflicts.filter((c) => c.rule.id === r.id).length
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {r.name}
                        <Badge tone={r.severity === 'high' ? 'bad' : 'warn'}>{r.severity === 'high' ? 'High' : 'Medium'}</Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-ink/55">
                        {permissionLabel(r.permissionA)} + {permissionLabel(r.permissionB)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.enabled ? n ? <Badge tone="bad">{n} {n === 1 ? 'person' : 'people'}</Badge> : <Badge tone="good">Clear</Badge> : <Badge>Off</Badge>}
                      <Button size="sm" variant="ghost" disabled={!canAdmin || busy} onClick={() => actor && run(() => service.setSodRuleEnabled(propertyId, r.id, !r.enabled, actor))}>
                        {r.enabled ? 'Turn off' : 'Turn on'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card title="Who breaks a rule now" count={conflicts.length} padded={false}>
            <DataTable
              rows={conflicts}
              rowKey={(c) => `${c.rule.id}-${c.userRole.id}`}
              empty={{ title: 'Nobody holds two duties that must stay apart' }}
              columns={[
                { key: 'who', header: 'Person', cell: (c) => <span className="font-medium text-ink">{c.user.name}</span> },
                { key: 'role', header: 'Role', cell: (c) => roleById(c.userRole.roleId)?.label },
                { key: 'rule', header: 'Rule', cell: (c) => c.rule.name },
                { key: 'sev', header: '', hideBelow: 'sm', cell: (c) => <Badge tone={c.rule.severity === 'high' ? 'bad' : 'warn'}>{c.rule.severity}</Badge> },
                ...(canEditMatrix
                  ? [
                      {
                        key: 'fix',
                        header: '',
                        align: 'right' as const,
                        cell: (c: (typeof conflicts)[number]) => (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRoleId(c.userRole.roleId)
                              setTab('matrix')
                            }}
                          >
                            Edit role
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          <Card title="Approved by the person who asked" count={selfSigned.length} padded={false}>
            {selfSigned.length === 0 ? (
              <EmptyState title="No self-approvals in the record" />
            ) : (
              <DataTable
                rows={selfSigned}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'at', header: 'When', cell: (r) => dateTime(r.at) },
                  { key: 'what', header: 'What', cell: (r) => r.what },
                  { key: 'who', header: 'Person', cell: (r) => r.requestedBy },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {scopeFor && (
        <ScopeDialog
          userRole={scopeFor}
          properties={group.map((t) => ({ id: t.id, name: t.name }))}
          onClose={() => setScopeFor(null)}
          onSave={async (scope, ids) => {
            if (!actor) return
            const ok = await run(() => service.setUserScope(propertyId, scopeFor.id, scope, ids, actor))
            if (ok) setScopeFor(null)
          }}
          error={error}
        />
      )}

      {addingRule && (
        <RuleDialog
          error={error}
          onClose={() => {
            clear()
            setAddingRule(false)
          }}
          onSave={async (input) => {
            if (!actor) return
            const ok = await run(() => service.addSodRule(propertyId, input, actor))
            if (ok) setAddingRule(false)
          }}
        />
      )}
    </div>
  )
}

function ModuleRows({
  module,
  roleId,
  overrides,
  editable,
  onToggle,
}: {
  module: string
  roleId: RoleId
  overrides: Parameters<typeof effectiveGrant>[2]
  editable: boolean
  onToggle: (key: string) => void
}) {
  const perms = PERMISSIONS.filter((p) => p.module === module)
  return (
    <>
      <tr className="border-y border-ink/8 bg-canvas/40">
        <th colSpan={5} scope="colgroup" className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink/50">
          {module}
        </th>
      </tr>
      {perms.map((p) => (
        <tr key={p.id} className="border-b border-ink/6 last:border-0">
          <td className="whitespace-nowrap px-4 py-2 text-ink">{p.label}</td>
          {VERBS.map((v) => {
            if (!p.verbs.includes(v))
              return (
                <td key={v} className="px-3 py-2 text-center text-ink/25">
                  -
                </td>
              )
            const key = permissionKey(p.id, v)
            const on = effectiveGrant(roleId, key, overrides)
            const changed = on !== defaultGrant(roleId, p.id, v)
            return (
              <td key={v} className="px-3 py-2 text-center">
                <label className="relative inline-flex items-center justify-center">
                  {!editable ? (
                    <span aria-label={`${p.label}: ${VERB_LABEL[v]} ${on ? 'allowed' : 'not allowed'}`} className={on ? 'font-bold text-brand' : 'text-ink/25'}>
                      {on ? '✓' : '·'}
                    </span>
                  ) : (
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!editable}
                    onChange={() => onToggle(key)}
                    aria-label={`${p.label}: ${VERB_LABEL[v]}`}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  )}
                  {changed && <span className="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-warn" title="Changed from the standard table" />}
                </label>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function ScopeDialog({
  userRole,
  properties,
  onClose,
  onSave,
  error,
}: {
  userRole: UserRole
  properties: { id: string; name: string }[]
  onClose: () => void
  onSave: (scope: UserRole['scope'], ids: string[]) => void
  error: string | null
}) {
  const [scope, setScope] = useState(userRole.scope)
  const [ids, setIds] = useState<string[]>(userRole.scope === 'all' ? properties.map((p) => p.id) : userRole.propertyIds)
  const user = USERS.find((u) => u.id === userRole.userId)
  return (
    <Modal
      title={`Properties for ${user?.name ?? userRole.userId}`}
      description={roleById(userRole.roleId)?.label}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(scope, ids)}>Save</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <ErrorBanner message={error} />
        <label className="flex items-center gap-2">
          <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} /> All properties, including new ones
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="scope" checked={scope === 'listed'} onChange={() => setScope('listed')} /> Only these
        </label>
        {scope === 'listed' && (
          <div className="ml-6 space-y-2">
            {properties.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ids.includes(p.id)}
                  onChange={(e) => setIds((list) => (e.target.checked ? [...list, p.id] : list.filter((x) => x !== p.id)))}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function RuleDialog({ onClose, onSave, error }: { onClose: () => void; onSave: (input: NewSodRule) => void; error: string | null }) {
  const [input, setInput] = useState<NewSodRule>({ name: '', permissionA: 'refunds.create', permissionB: 'refunds.approve', severity: 'high' })
  const options = ALL_PERMISSION_KEYS.map((k) => (
    <option key={k} value={k}>
      {permissionLabel(k)}
    </option>
  ))
  return (
    <Modal
      title="Add a segregation rule"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(input)}>Add rule</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Name" required>
          {(id) => <Input id={id} value={input.name} placeholder="Void a sale and cash up the till" onChange={(e) => setInput({ ...input, name: e.target.value })} />}
        </Field>
        <Field label="First duty">
          {(id) => (
            <Select id={id} value={input.permissionA} onChange={(e) => setInput({ ...input, permissionA: e.target.value })}>
              {options}
            </Select>
          )}
        </Field>
        <Field label="Must not be held with">
          {(id) => (
            <Select id={id} value={input.permissionB} onChange={(e) => setInput({ ...input, permissionB: e.target.value })}>
              {options}
            </Select>
          )}
        </Field>
        <Field label="Severity">
          {(id) => (
            <Select id={id} value={input.severity} onChange={(e) => setInput({ ...input, severity: e.target.value as NewSodRule['severity'] })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
