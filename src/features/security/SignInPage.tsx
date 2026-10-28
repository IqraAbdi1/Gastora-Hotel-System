import { useState } from 'react'
import Switch from '../../components/Switch'
import { Badge, Button, Card, Chip, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard, Tabs } from '../../components/ui'
import type { TabItem, Tone } from '../../components/ui'
import { ROLES, roleById } from '../../lib/roles'
import { dateTime, timeAgo } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import type { SecurityService } from '../../services/security/securityService'
import type { AuthPolicy, Device, DeviceKind, DeviceStatus, MfaMode, NewDevice, Session, SsoSettings } from '../../services/security/securityTypes'
import { CHECK_LABEL, CHECK_TONE } from './labels'
import { ErrorBanner, Mono, ReadOnly } from './parts'
import { useAction, useSecurityActor, useSecurityData } from './useSecurity'

type TabKey = 'policy' | 'sessions' | 'devices' | 'encryption'
type SessionFilter = 'active' | 'user' | 'device' | 'revoked'

const KIND_LABEL: Record<DeviceKind, string> = { pos: 'POS terminal', tablet: 'Tablet', edge: 'Edge server', kiosk: 'Kiosk', fiscal: 'Fiscal device' }
const STATUS_TONE: Record<DeviceStatus, Tone> = { pending: 'warn', approved: 'good', blocked: 'bad' }
const STATUS_LABEL: Record<DeviceStatus, string> = { pending: 'Waiting', approved: 'Approved', blocked: 'Blocked' }
const HOTEL_ROLES = ROLES.filter((r) => r.id !== 'platform')

const load = async (s: SecurityService, p: string) => {
  const [policy, sessions, devices, checks, events] = await Promise.all([s.getAuthPolicy(p), s.listSessions(p), s.listDevices(p), s.encryptionStatus(p), s.listSecurityEvents(p)])
  return { policy, sessions, devices, checks, events }
}

