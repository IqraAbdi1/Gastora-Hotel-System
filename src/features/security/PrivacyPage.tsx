import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Chip, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { TabItem, Tone } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dateTime } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useNow } from '../../lib/useNow'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import type { SecurityService } from '../../services/security/securityService'
import type {
  Consent,
  ConsentPurpose,
  DataSubjectRequest,
  DataType,
  DsrKind,
  DsrStatus,
  Jurisdiction,
  NewDsr,
  RetentionPolicy,
} from '../../services/security/securityTypes'
import type { Guest } from '../../types'
import { shortDate } from './labels'
import { ErrorBanner, ReadOnly } from './parts'
import { downloadFile, useAction, useSecurityActor, useSecurityData } from './useSecurity'

type TabKey = 'requests' | 'consent' | 'retention' | 'data'

const PURPOSES: { key: ConsentPurpose; label: string; field?: 'marketingConsent' | 'loyaltyConsent' | 'sensitiveConsent' }[] = [
  { key: 'marketing', label: 'Marketing', field: 'marketingConsent' },
  { key: 'loyalty', label: 'Remember between stays', field: 'loyaltyConsent' },
  { key: 'sensitive', label: 'Health and access needs', field: 'sensitiveConsent' },
  { key: 'idCopy', label: 'Keep ID copy' },
]

const LAW_LABEL: Record<Jurisdiction, string> = { 'UG-DPPA-2019': 'Uganda DPPA 2019', 'EU-GDPR': 'EU GDPR' }
const KIND_LABEL: Record<DsrKind, string> = { access: 'Access', correction: 'Correction', deletion: 'Deletion' }
const STATUS: Record<DsrStatus, { label: string; tone: Tone }> = {
  received: { label: 'Received', tone: 'info' },
  verifying: { label: 'Checking identity', tone: 'warn' },
  'in-progress': { label: 'In progress', tone: 'brand' },
  completed: { label: 'Completed', tone: 'good' },
  rejected: { label: 'Refused', tone: 'neutral' },
}
const NEXT: Partial<Record<DsrStatus, { to: DsrStatus; label: string }>> = {
  received: { to: 'verifying', label: 'Check identity' },
  verifying: { to: 'in-progress', label: 'Identity confirmed' },
  'in-progress': { to: 'completed', label: 'Mark completed' },
}
const DATA_LABEL: Record<DataType, string> = {
  guestProfile: 'Guest profiles',
  idDocuments: 'ID documents and scans',
  folios: 'Folios and invoices',
  cardTokens: 'Card tokens',
  cctv: 'CCTV footage',
  marketing: 'Marketing lists',
  auditLog: 'Audit log',
  staffRecords: 'Staff records',
}
const ACTION_LABEL: Record<RetentionPolicy['action'], string> = { delete: 'Delete', anonymise: 'Anonymise', archive: 'Archive' }

const load = async (s: SecurityService, p: string) => {
  const [consents, jurisdiction, retention, dsrs, tokens] = await Promise.all([s.listConsents(p), s.getJurisdiction(p), s.listRetentionPolicies(p), s.listDsrs(p), s.listCardTokens(p)])
  return { consents, jurisdiction, retention, dsrs, tokens }
}

const isOpen = (d: DataSubjectRequest) => d.status !== 'completed' && d.status !== 'rejected'
const daysLeft = (iso: string, now: number) => Math.ceil((Date.parse(iso) - now) / 86400000)

