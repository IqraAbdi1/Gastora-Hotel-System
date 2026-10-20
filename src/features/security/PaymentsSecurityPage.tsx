import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dateTime } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useAuth } from '../auth/authContext'
import { defaultVisible, maskValue } from '../../services/security/catalog'
import { findCardNumbers, maskedText } from '../../services/security/cardScan'
import type { SecurityService } from '../../services/security/securityService'
import type { CardToken, PaymentMethodSecurity } from '../../services/security/securityTypes'
import { ErrorBanner, Mono, ReadOnly } from './parts'
import { useAction, useSecurityActor, useSecurityData } from './useSecurity'

const HANDLING: Record<PaymentMethodSecurity['handling'], { label: string; tone: Tone }> = {
  tokenized: { label: 'Tokenized', tone: 'good' },
  noCardData: { label: 'No card data', tone: 'neutral' },
  notTokenized: { label: 'Typed by staff', tone: 'bad' },
}

const load = async (s: SecurityService, p: string) => {
  const [methods, tokens, freeText, masked] = await Promise.all([s.listPaymentMethods(p), s.listCardTokens(p), s.listFreeText(p), s.listMaskedColumns(p)])
  return { methods, tokens, freeText, masked }
}

interface Finding {
  id: string
  source: string
  where: string
  link?: string
  text: string
  hits: ReturnType<typeof findCardNumbers>
  /** Only records held by the service can be redacted from here. */
  redactable: boolean
}

/** Months until a card's MM/YY expiry, counted from today. */
function monthsLeft(expiry: string): number {
  const [mm, yy] = expiry.split('/').map(Number)
  const [y, m] = TODAY.split('-').map(Number)
  return (2000 + yy - y) * 12 + (mm - m)
}