export default function SignInPage() {
  const { features } = useFeatures()
  const { user } = useAuth()
  const now = useNow()
  const { actor, canAdmin, propertyId, service } = useSecurityActor()
  const { data, error: loadError } = useSecurityData(load)
  const { run, error, clear, busy } = useAction()
  const [tab, setTab] = useState<TabKey>('policy')
  const [filter, setFilter] = useState<SessionFilter>('active')
  const [revoke, setRevoke] = useState<Session | null>(null)
  const [block, setBlock] = useState<Device | null>(null)
  const [adding, setAdding] = useState(false)

  if (!data) return <div className="space-y-5"><PageHeader title="Sign-in and devices" /><ErrorBanner message={loadError} /></div>

  const active = data.sessions.filter((s) => !s.revokedAt)
  const pending = data.devices.filter((d) => d.status === 'pending')
  const userSessions = active.filter((s) => s.kind === 'user')
  const mfaShare = userSessions.length ? Math.round((userSessions.filter((s) => s.mfa).length / userSessions.length) * 100) : 0
  const okChecks = data.checks.filter((c) => c.status === 'ok').length

  const tabs: TabItem<TabKey>[] = [
    { key: 'policy', label: 'Sign-in policy' },
    { key: 'sessions', label: 'Sessions', count: active.length },
    { key: 'devices', label: 'Devices', count: data.devices.length, alert: pending.length > 0 },
    { key: 'encryption', label: 'Encryption and secrets', alert: okChecks < data.checks.length },
  ]

  const sessions = data.sessions.filter((s) =>
    filter === 'revoked' ? !!s.revokedAt : filter === 'active' ? !s.revokedAt : !s.revokedAt && (filter === 'user' ? s.kind === 'user' : s.kind !== 'user'),
  )

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Admin" title="Sign-in and devices" description="Sign-in rules, open sessions, approved terminals and encryption." meta={!canAdmin ? <ReadOnly /> : undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open sessions" icon="guests" value={active.length} hint={`${userSessions.length} people, ${active.length - userSessions.length} devices and jobs`} onClick={() => setTab('sessions')} />
        <StatCard label="Devices waiting" icon="alert" value={pending.length} hint={`${data.devices.filter((d) => d.status === 'approved').length} approved`} tone={pending.length ? 'warn' : 'default'} onClick={() => setTab('devices')} />
        <StatCard label="Signed in with MFA" icon="check" value={`${mfaShare}%`} hint="Of open staff sessions" tone={features.ssoMfa && mfaShare < 50 ? 'warn' : 'default'} />
        <StatCard label="Encryption checks" icon="list" value={`${okChecks}/${data.checks.length}`} hint="Passing" tone={okChecks < data.checks.length ? 'warn' : 'good'} onClick={() => setTab('encryption')} />
      </div>

      <ErrorBanner message={error} onClose={clear} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Sign-in sections" />

      {tab === 'policy' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <PasswordCard key={`pw-${data.policy.updatedAt}`} policy={data.policy} disabled={!canAdmin || busy} onSave={(patch) => actor && run(() => service.saveAuthPolicy(propertyId, patch, actor))} />
          {features.ssoMfa && (
            <MfaCard key={`mfa-${data.policy.updatedAt}`} policy={data.policy} disabled={!canAdmin || busy} onSave={(mfa) => actor && run(() => service.saveAuthPolicy(propertyId, { mfa }, actor))} />
          )}
          {features.ssoMfa && (
            <SsoCard
              key={`sso-${data.policy.updatedAt}-${data.policy.sso.lastTestAt ?? ''}`}
              sso={data.policy.sso}
              disabled={!canAdmin}
              busy={busy}
              onSave={(sso) => actor && run(() => service.saveAuthPolicy(propertyId, { sso }, actor))}
              onTest={() => actor && run(() => service.testSso(propertyId, actor))}
            />
          )}
          <p className="text-xs text-ink/50 xl:col-span-2">
            Last changed {dateTime(data.policy.updatedAt)} by {data.policy.updatedBy}
          </p>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['active', 'Open'],
                ['user', 'Staff'],
                ['device', 'Devices and jobs'],
                ['revoked', 'Revoked'],
              ] as [SessionFilter, string][]
            ).map(([k, label]) => (
              <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                {label}
              </Chip>
            ))}
          </div>
          <Card title="Sessions" count={sessions.length} padded={false}>
            <DataTable
              rows={sessions}
              rowKey={(s) => s.id}
              empty={{ title: 'No sessions here' }}
              columns={[
                {
                  key: 'who',
                  header: 'Who',
                  cell: (s) => (
                    <div>
                      <p className="font-medium text-ink">
                        {s.userName} {s.userId === user?.id && <Badge tone="brand">You</Badge>}
                      </p>
                      <p className="text-xs text-ink/55">{s.kind === 'user' ? roleById(s.roleId)?.label : s.kind === 'device' ? 'Device' : 'Service job'}</p>
                    </div>
                  ),
                },
                { key: 'dev', header: 'Device', cell: (s) => s.deviceLabel },
                { key: 'ip', header: 'IP', hideBelow: 'lg', cell: (s) => <Mono>{s.ip}</Mono> },
                { key: 'start', header: 'Started', hideBelow: 'md', cell: (s) => dateTime(s.createdAt) },
                { key: 'seen', header: 'Last active', cell: (s) => timeAgo(s.lastSeenAt, now) },
                { key: 'mfa', header: 'MFA', hideBelow: 'sm', cell: (s) => (s.kind !== 'user' ? '-' : s.mfa ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>) },
                {
                  key: 'act',
                  header: '',
                  align: 'right',
                  cell: (s) =>
                    s.revokedAt ? (
                      <span className="text-xs text-ink/55">Revoked by {s.revokedBy}</span>
                    ) : canAdmin && s.userId !== user?.id ? (
                      <Button size="sm" variant="ghost" onClick={() => setRevoke(s)}>
                        Revoke
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>
          <Card title="Security events" count={data.events.length} padded={false}>
            <ul className="divide-y divide-ink/8 text-sm">
              {data.events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone={e.kind.includes('failed') || e.kind === 'device_revoked' || e.kind === 'session_revoked' ? 'warn' : 'neutral'}>{e.kind.replace(/_/g, ' ')}</Badge>
                    <span className="truncate text-ink/75">
                      {e.userName}: {e.detail}
                    </span>
                  </span>
                  <span className="text-xs text-ink/50">{timeAgo(e.at, now)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'devices' && (
        <Card title="Registered devices" count={data.devices.length} padded={false} actions={canAdmin ? <Button size="sm" onClick={() => setAdding(true)}>Register device</Button> : undefined}>
          <DataTable
            rows={data.devices}
            rowKey={(d) => d.id}
            empty={{ title: 'No devices registered' }}
            columns={[
              {
                key: 'name',
                header: 'Device',
                cell: (d) => (
                  <div>
                    <p className="font-medium text-ink">{d.name}</p>
                    <p className="text-xs text-ink/55">{KIND_LABEL[d.kind]}</p>
                  </div>
                ),
              },
              { key: 'serial', header: 'Serial', hideBelow: 'md', cell: (d) => <Mono>{d.serial}</Mono> },
              { key: 'loc', header: 'Location', hideBelow: 'lg', cell: (d) => d.location },
              { key: 'seen', header: 'Last seen', hideBelow: 'md', cell: (d) => (d.lastSeenAt ? timeAgo(d.lastSeenAt, now) : '-') },
              { key: 'status', header: 'Status', cell: (d) => <Badge tone={STATUS_TONE[d.status]} dot>{STATUS_LABEL[d.status]}</Badge> },
              {
                key: 'act',
                header: '',
                align: 'right',
                cell: (d) =>
                  canAdmin ? (
                    <div className="flex justify-end gap-2">
                      {d.status !== 'approved' && (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => actor && run(() => service.setDeviceStatus(propertyId, d.id, 'approved', actor))}>
                          Approve
                        </Button>
                      )}
                      {d.status !== 'blocked' && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setBlock(d)}>
                          Block
                        </Button>
                      )}
                    </div>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}

      {tab === 'encryption' && (
        <Card title="Encryption and secrets" description="Reported by the platform. Read only." padded={false}>
          <ul className="divide-y divide-ink/8">
            {data.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${c.status === 'ok' ? 'bg-good' : c.status === 'warn' ? 'bg-warn' : 'bg-bad'}`}
                >
                  {c.status === 'ok' ? '✓' : '!'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{c.label}</p>
                  <p className="text-sm text-ink/60">{c.detail}</p>
                </div>
                <Badge tone={CHECK_TONE[c.status]}>{CHECK_LABEL[c.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {revoke && (
        <ConfirmDialog
          title="Revoke session"
          message={`${revoke.userName} is signed out of ${revoke.deviceLabel} at once.`}
          confirmLabel="Revoke"
          danger
          onCancel={() => setRevoke(null)}
          onConfirm={() => {
            const s = revoke
            setRevoke(null)
            if (actor) void run(() => service.revokeSession(propertyId, s.id, actor))
          }}
        />
      )}
      {block && (
        <ConfirmDialog
          title="Block device"
          message={`${block.name} (${block.serial}) stops working and its session ends.`}
          confirmLabel="Block"
          danger
          onCancel={() => setBlock(null)}
          onConfirm={() => {
            const d = block
            setBlock(null)
            if (actor) void run(() => service.setDeviceStatus(propertyId, d.id, 'blocked', actor))
          }}
        />
      )}
      {adding && (
        <DeviceDialog
          error={error}
          onClose={() => {
            clear()
            setAdding(false)
          }}
          onSave={async (input) => {
            if (!actor) return
            const ok = await run(() => service.registerDevice(propertyId, input, actor))
            if (ok) setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function PasswordCard({ policy, disabled, onSave }: { policy: AuthPolicy; disabled: boolean; onSave: (patch: Partial<AuthPolicy>) => void }) {
  const [pw, setPw] = useState(policy.password)
  const [timeout, setTimeoutMins] = useState(policy.sessionTimeoutMins)
  const [max, setMax] = useState(policy.maxSessions)
  const num = (v: string) => (v === '' ? 0 : Number(v))
  return (
    <Card title="Passwords and sessions" actions={!disabled ? <Button size="sm" onClick={() => onSave({ password: pw, sessionTimeoutMins: timeout, maxSessions: max })}>Save</Button> : undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Minimum length">{(id) => <Input id={id} type="number" min={8} value={pw.minLength} disabled={disabled} onChange={(e) => setPw({ ...pw, minLength: num(e.target.value) })} />}</Field>
        <Field label="Lock after failed tries">{(id) => <Input id={id} type="number" min={3} value={pw.lockAfter} disabled={disabled} onChange={(e) => setPw({ ...pw, lockAfter: num(e.target.value) })} />}</Field>
        <Field label="Expire after (days)" hint="0 = never">{(id) => <Input id={id} type="number" min={0} value={pw.expiryDays} disabled={disabled} onChange={(e) => setPw({ ...pw, expiryDays: num(e.target.value) })} />}</Field>
        <Field label="Sign out after idle (minutes)">{(id) => <Input id={id} type="number" min={5} value={timeout} disabled={disabled} onChange={(e) => setTimeoutMins(num(e.target.value))} />}</Field>
        <Field label="Sessions per person">{(id) => <Input id={id} type="number" min={1} value={max} disabled={disabled} onChange={(e) => setMax(num(e.target.value))} />}</Field>
        <div className="space-y-3 pt-1 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink/80">Needs a number</span>
            <Switch label="Needs a number" on={pw.requireNumber} disabled={disabled} onChange={(v) => setPw({ ...pw, requireNumber: v })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink/80">Needs a symbol</span>
            <Switch label="Needs a symbol" on={pw.requireSymbol} disabled={disabled} onChange={(v) => setPw({ ...pw, requireSymbol: v })} />
          </label>
        </div>
      </div>
    </Card>
  )
}

function MfaCard({ policy, disabled, onSave }: { policy: AuthPolicy; disabled: boolean; onSave: (mfa: AuthPolicy['mfa']) => void }) {
  const [mfa, setMfa] = useState(policy.mfa)
  const dirty = HOTEL_ROLES.some((r) => mfa[r.id] !== policy.mfa[r.id])
  return (
    <Card title="Two-step sign-in (MFA)" padded={false} actions={!disabled && dirty ? <Button size="sm" onClick={() => onSave(mfa)}>Save</Button> : undefined}>
      <ul className="divide-y divide-ink/8">
        {HOTEL_ROLES.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span className="text-sm font-medium text-ink">{r.label}</span>
            {disabled ? (
              <Badge tone={mfa[r.id] === 'required' ? 'good' : mfa[r.id] === 'optional' ? 'info' : 'neutral'}>{mfa[r.id]}</Badge>
            ) : (
              <Segmented<MfaMode>
                label={`MFA for ${r.label}`}
                value={mfa[r.id]}
                onChange={(v) => setMfa({ ...mfa, [r.id]: v })}
                options={[
                  { key: 'off', label: 'Off' },
                  { key: 'optional', label: 'Optional' },
                  { key: 'required', label: 'Required' },
                ]}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function SsoCard({ sso, disabled, busy, onSave, onTest }: { sso: SsoSettings; disabled: boolean; busy: boolean; onSave: (s: SsoSettings) => void; onTest: () => void }) {
  const [form, setForm] = useState(sso)
  const off = form.protocol === 'none'
  return (
    <Card
      title="Single sign-on"
      className="xl:col-span-2"
      actions={
        !disabled ? (
          <>
            <Button size="sm" variant="ghost" disabled={busy || off} onClick={onTest}>
              {busy ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onSave(form)}>
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Protocol">
          {(id) => (
            <Select id={id} value={form.protocol} disabled={disabled} onChange={(e) => setForm({ ...form, protocol: e.target.value as SsoSettings['protocol'] })}>
              <option value="none">Off</option>
              <option value="oidc">OpenID Connect (OIDC)</option>
              <option value="saml">SAML 2.0</option>
            </Select>
          )}
        </Field>
        <Field label="Staff email domain">{(id) => <Input id={id} value={form.domain} disabled={disabled || off} placeholder="lakeviewhotels.co.ug" onChange={(e) => setForm({ ...form, domain: e.target.value })} />}</Field>
        <Field label={form.protocol === 'saml' ? 'IdP metadata URL' : 'Issuer URL'}>
          {(id) => <Input id={id} value={form.issuerUrl} disabled={disabled || off} placeholder="https://" onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })} />}
        </Field>
        <Field label={form.protocol === 'saml' ? 'Entity id' : 'Client id'}>{(id) => <Input id={id} value={form.clientId} disabled={disabled || off} onChange={(e) => setForm({ ...form, clientId: e.target.value })} />}</Field>
        <Field label={form.protocol === 'saml' ? 'Certificate (secret reference)' : 'Client secret (secret reference)'} hint="vault://… - the value stays in the vault">
          {(id) => <Input id={id} value={form.secretRef} disabled={disabled || off} placeholder="vault://gastora/…" onChange={(e) => setForm({ ...form, secretRef: e.target.value })} />}
        </Field>
        <div className="flex items-end">
          {sso.lastTestAt ? (
            <p className="text-sm">
              <Badge tone={sso.lastTestOk ? 'good' : 'bad'} dot>
                {sso.lastTestOk ? 'Test passed' : 'Test failed'}
              </Badge>{' '}
              <span className="text-ink/60">
                {sso.lastTestMessage} {dateTime(sso.lastTestAt)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-ink/50">Not tested yet</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function DeviceDialog({ onClose, onSave, error }: { onClose: () => void; onSave: (d: NewDevice) => void; error: string | null }) {
  const [d, setD] = useState<NewDevice>({ name: '', kind: 'pos', serial: '', location: '' })
  return (
    <Modal
      title="Register device"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(d)}>Register</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Name" required>{(id) => <Input id={id} value={d.name} placeholder="POS-Restaurant-02" onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as DeviceKind })}>
              {(Object.keys(KIND_LABEL) as DeviceKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Serial number" required>{(id) => <Input id={id} value={d.serial} onChange={(e) => setD({ ...d, serial: e.target.value })} />}</Field>
        <Field label="Location">{(id) => <Input id={id} value={d.location} placeholder="Lake restaurant" onChange={(e) => setD({ ...d, location: e.target.value })} />}</Field>
      </div>
    </Modal>
  )
}
