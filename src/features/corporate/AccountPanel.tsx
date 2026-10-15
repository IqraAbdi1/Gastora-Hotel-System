import { useState } from 'react'
import type { ReactNode } from 'react'
import StatusPill from '../../components/StatusPill'
import { Badge, Button, Modal, Tabs } from '../../components/ui'
import type { TabItem } from '../../components/ui'
import {
  BILL_TO_LABEL,
  canChangePricing,
  canSetCredit,
  creditPosition,
  offersCredit,
  ruleText,
  STATUS_LABEL,
  STEP_LABEL,
  TERMS_LABEL,
} from '../../lib/corporate'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { roleCan } from '../../lib/roles'
import type { CorporateAccount } from '../../services/corporate/corporateTypes'
import { useAuth } from '../auth/authContext'
import { ApprovalBox, BillingForm, ContactForm, CreditForm, StatusForm } from './AccountForms'
import AgreementEditor from './AgreementEditor'
import { useCorporate } from './corporateContext'
import { creditText, emptyContact, statusTone } from './corporateUi'
import type { ContactDraft } from './corporateUi'

type Tab = 'overview' | 'contacts' | 'prices' | 'bookings' | 'history'

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <dt className="text-ink/60">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AccountPanel({ a, onClose }: { a: CorporateAccount; onClose: () => void }) {
  const { user, role } = useAuth()
  const { reservations } = useHotel()
  const { policy } = useCorporate()
  const [editing, setEditing] = useState<'credit' | 'billing' | 'agreement' | null>(null)
  const [contact, setContact] = useState<ContactDraft | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const roleId = role?.id
  const can = (x: Parameters<typeof roleCan>[1]) => !!roleId && roleCan(roleId, x)
  const approver = can('approveCorporateManager') || can('approveCorporateFinance')
  const credit = creditPosition(a, reservations)
  const usedPct = a.creditLimit > 0 ? Math.min(100, Math.round(((credit.outstanding + credit.committed) / a.creditLimit) * 100)) : 0
  const stays = reservations.filter((r) => r.corporate?.accountId === a.id).sort((x, y) => y.arrival.localeCompare(x.arrival))
  const live = a.status !== 'pending' && a.status !== 'declined'

  const tabs: TabItem<Tab>[] = [
    { key: 'overview', label: 'Overview', alert: a.status === 'pending' },
    { key: 'contacts', label: 'Contacts', count: a.contacts.filter((c) => c.active).length },
    { key: 'prices', label: 'Agreement and prices', count: a.agreement?.rules.length ?? 0 },
    { key: 'bookings', label: 'Bookings', count: stays.length, alert: stays.some((r) => r.corporate?.billing.status === 'pending') },
    { key: 'history', label: 'History' },
  ]

  return (
    <Modal
      wide
      title={a.name}
      description={`${a.id} · ${a.industry}`}
      onClose={onClose}
      header={
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[a.status]} dot>
              {STATUS_LABEL[a.status]}
            </Badge>
            <Badge tone="neutral">{TERMS_LABEL[a.paymentTerms]}</Badge>
            {a.billing.poRequired && <Badge tone="info">LPO needed for every stay</Badge>}
          </div>
          <Tabs
            label="Company account"
            tabs={tabs}
            value={tab}
            onChange={(t) => {
              setTab(t)
              setEditing(null)
              setContact(null)
            }}
          />
        </div>
      }
    >
      {tab === 'overview' && (
        <div className="space-y-6">
          {a.statusReason && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{a.statusReason}</p>}
          {a.status === 'pending' && user && roleId && <ApprovalBox a={a} role={roleId} userId={user.id} />}

          {live && approver && (
            <Section title="Account status">
              <StatusForm a={a} />
            </Section>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Section
              title="Credit"
              action={
                live && roleId && canSetCredit(roleId, policy) && editing !== 'credit' ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing('credit')}>
                    Change credit
                  </Button>
                ) : undefined
              }
            >
              {editing === 'credit' ? (
                <CreditForm a={a} onDone={() => setEditing(null)} />
              ) : (
                <>
                  <Rows
                    rows={[
                      ['Terms', TERMS_LABEL[a.paymentTerms]],
                      ['Credit limit', offersCredit(a.paymentTerms) && a.creditLimit > 0 ? ugx(a.creditLimit) : 'No credit'],
                      ['Unpaid invoices', ugx(credit.outstanding)],
                      ['Booked, not yet invoiced', ugx(credit.committed)],
                      [
                        'Available',
                        <span className={credit.available < 0 ? 'text-bad' : ''}>{a.creditLimit > 0 ? creditText(credit.available) : '—'}</span>,
                      ],
                    ]}
                  />
                  {a.requestedCreditLimit && a.creditLimit === 0 && (
                    <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
                      Credit asked for: {ugx(a.requestedCreditLimit)} on invoice terms. Not set yet. {STEP_LABEL[policy.creditApprover]} decides it.
                    </p>
                  )}
                  {a.creditLimit > 0 && (
                    <div className="h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                      <div className={`h-full ${usedPct >= 100 ? 'bg-bad' : usedPct >= 80 ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${usedPct}%` }} />
                    </div>
                  )}
                  {!(roleId && canSetCredit(roleId, policy)) && (
                    <p className="text-xs text-ink/55">Only {STEP_LABEL[policy.creditApprover].toLowerCase()} can change credit.</p>
                  )}
                </>
              )}
            </Section>

            <Section
              title="Billing instructions"
              action={
                can('manageCorporate') && editing !== 'billing' ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing('billing')}>
                    Edit
                  </Button>
                ) : undefined
              }
            >
              {editing === 'billing' ? (
                <BillingForm a={a} onDone={() => setEditing(null)} />
              ) : (
                <>
                  <Rows
                    rows={[
                      ['Usually billed', BILL_TO_LABEL[a.billing.defaultBillTo]],
                      ['Invoices to', a.billing.invoiceEmail || 'Not recorded'],
                      ['LPO number', a.billing.poRequired ? 'Needed on each booking' : 'Not needed'],
                    ]}
                  />
                  {a.billing.instructions && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink/80">{a.billing.instructions}</p>}
                </>
              )}
            </Section>

          </div>
          <Section title="Company details">
            <Rows
              rows={[
                ['TIN', a.tin || 'Not recorded'],
                ['Industry', a.industry || 'Not recorded'],
                ['Address', a.address || 'Not recorded'],
                ['Phone', a.phone || 'Not recorded'],
                ['Email', a.email || 'Not recorded'],
                ['Requested by', `${a.createdBy.name}, ${a.createdAt}`],
              ]}
            />
          </Section>
        </div>
      )}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <Section
            title={`Contacts · ${a.contacts.filter((c) => c.active).length}`}
            action={
              can('manageCorporate') && !contact ? (
                <Button size="sm" variant="ghost" onClick={() => setContact(emptyContact)}>
                  Add contact
                </Button>
              ) : undefined
            }
          >
            {contact && <ContactForm key={contact.id ?? 'new'} a={a} contact={contact} onDone={() => setContact(null)} />}
            <ul className="divide-y divide-ink/8 rounded-lg border border-ink/10">
              {a.contacts.map((c) => (
                <li key={c.id} className={`flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 ${c.active ? '' : 'opacity-50'}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {c.name} <span className="font-normal text-ink/60">· {c.jobTitle}</span>
                    </p>
                    <p className="text-xs text-ink/60">
                      {c.phone} · {c.email}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!c.active && <Badge tone="neutral">No longer with company</Badge>}
                      {c.active && c.canBook && <Badge tone="brand">Can book</Badge>}
                      {c.active && c.canApproveCharges && <Badge tone="accent">Approves charges</Badge>}
                    </div>
                  </div>
                  {can('manageCorporate') && (
                    <Button size="sm" variant="ghost" onClick={() => setContact(c)}>
                      Edit
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>

        </div>
      )}
      {tab === 'prices' && (
        <div className="space-y-4">
          <Section
            title="Agreement and prices"
            action={
              live && roleId && canChangePricing(roleId) && editing !== 'agreement' ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing('agreement')}>
                  {a.agreement ? 'Change agreement' : 'Add agreement'}
                </Button>
              ) : undefined
            }
          >
            {editing === 'agreement' ? (
              <AgreementEditor a={a} onDone={() => setEditing(null)} />
            ) : !a.agreement ? (
              <p className="text-sm text-ink/60">No agreement. Bookings use the normal rates.</p>
            ) : (
              <>
                <Rows
                  rows={[
                    ['Reference', a.agreement.reference],
                    ['Valid', `${dayMonth(a.agreement.validFrom)} ${a.agreement.validFrom.slice(0, 4)} to ${dayMonth(a.agreement.validTo)} ${a.agreement.validTo.slice(0, 4)}`],
                    ['Discount on top of negotiated rate', a.agreement.allowDiscountOnNegotiatedRate ? 'Allowed' : 'Not allowed'],
                  ]}
                />
                <ul className="space-y-1.5">
                  {a.agreement.rules.map((r) => (
                    <li key={r.id} className="rounded-lg bg-canvas px-3 py-2 text-sm">
                      <p className="font-semibold">
                        {r.label} <span className="font-normal text-ink/70">· {ruleText(r)}</span>
                      </p>
                      <p className="text-xs text-ink/60">
                        {r.roomTypes.join(', ')}
                        {r.minNights ? ` · ${r.minNights}+ nights` : ''} · until {dayMonth(r.validTo)}
                        {r.requiresApproval && ' · needs manager approval on each booking'}
                      </p>
                    </li>
                  ))}
                </ul>
                {a.agreement.notes && <p className="text-xs text-ink/60">{a.agreement.notes}</p>}
              </>
            )}
            {!(roleId && canChangePricing(roleId)) && <p className="text-xs text-ink/55">Only a manager can change agreements and prices.</p>}
          </Section>

        </div>
      )}
      {tab === 'bookings' && (
        <div className="space-y-4">
          <Section title={`Bookings · ${stays.length}`}>
            {stays.length === 0 ? (
              <p className="text-sm text-ink/60">No bookings for this company yet.</p>
            ) : (
              <ul className="divide-y divide-ink/8 rounded-lg border border-ink/10">
                {stays.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{r.guest}</span> · {r.id} · {dayMonth(r.arrival)}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.billing.poRequired && r.corporate?.billTo !== 'guest' && (
                        <Badge tone={r.corporate?.billing.lpo ? 'good' : 'warn'}>{r.corporate?.billing.lpo ? `LPO ${r.corporate.billing.lpo.number}` : 'No LPO'}</Badge>
                      )}
                      {r.corporate?.billing.status === 'pending' && <Badge tone="warn">Billing pending</Badge>}
                      <StatusPill status={r.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

        </div>
      )}
      {tab === 'history' && (
        <div className="space-y-4">
          <Section title="History">
            <ol className="space-y-1.5 border-l-2 border-ink/10 pl-3">
              {[...a.history].reverse().map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{h.action}</span>
                  {h.detail && <span className="text-ink/70"> · {h.detail}</span>}
                  <span className="block text-xs text-ink/50">
                    {h.by.name}, {h.at}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-ink/50">The real history is kept by the server. This copy is lost on reload.</p>
          </Section>
        </div>
      )}
    </Modal>
  )
}
