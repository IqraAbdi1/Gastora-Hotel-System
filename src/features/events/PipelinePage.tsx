import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Badge, Button, Chip, Field, Input, Modal, PageHeader, Select, StatCard, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { USERS } from '../../lib/roles'
import { LOST_REASONS, STAGES, STAGE_LABEL } from '../../services/events/eventsRules'
import type { Lead, LeadInput, LeadStage } from '../../services/events/eventsTypes'
import { useCorporate } from '../corporate/corporateContext'
import { useFeatures } from '../platform/featuresContext'
import { ErrorNote } from './ErrorNote'
import { EVENT_TYPES, EVENT_TYPE_LABEL, STAGE_DOT, STAGE_TONE, addDays, num, sectionHeading, stampText, ugxShort } from './eventsUi'
import { useEvents, useRun } from './useEvents'

// /events. A hotel without the sales feature starts at the diary instead.
export default function EventsHome() {
  const { features } = useFeatures()
  if (!features.eventsSales) return <Navigate to="/events/diary" replace />
  return <PipelinePage />
}

const SELLERS = USERS.filter((u) => ['sales', 'gm', 'owner'].includes(u.role))

function PipelinePage() {
  const { data, actor, service } = useEvents()
  const [mine, setMine] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [losing, setLosing] = useState<Lead | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const { error, setError, run } = useRun()

  const leads = useMemo(
    () =>
      data.leads.filter(
        (l) =>
          (!mine || l.ownerId === actor.id) &&
          (!query.trim() || `${l.title} ${l.clientName} ${l.contactName}`.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [data.leads, mine, actor.id, query],
  )
  const open = data.leads.find((l) => l.id === openId)
  const active = data.leads.filter((l) => l.stage !== 'lost' && l.stage !== 'definite')
  const pipeline = active.reduce((s, l) => s + l.estimatedValue, 0)
  const weighted = active.reduce((s, l) => s + Math.round((l.estimatedValue * l.probability) / 100), 0)
  const won = data.leads.filter((l) => l.stage === 'definite')
  const lost = data.leads.filter((l) => l.stage === 'lost')
  const conversion = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0

  const move = (lead: Lead, stage: LeadStage) => {
    if (lead.stage === stage) return
    if (stage === 'lost') return setLosing(lead)
    void run(() => service.moveLead(lead.id, stage, actor))
  }
  const onDrop = (e: DragEvent, stage: LeadStage) => {
    e.preventDefault()
    const lead = data.leads.find((l) => l.id === (dragId ?? e.dataTransfer.getData('text/plain')))
    setDragId(null)
    if (lead) move(lead, stage)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Events and sales"
        title="Pipeline"
        description="Conferences, weddings, meetings and corporate events, from enquiry to definite."
        actions={<Button onClick={() => setEditing('new')}>New lead</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open pipeline" value={ugxShort(pipeline)} hint={`${active.length} open leads`} icon="money" />
        <StatCard label="Weighted value" value={ugxShort(weighted)} hint="Value × probability" icon="occupancy" />
        <StatCard label="Definite" value={ugxShort(won.reduce((s, l) => s + l.estimatedValue, 0))} hint={`${won.length} events`} tone="good" icon="check" />
        <StatCard label="Conversion" value={`${conversion}%`} hint={`${lost.length} lost`} tone={conversion < 40 ? 'warn' : 'default'} icon="sparkles" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!mine} onClick={() => setMine(false)}>
          Everyone
        </Chip>
        <Chip active={mine} onClick={() => setMine(true)} count={data.leads.filter((l) => l.ownerId === actor.id).length}>
          Mine
        </Chip>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads" className="max-w-xs" aria-label="Search leads" />
      </div>

      <ErrorNote error={error} />

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {STAGES.map((stage) => {
            const list = leads.filter((l) => l.stage === stage).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
            const value = list.reduce((s, l) => s + l.estimatedValue, 0)
            return (
              <section
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage)}
                className={`flex min-h-[320px] flex-col rounded-xl border border-ink/10 bg-canvas/60 ${dragId ? 'ring-1 ring-brand/20' : ''}`}
                aria-label={STAGE_LABEL[stage]}
              >
                <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STAGE_DOT[stage]}`} aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-ink">{STAGE_LABEL[stage]}</h2>
                    <span className="rounded-full bg-ink/8 px-1.5 text-xs font-semibold text-ink/60">{list.length}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-ink/60">{ugxShort(value)}</span>
                </header>
                <ul className="flex-1 space-y-2 p-2">
                  {list.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          setDragId(l.id)
                          e.dataTransfer.setData('text/plain', l.id)
                        }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setOpenId(l.id)}
                        className="w-full rounded-lg border border-ink/10 bg-surface p-3 text-left shadow-[0_1px_2px_rgba(17,48,44,0.04)] hover:border-brand/50"
                      >
                        <p className="text-sm font-semibold text-ink">{l.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink/60">{l.clientName}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/65">
                          <span>{dayMonth(l.eventDate)}</span>
                          <span>{l.expectedGuests} pax</span>
                          <span>{EVENT_TYPE_LABEL[l.eventType]}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold tabular-nums text-ink">{ugxShort(l.estimatedValue)}</span>
                          <span className="text-xs font-semibold text-ink/55">{l.probability}%</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink/50">
                          <span>{l.ownerName}</span>
                          {l.stage === 'lost' && l.lostReason && <span className="font-semibold text-bad">{l.lostReason}</span>}
                          {l.stage !== 'lost' && l.stage !== 'definite' && l.eventDate < addDays(TODAY, 14) && (
                            <span className="font-semibold text-warn">Soon</span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                  {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink/45">No leads</li>}
                </ul>
              </section>
            )
          })}
        </div>
      </div>

      {editing && (
        <LeadForm
          lead={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(l) => {
            setEditing(null)
            setOpenId(l.id)
          }}
        />
      )}
      {open && !editing && !losing && (
        <LeadPanel
          lead={open}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing(open)}
          onMove={(stage) => move(open, stage)}
          error={error}
          clearError={() => setError(null)}
        />
      )}
      {losing && <LostDialog lead={losing} onClose={() => setLosing(null)} />}
    </div>
  )
}

function LeadPanel({
  lead,
  onClose,
  onEdit,
  onMove,
  error,
  clearError,
}: {
  lead: Lead
  onClose: () => void
  onEdit: () => void
  onMove: (s: LeadStage) => void
  error: string | null
  clearError: () => void
}) {
  const { data } = useEvents()
  const quotes = data.quotes.filter((q) => q.leadId === lead.id)
  const booking = data.bookings.find((b) => b.id === lead.eventBookingId)
  const close = () => {
    clearError()
    onClose()
  }
  return (
    <Modal title={lead.title} description={`${lead.clientName} · ${EVENT_TYPE_LABEL[lead.eventType]}`} onClose={close} side>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STAGE_TONE[lead.stage]} dot>
            {STAGE_LABEL[lead.stage]}
          </Badge>
          <Badge tone="neutral">{lead.probability}% likely</Badge>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Value" value={ugx(lead.estimatedValue)} />
          <Info label="Guests" value={String(lead.expectedGuests)} />
          <Info label="Dates" value={lead.eventDate === lead.endDate ? dayMonth(lead.eventDate) : `${dayMonth(lead.eventDate)} to ${dayMonth(lead.endDate)}`} />
          <Info label="Owner" value={lead.ownerName} />
          <Info label="Contact" value={`${lead.contactName}, ${lead.contactPhone}`} />
          <Info label="Source" value={lead.source || '—'} />
        </dl>
        {lead.lostReason && <p className="text-sm text-bad">Lost: {lead.lostReason}</p>}
        {lead.notes && <p className="text-sm text-ink/75">{lead.notes}</p>}

        <div>
          <p className={sectionHeading}>Move to</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAGES.filter((s) => s !== lead.stage).map((s) => (
              <Button key={s} size="sm" variant={s === 'lost' ? 'ghost' : 'secondary'} onClick={() => onMove(s)}>
                {STAGE_LABEL[s]}
              </Button>
            ))}
          </div>
          <div className="mt-2">
            <ErrorNote error={error} />
          </div>
        </div>

        <div className="space-y-2">
          <p className={sectionHeading}>Linked</p>
          {booking ? (
            <Link to={`/events/bookings/${booking.id}`} className="block text-sm font-semibold text-brand hover:underline">
              Event {booking.id} · open BEO
            </Link>
          ) : (
            <p className="text-sm text-ink/55">No event yet. Moving to tentative creates it.</p>
          )}
          {quotes.map((q) => (
            <Link key={q.id} to={`/events/quotes?open=${q.id}`} className="block text-sm font-semibold text-brand hover:underline">
              Quote {q.number} · v{q.currentVersion}
            </Link>
          ))}
          <Link to={`/events/quotes?newFor=${lead.id}`} className="block text-sm text-ink/65 hover:text-brand">
            + New quote
          </Link>
        </div>

        <div>
          <p className={sectionHeading}>History</p>
          <ol className="mt-2 space-y-1 text-sm text-ink/70">
            {[...lead.stageHistory].reverse().map((h, i) => (
              <li key={i}>
                {STAGE_LABEL[h.stage]} · {stampText(h.at)} · {h.by}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}

function LostDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { service, actor } = useEvents()
  const [reason, setReason] = useState(LOST_REASONS[0])
  const [note, setNote] = useState('')
  const { busy, error, run } = useRun()
  const save = async () => {
    const full = note.trim() ? `${reason}: ${note.trim()}` : reason
    if (await run(() => service.moveLead(lead.id, 'lost', actor, full))) onClose()
  }
  return (
    <Modal
      title="Mark as lost"
      description={lead.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={save} disabled={busy}>
            Mark lost
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Reason" required>
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {LOST_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />}</Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}

function LeadForm({ lead, onClose, onSaved }: { lead?: Lead; onClose: () => void; onSaved: (l: Lead) => void }) {
  const { service, actor, propertyId } = useEvents()
  const { accounts } = useCorporate()
  const { busy, error, run } = useRun()
  const companies = accounts.filter((a) => a.status === 'active' || a.id === lead?.companyId)
  const [f, setF] = useState({
    title: lead?.title ?? '',
    eventType: lead?.eventType ?? 'conference',
    companyId: lead?.companyId ?? '',
    clientName: lead?.clientName ?? '',
    contactName: lead?.contactName ?? '',
    contactPhone: lead?.contactPhone ?? '',
    contactEmail: lead?.contactEmail ?? '',
    ownerId: lead?.ownerId ?? (SELLERS.some((s) => s.id === actor.id) ? actor.id : SELLERS[0].id),
    eventDate: lead?.eventDate ?? addDays(TODAY, 30),
    endDate: lead?.endDate ?? addDays(TODAY, 30),
    expectedGuests: String(lead?.expectedGuests ?? ''),
    estimatedValue: lead ? String(lead.estimatedValue) : '',
    probability: String(lead?.probability ?? 20),
    source: lead?.source ?? 'Phone',
    notes: lead?.notes ?? '',
  })
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const pickCompany = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    const c = a?.contacts.find((x) => x.active && x.canBook) ?? a?.contacts[0]
    set({ companyId: id, ...(a ? { clientName: a.name, contactName: c?.name ?? f.contactName, contactPhone: c?.phone ?? f.contactPhone, contactEmail: c?.email ?? '' } : {}) })
  }

  const save = async () => {
    const owner = SELLERS.find((s) => s.id === f.ownerId) ?? SELLERS[0]
    const input: LeadInput = {
      title: f.title,
      eventType: f.eventType,
      companyId: f.companyId || undefined,
      clientName: f.clientName,
      contactName: f.contactName,
      contactPhone: f.contactPhone,
      contactEmail: f.contactEmail || undefined,
      ownerId: owner.id,
      ownerName: owner.name,
      eventDate: f.eventDate,
      endDate: f.endDate,
      expectedGuests: num(f.expectedGuests),
      estimatedValue: num(f.estimatedValue),
      probability: num(f.probability),
      source: f.source,
      notes: f.notes || undefined,
    }
    const saved = await run(() => (lead ? service.updateLead(lead.id, input, actor) : service.createLead(propertyId, input, actor)))
    if (saved) onSaved(saved)
  }

  return (
    <Modal
      title={lead ? 'Edit lead' : 'New lead'}
      onClose={onClose}
      side
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {lead ? 'Save' : 'Add lead'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Title" required>
          {(id) => <Input id={id} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Annual general meeting" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={f.eventType} onChange={(e) => set({ eventType: e.target.value as Lead['eventType'] })}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Company account">
            {(id) => (
              <Select id={id} value={f.companyId} onChange={(e) => pickCompany(e.target.value)}>
                <option value="">None (private client)</option>
                {companies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Client" required>
          {(id) => <Input id={id} value={f.clientName} onChange={(e) => set({ clientName: e.target.value })} placeholder="Company, family or organisation" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact name" required>
            {(id) => <Input id={id} value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} />}
          </Field>
          <Field label="Contact phone" required>
            {(id) => <Input id={id} value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="07xx xxx xxx" />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event date" required>
            {(id) => <Input id={id} type="date" value={f.eventDate} onChange={(e) => set({ eventDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} />}
          </Field>
          <Field label="End date" required>
            {(id) => <Input id={id} type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />}
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Guests" required>
            {(id) => <Input id={id} inputMode="numeric" value={f.expectedGuests} onChange={(e) => set({ expectedGuests: e.target.value })} />}
          </Field>
          <Field label="Value (UGX)">
            {(id) => <Input id={id} inputMode="numeric" value={f.estimatedValue} onChange={(e) => set({ estimatedValue: e.target.value })} />}
          </Field>
          <Field label="Chance %">
            {(id) => <Input id={id} inputMode="numeric" value={f.probability} onChange={(e) => set({ probability: e.target.value })} />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner">
            {(id) => (
              <Select id={id} value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
                {SELLERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Source">
            {(id) => (
              <Select id={id} value={f.source} onChange={(e) => set({ source: e.target.value })}>
                {['Phone', 'Email', 'Walk-in', 'Website', 'Referral', 'Repeat client', 'Corporate account'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Notes">{(id) => <Textarea id={id} rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}
