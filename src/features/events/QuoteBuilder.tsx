import { useState } from 'react'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { nightsBetween, ugx } from '../../lib/format'
import { nightlyRate } from '../../lib/rates'
import { quoteTotals } from '../../services/events/eventsRules'
import type { EventsData, Quote, QuoteLineInput, QuoteLineKind } from '../../services/events/eventsTypes'
import type { Room } from '../../types'
import { useFeatures } from '../platform/featuresContext'
import { ErrorNote } from './ErrorNote'
import { LINE_KIND_LABEL, addDays, num } from './eventsUi'
import { useEvents, useRun } from './useEvents'

type Row = { kind: QuoteLineKind; refId?: string; description: string; quantity: string; unitPrice: string; unitCost: string }
const toRow = (l: QuoteLineInput): Row => ({ ...l, quantity: String(l.quantity), unitPrice: String(l.unitPrice), unitCost: String(l.unitCost) })

// Build a quote from packages, spaces, bedrooms and equipment, or amend one into a new version.
export default function QuoteBuilder({
  data,
  quote,
  newFor,
  onClose,
  onSaved,
}: {
  data: EventsData
  quote?: Quote
  /** A lead or event id to start a new quote for. */
  newFor?: string
  onClose: () => void
  onSaved: (q: Quote) => void
}) {
  const { service, actor, propertyId } = useEvents()
  const { options } = useFeatures()
  const { busy, error, run } = useRun()
  const current = quote ? data.quoteVersions.find((v) => v.quoteId === quote.id && v.version === quote.currentVersion) : undefined
  const currentLines = current ? data.quoteLines.filter((l) => l.quoteVersionId === current.id) : []

  const openLeads = data.leads.filter((l) => l.stage !== 'lost')
  const openEvents = data.bookings.filter((b) => b.status === 'tentative' || b.status === 'definite')
  const initialLink = quote ? (quote.eventBookingId ? `ev:${quote.eventBookingId}` : `ld:${quote.leadId}`) : newFor ? (newFor.startsWith('EV') ? `ev:${newFor}` : `ld:${newFor}`) : openLeads[0] ? `ld:${openLeads[0].id}` : ''
  const [link, setLink] = useState(initialLink)
  const linkedLead = link.startsWith('ld:') ? data.leads.find((l) => l.id === link.slice(3)) : undefined
  const linkedEvent = link.startsWith('ev:') ? data.bookings.find((b) => b.id === link.slice(3)) : undefined
  const guests = linkedEvent?.guaranteedGuests ?? linkedEvent?.expectedGuests ?? linkedLead?.expectedGuests ?? 50
  const start = linkedEvent?.startDate ?? linkedLead?.eventDate ?? TODAY
  const end = linkedEvent?.endDate ?? linkedLead?.endDate ?? start

  const [title, setTitle] = useState(quote?.title ?? linkedLead?.title ?? linkedEvent?.name ?? '')
  const [validUntil, setValidUntil] = useState(quote && quote.validUntil >= TODAY ? quote.validUntil : addDays(TODAY, 14))
  const [discount, setDiscount] = useState(String(current?.discountPct ?? 0))
  const [reason, setReason] = useState('')
  const [rows, setRows] = useState<Row[]>(currentLines.map(toRow))
  const [adding, setAdding] = useState<QuoteLineKind>('package')
  const [refId, setRefId] = useState('')

  const lines: QuoteLineInput[] = rows.map((r) => ({ kind: r.kind, refId: r.refId, description: r.description, quantity: num(r.quantity), unitPrice: num(r.unitPrice), unitCost: num(r.unitCost) }))
  const t = quoteTotals(lines, num(discount))
  const prev = current?.total ?? 0

  const choices: { id: string; label: string }[] =
    adding === 'package'
      ? data.packages.filter((p) => p.active).map((p) => ({ id: p.id, label: `${p.name} · ${ugx(p.pricePerHead)}/head` }))
      : adding === 'space'
        ? data.spaces.filter((s) => s.active).flatMap((s) => [
            { id: `${s.id}|full`, label: `${s.name}, full day · ${ugx(s.hireRateFullDay)}` },
            { id: `${s.id}|half`, label: `${s.name}, half day · ${ugx(s.hireRateHalfDay)}` },
          ])
        : adding === 'room'
          ? (['Standard', 'Deluxe', 'Suite'] as Room['type'][]).map((r) => ({ id: r, label: `${r} · ${ugx(nightlyRate(r, 0, options.rates))}/night` }))
          : adding === 'equipment'
            ? data.equipment.map((e) => ({ id: e.id, label: `${e.name} · ${ugx(e.dailyRate)}/day` }))
            : []

  const addLine = () => {
    const pick = refId || choices[0]?.id
    const days = Math.max(1, nightsBetween(start, end) + 1)
    let row: Row | null = null
    if (adding === 'package') {
      const p = data.packages.find((x) => x.id === pick)
      if (p) row = { kind: 'package', refId: p.id, description: p.name, quantity: String(guests), unitPrice: String(p.pricePerHead), unitCost: String(p.costPerHead) }
    } else if (adding === 'space') {
      const [id, len] = (pick ?? '').split('|')
      const s = data.spaces.find((x) => x.id === id)
      if (s) row = { kind: 'space', refId: s.id, description: `${s.name}, ${len === 'full' ? 'full' : 'half'} day`, quantity: String(days), unitPrice: String(len === 'full' ? s.hireRateFullDay : s.hireRateHalfDay), unitCost: '0' }
    } else if (adding === 'room') {
      const type = pick as Room['type']
      const nights = Math.max(1, nightsBetween(start, end) || 1)
      row = { kind: 'room', refId: type, description: `${type} rooms × ${nights} night(s)`, quantity: String(Math.max(1, Math.round(guests / 4)) * nights), unitPrice: String(nightlyRate(type, 0, options.rates)), unitCost: '35000' }
    } else if (adding === 'equipment') {
      const e = data.equipment.find((x) => x.id === pick)
      if (e) row = { kind: 'equipment', refId: e.id, description: e.name, quantity: String(days), unitPrice: String(e.dailyRate), unitCost: String(e.dailyCost) }
    } else row = { kind: 'other', description: '', quantity: '1', unitPrice: '', unitCost: '0' }
    if (row) setRows([...rows, row])
  }
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const save = async () => {
    const saved = await run(() =>
      quote
        ? service.amendQuote(quote.id, { reason, discountPct: num(discount), lines }, actor)
        : service.createQuote(
            propertyId,
            { title: title.trim() || linkedLead?.title || linkedEvent?.name || '', leadId: linkedLead?.id ?? linkedEvent?.leadId, eventBookingId: linkedEvent?.id, validUntil, discountPct: num(discount), lines },
            actor,
          ),
    )
    if (saved) onSaved(saved)
  }

  return (
    <Modal
      title={quote ? `Amend ${quote.number}` : 'New quote'}
      description={quote ? `Becomes version ${quote.currentVersion + 1}` : undefined}
      onClose={onClose}
      side
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {quote ? 'Save new version' : 'Create quote'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!quote && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="For" required>
              {(id) => (
                <Select
                  id={id}
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value)
                    const l = data.leads.find((x) => `ld:${x.id}` === e.target.value)
                    const b = data.bookings.find((x) => `ev:${x.id}` === e.target.value)
                    setTitle(l?.title ?? b?.name ?? title)
                  }}
                >
                  <optgroup label="Leads">
                    {openLeads.map((l) => (
                      <option key={l.id} value={`ld:${l.id}`}>
                        {l.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Events">
                    {openEvents.map((b) => (
                      <option key={b.id} value={`ev:${b.id}`}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
              )}
            </Field>
            <Field label="Title" required>
              {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {!quote && <Field label="Valid until">{(id) => <Input id={id} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}</Field>}
          <Field label="Discount %" hint="Up to 30%">
            {(id) => <Input id={id} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />}
          </Field>
        </div>
        {quote && (
          <Field label="What changed" required>
            {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Guests up from 150 to 180" />}
          </Field>
        )}

        <div className="rounded-lg border border-ink/10 p-3">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto] sm:items-end">
            <Field label="Add">
              {(id) => (
                <Select
                  id={id}
                  value={adding}
                  onChange={(e) => {
                    setAdding(e.target.value as QuoteLineKind)
                    setRefId('')
                  }}
                >
                  {(Object.keys(LINE_KIND_LABEL) as QuoteLineKind[]).map((k) => (
                    <option key={k} value={k}>
                      {LINE_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {choices.length > 0 ? (
              <Field label="Item">
                {(id) => (
                  <Select id={id} value={refId || choices[0]?.id} onChange={(e) => setRefId(e.target.value)}>
                    {choices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <div />
            )}
            <Button variant="secondary" onClick={addLine}>
              Add line
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-ink/55">No lines yet.</p>}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_110px_auto] items-center gap-2 sm:grid-cols-[90px_1fr_80px_120px_110px_auto]">
              <span className="hidden text-xs font-semibold text-ink/55 sm:block">{LINE_KIND_LABEL[r.kind]}</span>
              <Input value={r.description} aria-label="Description" onChange={(e) => setRow(i, { description: e.target.value })} />
              <Input value={r.quantity} aria-label="Quantity" inputMode="numeric" onChange={(e) => setRow(i, { quantity: e.target.value })} />
              <Input value={r.unitPrice} aria-label="Unit price" inputMode="numeric" onChange={(e) => setRow(i, { unitPrice: e.target.value })} />
              <span className="hidden whitespace-nowrap text-right text-sm tabular-nums text-ink sm:block">{ugx(num(r.quantity) * num(r.unitPrice))}</span>
              <Button size="sm" variant="ghost" aria-label="Remove line" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                ×
              </Button>
            </div>
          ))}
        </div>

        <dl className="space-y-1 border-t border-ink/10 pt-3 text-sm">
          <Line label="Subtotal" value={ugx(t.subtotal)} />
          <Line label={`Discount ${num(discount)}%`} value={`− ${ugx(t.discount)}`} />
          <Line label="Total" value={ugx(t.total)} strong />
          {quote && (
            <Line
              label={`Change from v${quote.currentVersion}`}
              value={`${t.total - prev >= 0 ? '+' : '−'} ${ugx(Math.abs(t.total - prev))}`}
              tone={t.total - prev >= 0 ? 'text-good' : 'text-bad'}
            />
          )}
          <Line label="Margin" value={t.total ? `${Math.round(((t.total - t.cost) / t.total) * 100)}%` : '—'} />
        </dl>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? 'font-semibold text-ink' : 'text-ink/65'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-ink' : 'text-ink'} ${tone ?? ''}`}>{value}</dd>
    </div>
  )
}
