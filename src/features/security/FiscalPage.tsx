import { useState } from 'react'
import { Link } from 'react-router-dom'
import Switch from '../../components/Switch'
import { Badge, Button, Card, Chip, DataTable, Field, Input, Modal, PageHeader, Select, StatCard } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { dateTime, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import type { SecurityService } from '../../services/security/securityService'
import type { ConnectorStatus, FiscalConnector, FiscalDevice, SubmissionStatus } from '../../services/security/securityTypes'
import { ErrorBanner, Mono, ReadOnly } from './parts'
import { useAction, useSecurityActor, useSecurityData } from './useSecurity'

const CONNECTOR: Record<ConnectorStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'good' },
  configured: { label: 'Set up, off', tone: 'warn' },
  template: { label: 'Template', tone: 'neutral' },
}
const SUB: Record<SubmissionStatus, { label: string; tone: Tone }> = {
  accepted: { label: 'Accepted', tone: 'good' },
  pending: { label: 'Waiting', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
}

const load = async (s: SecurityService, p: string) => {
  const [connectors, devices, submissions] = await Promise.all([s.listConnectors(p), s.listFiscalDevices(p), s.listSubmissions(p)])
  return { connectors, devices, submissions }
}

export default function FiscalPage() {
  const { features, tenant, tax } = useFeatures()
  const { canOpen, role } = useAuth()
  const { reservations } = useHotel()
  const { actor, canAdmin, propertyId, service } = useSecurityActor()
  const { data, error: loadError } = useSecurityData(load)
  const { run, error, clear, busy } = useAction()
  const [filter, setFilter] = useState<SubmissionStatus | 'all'>('all')
  const [configure, setConfigure] = useState<FiscalConnector | null>(null)
  const [device, setDevice] = useState<(Partial<FiscalDevice> & { connectorId: string }) | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!data) return <div className="space-y-5"><PageHeader title="Fiscal connectors" /><ErrorBanner message={loadError} /></div>

  // A small hotel gets EFRIS only; the framework with other countries' templates is on larger plans.
  const connectors = features.fiscalConnectors ? data.connectors : data.connectors.filter((c) => c.code === 'URA_EFRIS')
  const active = data.connectors.find((c) => c.status === 'active')
  const counts = { accepted: 0, pending: 0, failed: 0 } as Record<SubmissionStatus, number>
  for (const s of data.submissions) counts[s.status] += 1
  const subs = data.submissions.filter((s) => filter === 'all' || s.status === filter)
  const canSend = role ? ['owner', 'admin', 'finance'].includes(role.id) : false
  const invoices = reservations.filter((r) => r.invoice && r.invoice.fiscal !== 'exempt')
  const unsent = invoices.filter((r) => !data.submissions.some((s) => s.invoiceNo === r.invoice!.number))
  const efrisTax = tax?.efris

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Fiscal connectors"
        description="E-invoicing connectors, device mapping and what went to the tax authority."
        meta={!canAdmin ? <ReadOnly /> : undefined}
        actions={
          features.taxLines && canOpen('/admin/taxes') ? (
            <Link to="/admin/taxes" className="inline-flex items-center rounded-lg border border-ink/15 bg-surface px-4 py-2 text-sm font-semibold text-ink/75 hover:bg-canvas">
              Tax rates and EFRIS status
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active connector" icon="check" value={active?.name ?? 'None'} hint={active ? `${active.country}, ${active.mode}` : 'Invoices are not sent'} tone={active ? 'good' : 'warn'} />
        <StatCard label="Accepted" icon="list" value={counts.accepted} hint="With a fiscal code" onClick={() => setFilter('accepted')} active={filter === 'accepted'} />
        <StatCard label="Waiting" icon="calendar" value={counts.pending + unsent.length} hint={`${unsent.length} not sent yet`} tone={counts.pending + unsent.length ? 'warn' : 'default'} onClick={() => setFilter('pending')} active={filter === 'pending'} />
        <StatCard label="Failed" icon="alert" value={counts.failed} tone={counts.failed ? 'bad' : 'good'} hint="Retry from the log" onClick={() => setFilter('failed')} active={filter === 'failed'} />
      </div>

      <ErrorBanner message={error} onClose={clear} />
      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg bg-good/10 px-3 py-2 text-sm text-good">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <Card title="Connectors" count={connectors.length} padded={false}>
        <ul className="divide-y divide-ink/8">
          {connectors.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {c.name}
                  <span className="text-xs font-normal text-ink/55">{c.country}</span>
                  <Badge tone={CONNECTOR[c.status].tone} dot>
                    {CONNECTOR[c.status].label}
                  </Badge>
                  {c.status !== 'template' && <Badge>{c.mode}</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-ink/55">
                  {c.lastTestAt ? (
                    <span className={c.lastTestOk ? 'text-good' : 'text-bad'}>
                      {c.lastTestOk ? 'Test passed' : 'Test failed'}: {c.lastTestMessage} · {dateTime(c.lastTestAt)}
                    </span>
                  ) : c.status === 'template' ? (
                    'Available'
                  ) : (
                    'Not tested'
                  )}
                </p>
              </div>
              {canAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfigure(c)}>
                    {c.status === 'template' ? 'Set up' : 'Settings'}
                  </Button>
                  {c.status !== 'template' && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => actor && run(() => service.testConnector(propertyId, c.id, actor))}>
                      Test connection
                    </Button>
                  )}
                  {c.status !== 'template' && (
                    <Switch label={`${c.name} on`} on={c.status === 'active'} disabled={busy} onChange={(v) => actor && run(() => service.setConnectorActive(propertyId, c.id, v, actor))} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Devices and branches"
        description={tenant.name}
        padded={false}
        actions={canAdmin ? <Button size="sm" variant="ghost" onClick={() => setDevice({ connectorId: data.connectors[0].id, active: true })}>Add mapping</Button> : undefined}
      >
        <DataTable
          rows={data.devices}
          rowKey={(d) => d.id}
          empty={{ title: 'No devices mapped' }}
          columns={[
            { key: 'l', header: 'Branch or outlet', cell: (d) => <span className="font-medium text-ink">{d.label}</span> },
            { key: 'c', header: 'Connector', hideBelow: 'md', cell: (d) => data.connectors.find((c) => c.id === d.connectorId)?.name },
            {
              key: 'd',
              header: 'Device',
              cell: (d) =>
                d.deviceNo ? (
                  <span className="flex items-center gap-2">
                    <Mono>{d.deviceNo}</Mono>
                    {efrisTax?.status === 'registered' && efrisTax.deviceNo && d.connectorId.endsWith('efris') && d.id === data.devices[0]?.id && efrisTax.deviceNo !== d.deviceNo && <Badge tone="warn">Differs from tax settings</Badge>}
                  </span>
                ) : (
                  <span className="text-ink/45">Not set</span>
                ),
            },
            { key: 'b', header: 'Branch code', hideBelow: 'sm', cell: (d) => (d.branchCode ? <Mono>{d.branchCode}</Mono> : '-') },
            { key: 't', header: 'TIN', hideBelow: 'lg', cell: (d) => d.tin || '-' },
            { key: 'a', header: '', cell: (d) => (d.active ? <Badge tone="good">On</Badge> : <Badge>Off</Badge>) },
            {
              key: 'e',
              header: '',
              align: 'right',
              cell: (d) =>
                canAdmin ? (
                  <Button size="sm" variant="ghost" onClick={() => setDevice(d)}>
                    Edit
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Card
        title="Submission log"
        count={subs.length}
        padded={false}
        actions={
          canSend ? (
            <Button
              size="sm"
              disabled={busy || unsent.length === 0}
              onClick={async () => {
                if (!actor) return
                const n = await run(() =>
                  service.submitInvoices(
                    propertyId,
                    unsent.map((r) => ({ invoiceNo: r.invoice!.number, reservationId: r.id, guestName: r.guest, amount: r.invoice!.amount })),
                    actor,
                  ),
                )
                if (n !== undefined) setNotice(`${n} invoice${n === 1 ? '' : 's'} sent to ${active?.name ?? 'the tax authority'}.`)
              }}
            >
              {unsent.length ? `Send ${unsent.length} new invoice${unsent.length === 1 ? '' : 's'}` : 'No new invoices'}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-2 border-b border-ink/10 px-4 py-3">
          {(['all', 'accepted', 'pending', 'failed'] as const).map((k) => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)} count={k === 'all' ? data.submissions.length : counts[k]}>
              {k === 'all' ? 'All' : SUB[k].label}
            </Chip>
          ))}
        </div>
        <DataTable
          rows={subs}
          rowKey={(s) => s.id}
          empty={{ title: 'Nothing sent yet' }}
          columns={[
            { key: 'i', header: 'Invoice', cell: (s) => <div><p className="font-medium text-ink">{s.invoiceNo}</p><p className="text-xs text-ink/55">{s.guestName}</p></div> },
            { key: 'a', header: 'Amount', align: 'right', cell: (s) => ugx(s.amount) },
            { key: 's', header: 'Status', cell: (s) => <Badge tone={SUB[s.status].tone} dot>{SUB[s.status].label}</Badge> },
            { key: 'n', header: 'Tries', hideBelow: 'md', align: 'right', cell: (s) => s.attempts },
            { key: 'd', header: 'Sent', hideBelow: 'md', cell: (s) => dateTime(s.submittedAt) },
            { key: 'f', header: 'Fiscal code / error', hideBelow: 'sm', cell: (s) => (s.fiscalCode ? <Mono>{s.fiscalCode}</Mono> : <span className={s.error ? 'text-bad' : 'text-warn'}>{s.error ?? 'Waiting for URA'}</span>) },
            {
              key: 'r',
              header: '',
              align: 'right',
              cell: (s) =>
                s.status !== 'accepted' && canSend ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => actor && run(() => service.retrySubmission(propertyId, s.id, actor))}>
                    Retry
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      {configure && (
        <ConnectorDialog
          connector={configure}
          error={error}
          onClose={() => {
            clear()
            setConfigure(null)
          }}
          onSave={async (patch) => {
            if (!actor) return
            const ok = await run(() => service.saveConnector(propertyId, configure.id, patch, actor))
            if (ok) setConfigure(null)
          }}
        />
      )}
      {device && (
        <DeviceMapDialog
          device={device}
          connectors={connectors.filter((c) => c.status !== 'template')}
          error={error}
          onClose={() => {
            clear()
            setDevice(null)
          }}
          onSave={async (d) => {
            if (!actor) return
            const ok = await run(() => service.saveFiscalDevice(propertyId, d, actor))
            if (ok) setDevice(null)
          }}
        />
      )}
    </div>
  )
}

function ConnectorDialog({
  connector,
  onClose,
  onSave,
  error,
}: {
  connector: FiscalConnector
  onClose: () => void
  onSave: (p: Pick<FiscalConnector, 'mode' | 'endpoint' | 'credentials'>) => void
  error: string | null
}) {
  const [mode, setMode] = useState(connector.mode)
  const [endpoint, setEndpoint] = useState(connector.endpoint)
  const [creds, setCreds] = useState(connector.credentials)
  return (
    <Modal
      title={connector.name}
      description={connector.country}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ mode, endpoint, credentials: creds })}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Environment">
          {(id) => (
            <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as FiscalConnector['mode'])}>
              <option value="sandbox">Sandbox (test)</option>
              <option value="production">Production</option>
            </Select>
          )}
        </Field>
        <Field label="Endpoint">{(id) => <Input id={id} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />}</Field>
        {creds.map((c, i) => (
          <Field key={c.label} label={`${c.label} (secret reference)`} hint={i === 0 ? 'vault://… - the value stays in the vault' : undefined}>
            {(id) => (
              <Input
                id={id}
                value={c.ref}
                placeholder="vault://gastora/…"
                onChange={(e) => setCreds(creds.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)))}
              />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  )
}

function DeviceMapDialog({
  device,
  connectors,
  onClose,
  onSave,
  error,
}: {
  device: Partial<FiscalDevice> & { connectorId: string }
  connectors: FiscalConnector[]
  onClose: () => void
  onSave: (d: Omit<FiscalDevice, 'id' | 'propertyId'> & { id?: string }) => void
  error: string | null
}) {
  const [d, setD] = useState({ label: '', deviceNo: '', branchCode: '', tin: '', active: true, ...device })
  return (
    <Modal
      title={device.id ? 'Edit mapping' : 'Add mapping'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ id: d.id, connectorId: d.connectorId, label: d.label, deviceNo: d.deviceNo, branchCode: d.branchCode, tin: d.tin, active: d.active })}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Branch or outlet" required>{(id) => <Input id={id} value={d.label} placeholder="Pool bar outlet" onChange={(e) => setD({ ...d, label: e.target.value })} />}</Field>
        <Field label="Connector">
          {(id) => (
            <Select id={id} value={d.connectorId} onChange={(e) => setD({ ...d, connectorId: e.target.value })}>
              {connectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Device number">{(id) => <Input id={id} value={d.deviceNo} placeholder="TCS-0044" onChange={(e) => setD({ ...d, deviceNo: e.target.value })} />}</Field>
          <Field label="Branch code">{(id) => <Input id={id} value={d.branchCode} onChange={(e) => setD({ ...d, branchCode: e.target.value })} />}</Field>
        </div>
        <Field label="TIN">{(id) => <Input id={id} value={d.tin} inputMode="numeric" onChange={(e) => setD({ ...d, tin: e.target.value })} />}</Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-ink/80">In use</span>
          <Switch label="In use" on={d.active} onChange={(v) => setD({ ...d, active: v })} />
        </label>
      </div>
    </Modal>
  )
}