export default function PaymentsSecurityPage() {
  const { reservations, guests } = useHotel()
  const { role } = useAuth()
  const { actor, canAdmin, propertyId, service } = useSecurityActor()
  const { data, error: loadError } = useSecurityData(load)
  const { run, error, clear, busy } = useAction()
  const [remove, setRemove] = useState<CardToken | null>(null)
  const [scannedAt, setScannedAt] = useState(() => new Date().toISOString())

  // Every free-text field the hotel keeps, plus what other systems imported.
  const { findings, scanned } = useMemo(() => {
    const texts: Omit<Finding, 'hits'>[] = []
    for (const g of guests)
      for (const n of g.notes ?? []) texts.push({ id: `gn:${g.id}:${n.id}`, source: 'Guest note', where: g.name, link: `/desk/guests/${g.id}`, text: n.text, redactable: false })
    for (const r of reservations) {
      const where = `${r.id} ${r.guest}`
      if (r.details?.specialRequests) texts.push({ id: `sr:${r.id}`, source: 'Special requests', where, text: r.details.specialRequests, redactable: false })
      if (r.checkoutNote) texts.push({ id: `co:${r.id}`, source: 'Check-out note', where, text: r.checkoutNote, redactable: false })
      if (r.overrideReason) texts.push({ id: `or:${r.id}`, source: 'Rate override reason', where, text: r.overrideReason, redactable: false })
      for (const c of r.charges ?? []) texts.push({ id: `ch:${r.id}:${c.id}`, source: 'Folio line', where, text: `${c.description} ${c.reason ?? ''}`, redactable: false })
      for (const p of r.payments ?? []) if (p.reference) texts.push({ id: `pr:${r.id}:${p.id}`, source: 'Payment reference', where, text: p.reference, redactable: false })
    }
    for (const f of data?.freeText ?? []) texts.push({ id: f.id, source: f.source, where: f.ref, text: f.text, redactable: true })
    const found = texts.map((t) => ({ ...t, hits: findCardNumbers(t.text) })).filter((t) => t.hits.length > 0)
    // Carrying scannedAt makes "Scan again" run the scan afresh.
    return { findings: found, scanned: texts.length, at: scannedAt }
  }, [guests, reservations, data, scannedAt])

  if (!data) return <div className="space-y-5"><PageHeader title="Payment security" /><ErrorBanner message={loadError} /></div>

  const cardMethods = data.methods.filter((m) => m.handling !== 'noCardData')
  const tokenized = cardMethods.filter((m) => m.handling === 'tokenized').length
  const expiring = data.tokens.filter((t) => monthsLeft(t.expiry) <= 2).length
  const showLast4 = role ? (data.masked.find((m) => m.field === 'cardLast4' && m.roleId === role.id)?.visible ?? defaultVisible('cardLast4', role.id)) : false
  const canRemove = role ? ['owner', 'admin', 'finance'].includes(role.id) : false

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Admin" title="Payment security" description="Card data stays with the processor. The hotel keeps tokens only." meta={!canAdmin ? <ReadOnly /> : undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Card methods tokenized" icon="check" value={`${tokenized}/${cardMethods.length}`} tone={tokenized < cardMethods.length ? 'warn' : 'good'} hint="Card numbers never touch Gastora" />
        <StatCard label="Card tokens held" icon="money" value={data.tokens.length} hint="Brand, last 4 and expiry only" />
        <StatCard label="Card numbers in text" icon="alert" value={findings.length} tone={findings.length ? 'bad' : 'good'} hint={`${scanned} fields scanned`} />
        <StatCard label="Tokens expiring" icon="calendar" value={expiring} hint="Within 2 months" tone={expiring ? 'warn' : 'default'} />
      </div>

      <ErrorBanner message={error} onClose={clear} />

      <Card
        title="Raw card numbers found"
        count={findings.length}
        description="13-19 digits that pass the Luhn check, typed into free text."
        padded={false}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setScannedAt(new Date().toISOString())}>
            Scan again
          </Button>
        }
      >
        <DataTable
          rows={findings}
          rowKey={(f) => f.id}
          empty={{ title: 'No card numbers in free text', hint: `Last scan ${dateTime(scannedAt)}` }}
          columns={[
            { key: 'src', header: 'Where', cell: (f) => <div><p className="font-medium text-ink">{f.source}</p><p className="text-xs text-ink/55">{f.where}</p></div> },
            { key: 'card', header: 'Card', cell: (f) => f.hits.map((h) => <Badge key={h.raw} tone="bad">{h.brand} •••• {h.last4}</Badge>) },
            { key: 'text', header: 'Text (masked)', hideBelow: 'md', className: 'max-w-[26rem] truncate', cell: (f) => <span className="text-ink/70">{maskedText(f.text)}</span> },
            {
              key: 'act',
              header: '',
              align: 'right',
              cell: (f) =>
                f.redactable ? (
                  <Button size="sm" variant="secondary" disabled={busy || !actor} onClick={() => actor && run(() => service.redactFreeText(propertyId, f.id, actor))}>
                    Redact
                  </Button>
                ) : f.link ? (
                  <Link to={f.link} className="text-sm font-semibold text-brand hover:underline">
                    Open
                  </Link>
                ) : null,
            },
          ]}
        />
      </Card>

      <div className="space-y-4">
        <Card title="Payment methods" count={data.methods.length} padded={false}>
          <DataTable
            rows={data.methods}
            rowKey={(m) => m.id}
            columns={[
              { key: 'm', header: 'Method', cell: (m) => <div><p className="font-medium text-ink">{m.label}</p><p className="text-xs text-ink/55">{m.channel}</p></div> },
              { key: 'h', header: 'Card data', cell: (m) => <Badge tone={HANDLING[m.handling].tone} dot>{HANDLING[m.handling].label}</Badge> },
              { key: 'p', header: 'Held by', hideBelow: 'md', cell: (m) => <span className="text-ink/70">{m.processor}</span> },
              {
                key: 'a',
                header: '',
                align: 'right',
                cell: (m) =>
                  m.handling === 'notTokenized' && canAdmin ? (
                    <Button size="sm" disabled={busy} onClick={() => actor && run(() => service.tokenizeMethod(propertyId, m.id, actor))}>
                      Use pay link
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>

        <Card title="Card token vault" count={data.tokens.length} padded={false}>
          <DataTable
            rows={data.tokens}
            rowKey={(t) => t.id}
            empty={{ title: 'No cards on file' }}
            columns={[
              { key: 'g', header: 'Guest', cell: (t) => <span className="font-medium text-ink">{t.guestName}</span> },
              { key: 'c', header: 'Card', cell: (t) => (showLast4 ? `${t.brand} •••• ${t.last4}` : `${t.brand} ${maskValue('cardLast4', t.last4)}`) },
              { key: 'e', header: 'Expires', cell: (t) => <Badge tone={monthsLeft(t.expiry) < 0 ? 'bad' : monthsLeft(t.expiry) <= 2 ? 'warn' : 'neutral'}>{t.expiry}</Badge> },
              { key: 't', header: 'Token', hideBelow: 'lg', cell: (t) => <Mono>{t.token.slice(0, 14)}…</Mono> },
              {
                key: 'a',
                header: '',
                align: 'right',
                cell: (t) =>
                  canRemove ? (
                    <Button size="sm" variant="ghost" onClick={() => setRemove(t)}>
                      Remove
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      </div>

      {remove && (
        <ConfirmDialog
          title="Remove card token"
          message={`${remove.guestName}'s ${remove.brand} ending ${remove.last4} can no longer be charged. The guest must give the card again.`}
          confirmLabel="Remove token"
          danger
          onCancel={() => setRemove(null)}
          onConfirm={() => {
            const t = remove
            setRemove(null)
            if (actor) void run(() => service.deleteCardToken(propertyId, t.id, actor))
          }}
        />
      )}
    </div>
  )
}