export default function PrivacyPage() {
  const { guests, reservations, updateGuest } = useHotel()
  const { tenant } = useFeatures()
  const { can } = useAuth()
  const now = useNow()
  const { actor, canAdmin, propertyId, service } = useSecurityActor()
  const { data, error: loadError } = useSecurityData(load)
  const { run, error, clear, busy } = useAction()

  const [tab, setTab] = useState<TabKey>('requests')
  const [show, setShow] = useState<'open' | 'all'>('open')
  const [openDsr, setOpenDsr] = useState<string | null>(null)
  const [newDsr, setNewDsr] = useState(false)
  const [consentEdit, setConsentEdit] = useState<{ guest: Guest; purpose: ConsentPurpose; granted: boolean } | null>(null)
  const [guestQ, setGuestQ] = useState('')
  const [law, setLaw] = useState<Jurisdiction | null>(null)
  const [editPolicy, setEditPolicy] = useState<RetentionPolicy | null>(null)
  const [guestId, setGuestId] = useState('')
  const [anonymise, setAnonymise] = useState<{ guest: Guest; dsr?: DataSubjectRequest } | null>(null)

  const latest = useMemo(() => {
    const m = new Map<string, Consent>()
    for (const c of data?.consents ?? []) {
      const k = `${c.guestId}|${c.purpose}`
      const prev = m.get(k)
      if (!prev || prev.at < c.at) m.set(k, c)
    }
    return m
  }, [data])

  if (!data) return <div className="space-y-5"><PageHeader title="Privacy" /><ErrorBanner message={loadError} /></div>

  const canWork = actor ? ['owner', 'admin', 'gm'].includes(actor.role) : false
  const canAnonymise = can('seeGuestRecord')
  const activeLaw = law ?? data.jurisdiction
  const open = data.dsrs.filter(isOpen)
  const dueSoon = open.filter((d) => daysLeft(d.dueAt, now) <= 7).length
  const marketingYes = guests.filter((g) => consentOf(g, 'marketing').granted).length
  const shownDsrs = show === 'open' ? open : data.dsrs
  const dsr = data.dsrs.find((d) => d.id === openDsr) ?? null
  const selectedGuest = guests.find((g) => g.id === (guestId || guests[0]?.id))

  function consentOf(g: Guest, purpose: ConsentPurpose): { granted: boolean; at?: string; source: string } {
    const c = latest.get(`${g.id}|${purpose}`)
    if (c) return { granted: c.granted, at: c.at, source: c.source }
    const field = PURPOSES.find((p) => p.key === purpose)?.field
    if (field && g[field] !== undefined) return { granted: !!g[field], at: g.consentAt, source: 'guest profile' }
    return { granted: false, source: 'not asked' }
  }

  const exportGuest = (g: Guest) => {
    const stays = reservations.filter((r) => r.guestId === g.id || (!r.guestId && r.guest === g.name))
    const payload = {
      exportedAt: new Date().toISOString(),
      property: tenant.name,
      law: LAW_LABEL[data.jurisdiction],
      guest: g,
      stays: stays.map((r) => ({ id: r.id, arrival: r.arrival, departure: r.departure, room: r.room, roomType: r.roomType, status: r.status, total: r.total, paid: r.paid, charges: r.charges ?? [], payments: r.payments ?? [], invoice: r.invoice })),
      consents: data.consents.filter((c) => c.guestId === g.id),
      cardsOnFile: data.tokens.filter((t) => t.guestId === g.id).map((t) => ({ brand: t.brand, last4: t.last4, expiry: t.expiry })),
      privacyRequests: data.dsrs.filter((d) => d.guestId === g.id),
    }
    downloadFile(`guest-data-${g.id}-${TODAY}.json`, JSON.stringify(payload, null, 2), 'application/json')
    if (actor) void service.recordExport(propertyId, `Guest data export for ${g.name}`, actor)
  }

  const doAnonymise = async (g: Guest, linked?: DataSubjectRequest) => {
    if (!actor) return
    const ok = await run(async () => {
      await service.recordAnonymised(propertyId, g.id, g.name, actor)
      updateGuest(g.id, {
        name: 'Anonymised guest',
        phone: '',
        email: undefined,
        nationality: undefined,
        dateOfBirth: undefined,
        gender: undefined,
        address: undefined,
        idType: undefined,
        idNumber: undefined,
        vip: false,
        marketingConsent: false,
        loyaltyConsent: false,
        sensitiveConsent: false,
        preferences: undefined,
        notes: [],
        links: [],
      })
      if (linked && isOpen(linked)) await service.advanceDsr(propertyId, linked.id, 'completed', 'Guest anonymised. Folios kept for tax.', actor)
      return true
    })
    if (ok) setAnonymise(null)
  }

  const tabs: TabItem<TabKey>[] = [
    { key: 'requests', label: 'Requests', count: open.length, alert: dueSoon > 0 },
    { key: 'consent', label: 'Consent' },
    { key: 'retention', label: 'Retention' },
    { key: 'data', label: 'Guest data' },
  ]
  const filteredGuests = guests.filter((g) => !guestQ.trim() || g.name.toLowerCase().includes(guestQ.trim().toLowerCase()))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Privacy"
        description={`Consent, retention and guests' requests under ${LAW_LABEL[data.jurisdiction]}.`}
        meta={!canWork ? <ReadOnly /> : undefined}
        actions={canWork ? <Button onClick={() => setNewDsr(true)}>New request</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open requests" icon="tasks" value={open.length} hint={`${data.dsrs.length} in total`} onClick={() => setTab('requests')} />
        <StatCard label="Due within 7 days" icon="alert" value={dueSoon} tone={dueSoon ? 'bad' : 'good'} hint="Answer within 30 days" />
        <StatCard label="Marketing consent" icon="guests" value={`${marketingYes}/${guests.length}`} hint="Guests who said yes" onClick={() => setTab('consent')} />
        <StatCard label="Law applied" icon="list" value={data.jurisdiction === 'UG-DPPA-2019' ? 'Uganda' : 'EU'} hint={LAW_LABEL[data.jurisdiction]} onClick={() => setTab('retention')} />
      </div>

      <ErrorBanner message={error} onClose={clear} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Privacy sections" />

      {tab === 'requests' && (
        <Card
          title="Data-subject requests"
          count={shownDsrs.length}
          padded={false}
          actions={<Segmented label="Show" value={show} onChange={setShow} options={[{ key: 'open', label: 'Open' }, { key: 'all', label: 'All' }]} />}
        >
          <DataTable
            rows={shownDsrs}
            rowKey={(d) => d.id}
            onRowClick={(d) => setOpenDsr(d.id)}
            empty={{ title: 'No open requests' }}
            columns={[
              { key: 'id', header: 'Request', cell: (d) => <div><p className="font-medium text-ink">{d.guestName}</p><p className="text-xs text-ink/55">{d.id}</p></div> },
              { key: 'k', header: 'Kind', cell: (d) => <Badge tone={d.kind === 'deletion' ? 'bad' : d.kind === 'access' ? 'info' : 'warn'}>{KIND_LABEL[d.kind]}</Badge> },
              { key: 'r', header: 'Received', hideBelow: 'md', cell: (d) => shortDate(d.receivedAt) },
              {
                key: 'due',
                header: 'Due',
                cell: (d) => {
                  if (!isOpen(d)) return <span className="text-ink/55">{d.closedAt ? shortDate(d.closedAt) : '-'}</span>
                  const left = daysLeft(d.dueAt, now)
                  return <Badge tone={left < 0 ? 'bad' : left <= 7 ? 'warn' : 'neutral'}>{left < 0 ? `${-left} days late` : `${left} days`}</Badge>
                },
              },
              { key: 's', header: 'Status', cell: (d) => <Badge tone={STATUS[d.status].tone} dot>{STATUS[d.status].label}</Badge> },
            ]}
          />
        </Card>
      )}

      {tab === 'consent' && (
        <Card
          title="Consent by guest"
          padded={false}
          actions={<Input aria-label="Find a guest" placeholder="Find a guest" value={guestQ} onChange={(e) => setGuestQ(e.target.value)} className="w-48 py-1.5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-canvas/50">
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-ink/55">
                    Guest
                  </th>
                  {PURPOSES.map((p) => (
                    <th key={p.key} scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-ink/55">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {filteredGuests.map((g) => (
                  <tr key={g.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">{g.name}</td>
                    {PURPOSES.map((p) => {
                      const c = consentOf(g, p.key)
                      return (
                        <td key={p.key} className="whitespace-nowrap px-3 py-2">
                          <button
                            type="button"
                            disabled={!actor}
                            onClick={() => setConsentEdit({ guest: g, purpose: p.key, granted: !c.granted })}
                            className="text-left"
                            aria-label={`${p.label} for ${g.name}: ${c.granted ? 'given' : 'not given'}`}
                          >
                            <Badge tone={c.granted ? 'good' : c.source === 'not asked' ? 'neutral' : 'warn'}>{c.granted ? 'Given' : c.source === 'not asked' ? 'Not asked' : 'No'}</Badge>
                            <span className="ml-2 text-xs text-ink/45">{c.at ? shortDate(c.at) : ''}</span>
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
      )}

      {tab === 'retention' && (
        <Card
          title="How long data is kept"
          padded={false}
          actions={
            <>
              <Segmented<Jurisdiction>
                label="Law"
                value={activeLaw}
                onChange={setLaw}
                options={[
                  { key: 'UG-DPPA-2019', label: 'Uganda' },
                  { key: 'EU-GDPR', label: 'EU GDPR' },
                ]}
              />
              {activeLaw === data.jurisdiction ? (
                <Badge tone="good">Applied</Badge>
              ) : canAdmin ? (
                <Button size="sm" disabled={busy} onClick={() => actor && run(() => service.setJurisdiction(propertyId, activeLaw, actor))}>
                  Apply this law
                </Button>
              ) : null}
            </>
          }
        >
          <DataTable
            rows={data.retention.filter((r) => r.jurisdiction === activeLaw)}
            rowKey={(r) => r.id}
            columns={[
              { key: 't', header: 'Data', cell: (r) => <span className="font-medium text-ink">{DATA_LABEL[r.dataType]}</span> },
              { key: 'k', header: 'Keep', cell: (r) => (r.keepMonths >= 12 && r.keepMonths % 12 === 0 ? `${r.keepMonths / 12} yr` : `${r.keepMonths} mo`) },
              { key: 'a', header: 'Then', cell: (r) => <Badge tone={r.action === 'delete' ? 'bad' : r.action === 'anonymise' ? 'warn' : 'neutral'}>{ACTION_LABEL[r.action]}</Badge> },
              { key: 'b', header: 'Basis', hideBelow: 'md', cell: (r) => <span className="text-ink/60">{r.legalBasis}</span> },
              {
                key: 'e',
                header: '',
                align: 'right',
                cell: (r) =>
                  canAdmin ? (
                    <Button size="sm" variant="ghost" onClick={() => setEditPolicy(r)}>
                      Edit
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}

      {tab === 'data' && selectedGuest && (
        <Card
          title="A guest's data"
          actions={
            <Select aria-label="Guest" value={selectedGuest.id} onChange={(e) => setGuestId(e.target.value)} className="w-auto py-1.5">
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          }
        >
          <GuestSummary
            guest={selectedGuest}
            stays={reservations.filter((r) => r.guestId === selectedGuest.id || (!r.guestId && r.guest === selectedGuest.name)).length}
            consents={data.consents.filter((c) => c.guestId === selectedGuest.id).length}
            cards={data.tokens.filter((t) => t.guestId === selectedGuest.id).length}
            requests={data.dsrs.filter((d) => d.guestId === selectedGuest.id).length}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportGuest(selectedGuest)}>
              Download JSON
            </Button>
            <Link to={`/desk/guests/${selectedGuest.id}`} className="inline-flex items-center rounded-lg px-3 text-sm font-semibold text-brand hover:underline">
              Open profile
            </Link>
            {canAnonymise && selectedGuest.name !== 'Anonymised guest' && (
              <Button variant="danger" onClick={() => setAnonymise({ guest: selectedGuest })}>
                Anonymise
              </Button>
            )}
          </div>
        </Card>
      )}

      {dsr && (
        <DsrPanel
          dsr={dsr}
          now={now}
          canWork={canWork}
          canAnonymise={canAnonymise}
          busy={busy}
          error={error}
          guest={guests.find((g) => g.id === dsr.guestId)}
          onClose={() => {
            clear()
            setOpenDsr(null)
          }}
          onAdvance={(status, note) => actor && run(() => service.advanceDsr(propertyId, dsr.id, status, note, actor))}
          onExport={(g) => exportGuest(g)}
          onAnonymise={(g) => setAnonymise({ guest: g, dsr })}
        />
      )}

      {newDsr && (
        <NewDsrDialog
          guests={guests}
          error={error}
          onClose={() => {
            clear()
            setNewDsr(false)
          }}
          onSave={async (input) => {
            if (!actor) return
            const d = await run(() => service.createDsr(propertyId, input, actor))
            if (d) {
              setNewDsr(false)
              setTab('requests')
              setOpenDsr(d.id)
            }
          }}
        />
      )}

      {consentEdit && (
        <ConsentDialog
          {...consentEdit}
          error={error}
          onClose={() => {
            clear()
            setConsentEdit(null)
          }}
          onSave={async (granted, source) => {
            if (!actor) return
            const { guest, purpose } = consentEdit
            const ok = await run(() => service.recordConsent(propertyId, { guestId: guest.id, guestName: guest.name, purpose, granted, source }, actor))
            if (!ok) return
            const field = PURPOSES.find((p) => p.key === purpose)?.field
            if (field) updateGuest(guest.id, { [field]: granted, consentAt: new Date().toISOString() })
            setConsentEdit(null)
          }}
        />
      )}

      {editPolicy && (
        <PolicyDialog
          policy={editPolicy}
          error={error}
          onClose={() => {
            clear()
            setEditPolicy(null)
          }}
          onSave={async (patch) => {
            if (!actor) return
            const ok = await run(() => service.saveRetentionPolicy(propertyId, editPolicy.id, patch, actor))
            if (ok) setEditPolicy(null)
          }}
        />
      )}

      {anonymise && (
        <ConfirmDialog
          title={`Anonymise ${anonymise.guest.name}?`}
          message="Name, contacts, ID, preferences, notes and cards on file are removed for good. Folios stay, under 'Anonymised guest', for tax."
          confirmLabel="Anonymise"
          danger
          onCancel={() => setAnonymise(null)}
          onConfirm={() => void doAnonymise(anonymise.guest, anonymise.dsr)}
        />
      )}
    </div>
  )
}

function GuestSummary({ guest, stays, consents, cards, requests }: { guest: Guest; stays: number; consents: number; cards: number; requests: number }) {
  const held = [
    ['Phone', guest.phone],
    ['Email', guest.email],
    ['Nationality', guest.nationality],
    ['Date of birth', guest.dateOfBirth],
    ['Address', guest.address],
    ['ID', guest.idType ? `${guest.idType} on file` : undefined],
    ['Notes', guest.notes?.length ? `${guest.notes.length}` : undefined],
  ].filter(([, v]) => v) as [string, string][]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <dl className="space-y-2 text-sm">
        {held.length === 0 && <p className="text-ink/55">No personal details held.</p>}
        {held.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-ink/55">{k}</dt>
            <dd className="truncate text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(
          [
            ['Stays', stays],
            ['Consent records', consents],
            ['Cards on file', cards],
            ['Privacy requests', requests],
          ] as [string, number][]
        ).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-canvas px-3 py-2">
            <p className="text-xs text-ink/55">{k}</p>
            <p className="text-lg font-bold text-ink">{v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DsrPanel({
  dsr,
  now,
  canWork,
  canAnonymise,
  busy,
  error,
  guest,
  onClose,
  onAdvance,
  onExport,
  onAnonymise,
}: {
  dsr: DataSubjectRequest
  now: number
  canWork: boolean
  canAnonymise: boolean
  busy: boolean
  error: string | null
  guest?: Guest
  onClose: () => void
  onAdvance: (status: DsrStatus, note: string) => void
  onExport: (g: Guest) => void
  onAnonymise: (g: Guest) => void
}) {
  const [note, setNote] = useState('')
  const next = NEXT[dsr.status]
  const left = daysLeft(dsr.dueAt, now)
  const working = canWork && isOpen(dsr)
  return (
    <Modal title={`${KIND_LABEL[dsr.kind]} request: ${dsr.guestName}`} description={`${dsr.id} · ${LAW_LABEL[dsr.jurisdiction]}`} side onClose={onClose}>
      <div className="space-y-4 text-sm">
        <ErrorBanner message={error} />
        <div className="flex flex-wrap gap-2">
          <Badge tone={STATUS[dsr.status].tone} dot>
            {STATUS[dsr.status].label}
          </Badge>
          {isOpen(dsr) && <Badge tone={left < 0 ? 'bad' : left <= 7 ? 'warn' : 'neutral'}>Due {shortDate(dsr.dueAt)}</Badge>}
          <Badge>{dsr.channel}</Badge>
        </div>
        <p className="rounded-lg bg-canvas p-3 text-ink/80">{dsr.details}</p>

        {working && guest && (
          <div className="flex flex-wrap gap-2">
            {dsr.kind === 'access' && (
              <Button size="sm" variant="secondary" onClick={() => onExport(guest)}>
                Download guest data
              </Button>
            )}
            {dsr.kind === 'correction' && (
              <Link to={`/desk/guests/${guest.id}`} className="text-sm font-semibold text-brand hover:underline">
                Correct the profile
              </Link>
            )}
            {dsr.kind === 'deletion' && canAnonymise && dsr.status === 'in-progress' && (
              <Button size="sm" variant="danger" onClick={() => onAnonymise(guest)}>
                Anonymise guest
              </Button>
            )}
          </div>
        )}

        {working && (
          <div className="space-y-2">
            <Field label="Note">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Identity checked against passport" />}</Field>
            <div className="flex flex-wrap gap-2">
              {next && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    onAdvance(next.to, note)
                    setNote('')
                  }}
                >
                  {next.label}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  onAdvance('rejected', note)
                }}
              >
                Refuse
              </Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">History</h3>
          <ol className="space-y-2">
            {dsr.history.map((h, i) => (
              <li key={i} className="border-l-2 border-ink/10 pl-3">
                <p className="text-ink">{h.text}</p>
                <p className="text-xs text-ink/50">
                  {h.by} · {dateTime(h.at)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}

function NewDsrDialog({ guests, onClose, onSave, error }: { guests: Guest[]; onClose: () => void; onSave: (input: NewDsr) => void; error: string | null }) {
  const [input, setInput] = useState<NewDsr>({ guestId: '', guestName: '', kind: 'access', channel: 'email', details: '' })
  return (
    <Modal
      title="New privacy request"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(input)}>Log request</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Guest" required>
          {(id) => (
            <Select id={id} value={input.guestId} onChange={(e) => setInput({ ...input, guestId: e.target.value, guestName: guests.find((g) => g.id === e.target.value)?.name ?? '' })}>
              <option value="">Choose a guest</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABEL) as DsrKind[]).map((k) => (
            <Chip key={k} active={input.kind === k} onClick={() => setInput({ ...input, kind: k })}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        <Field label="Received by">
          {(id) => (
            <Select id={id} value={input.channel} onChange={(e) => setInput({ ...input, channel: e.target.value as NewDsr['channel'] })}>
              <option value="email">Email</option>
              <option value="in person">In person</option>
              <option value="phone">Phone</option>
              <option value="guest portal">Guest page</option>
            </Select>
          )}
        </Field>
        <Field label="What they asked" required>{(id) => <Textarea id={id} rows={3} value={input.details} onChange={(e) => setInput({ ...input, details: e.target.value })} />}</Field>
      </div>
    </Modal>
  )
}

function ConsentDialog({
  guest,
  purpose,
  granted: initial,
  onClose,
  onSave,
  error,
}: {
  guest: Guest
  purpose: ConsentPurpose
  granted: boolean
  onClose: () => void
  onSave: (granted: boolean, source: Consent['source']) => void
  error: string | null
}) {
  const [granted, setGranted] = useState(initial)
  const [source, setSource] = useState<Consent['source']>('staff')
  const label = PURPOSES.find((p) => p.key === purpose)?.label ?? purpose
  return (
    <Modal
      title={`${label}: ${guest.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(granted, source)}>Record</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Segmented<'yes' | 'no'>
          label="Consent"
          value={granted ? 'yes' : 'no'}
          onChange={(v) => setGranted(v === 'yes')}
          options={[
            { key: 'yes', label: 'Given' },
            { key: 'no', label: 'Withdrawn' },
          ]}
        />
        <Field label="How the guest told us">
          {(id) => (
            <Select id={id} value={source} onChange={(e) => setSource(e.target.value as Consent['source'])}>
              <option value="staff">In person, to staff</option>
              <option value="check-in form">Check-in form</option>
              <option value="email">Email</option>
              <option value="guest portal">Guest page</option>
              <option value="booking page">Booking page</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}

function PolicyDialog({ policy, onClose, onSave, error }: { policy: RetentionPolicy; onClose: () => void; onSave: (p: Pick<RetentionPolicy, 'keepMonths' | 'action'>) => void; error: string | null }) {
  const [months, setMonths] = useState(String(policy.keepMonths))
  const [action, setAction] = useState(policy.action)
  return (
    <Modal
      title={DATA_LABEL[policy.dataType]}
      description={LAW_LABEL[policy.jurisdiction]}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ keepMonths: Number(months), action })}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Keep for (months)">{(id) => <Input id={id} type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />}</Field>
        <Field label="Then">
          {(id) => (
            <Select id={id} value={action} onChange={(e) => setAction(e.target.value as RetentionPolicy['action'])}>
              <option value="delete">Delete</option>
              <option value="anonymise">Anonymise</option>
              <option value="archive">Archive</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
