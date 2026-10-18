import { useState } from 'react'
import { REFUSAL_NOTE, expressCheck, expressState } from '../../lib/expressCheckout'
import { describeRule, newRuleId as newRoutingId } from '../../lib/routing'
import StatusPill from '../../components/StatusPill'
import { Button, Tabs } from '../../components/ui'
import type { TabItem } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { chargeCategories, folioOf, paymentMethods, stamp } from '../../lib/folio'
import { BILL_TO_SUMMARY, payerFor, splitFolio } from '../../lib/folioSplit'
import { useCorporate } from '../corporate/corporateContext'
import { useGroups } from '../groups/groupsContext'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { nightsBetween } from '../../lib/format'
import { lateCheckoutFee, nowTime } from '../../lib/stayTimes'
import { isTaxCategory, vatInsideOf } from '../../lib/tax'
import type { Reservation } from '../../types'
import DocumentDialog from '../receipts/DocumentDialog'
import { folioDoc } from '../receipts/documents'
import { useAuth } from '../auth/authContext'
import ApprovalGate from '../approvals/ApprovalGate'
import { useApprovals } from '../approvals/approvalsContext'
import { useFeatures } from '../platform/featuresContext'

type Tab = 'folio' | 'charge' | 'payment' | 'out'
type Props = { reservation: Reservation; onClose: () => void; startOn?: Tab }

const field =
  'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0

// One guest's folio. The parts sit on tabs, so each one fits on screen without scrolling.
export default function FolioPanel({ reservation: r, onClose, startOn = 'folio' }: Props) {
  const { addCharge, addPayment, checkOut, reverseCharge, agreeExpress, cancelExpress, setRouting, reservations } = useHotel()
  const [routeCat, setRouteCat] = useState('Everything')
  const [routeTo, setRouteTo] = useState('')
  const f = folioOf(r)
  const { byId } = useCorporate()
  const { byId: blockOf } = useGroups()
  // One stay, two bills when the company carries part of it. For an ordinary stay this is just the one bill.
  // A stay in a group block is divided by the block's rule rather than its own.
  const block = blockOf(r.group?.blockId)
  const blockAccount = block ? byId(block.accountId ?? block.agentId ?? '')?.name : undefined
  const s = splitFolio(r, blockAccount ?? (r.corporate ? byId(r.corporate.accountId)?.name : undefined), block)
  // The desk can only take money from the guest, so every balance the desk acts on is the guest's side.
  const owed = s.split ? s.guestBalance : f.balance
  const { tax, stayTimes, tenant, options, features } = useFeatures()
  const { record } = useApprovals()
  const { user } = useAuth()
  const me = user?.staffName ?? user?.name ?? 'Front desk'
  // Checked here so the desk only offers it to a guest it could actually charge.
  const expressNow = expressCheck(r, r.corporate ? byId(r.corporate.accountId)?.name : undefined, options.expressMax)
  const express = expressState(r)
  // Only somebody actually in the hotel can carry another guest's bill.
  const others = reservations.filter((x) => x.status === 'in-house' && x.id !== r.id)
  const [printing, setPrinting] = useState(false)
  // The charge being corrected, with the reason and the manager who approved it.
  const [fixing, setFixing] = useState<string | null>(null)
  const [fixReason, setFixReason] = useState('')
  // The approval ladder opens once the reason is given.
  const [asking, setAsking] = useState(false)
  // VAT already inside the amounts. Tax and service lines are not VAT-able here, so they are left out of the base.
  const taxLines = (r.charges ?? []).filter((c) => isTaxCategory(c.category)).reduce((n, c) => n + c.amount, 0)
  const vatInside = tax && tax.vatOn && tax.vatMode === 'included' ? vatInsideOf(f.total - taxLines, tax.vatRate) : 0
  const live = r.status === 'in-house'
  const [picked, setTab] = useState<Tab>(startOn)
  // Once the guest has checked out only the folio and invoice remain.
  const tab: Tab = live ? picked : 'folio'

  const [category, setCategory] = useState(chargeCategories[0])
  const [description, setDescription] = useState('')
  const [chargeText, setChargeText] = useState('')
  const [method, setMethod] = useState(paymentMethods[0])
  const [payText, setPayText] = useState('')
  const [reference, setReference] = useState('')
  const [authorise, setAuthorise] = useState(false)
  const [authReason, setAuthReason] = useState('')

  const chargeAmount = digits(chargeText)
  const chargeValid = chargeAmount > 0 && description.trim() !== ''
  const payAmount = digits(payText)
  const payValid = payAmount > 0 && payAmount <= owed

  // Late check-out, from the hotel's times and the clock now. The rate is one night's room charge.
  const clock = nowTime()
  const nights = Math.max(1, nightsBetween(r.arrival, r.departure))
  const late = lateCheckoutFee(stayTimes, clock, f.roomCharge / nights)
  const lateCharged = (r.charges ?? []).some((c) => c.category === 'Late check-out')
  const canOut = owed <= 0 || (authorise && authReason.trim().length >= 5)

  function postCharge() {
    addCharge(r.id, { category, description: description.trim(), amount: chargeAmount })
    setDescription('')
    setChargeText('')
    setTab('folio')
  }

  function takePayment() {
    addPayment(r.id, { method, amount: payAmount, reference: reference.trim() || undefined })
    setPayText('')
    setReference('')
    setTab('folio')
  }

  function confirmCheckOut() {
    checkOut(r.id, owed > 0 ? authReason.trim() : undefined)
  }

  const tabs: TabItem<Tab>[] = [
    { key: 'folio', label: 'Folio' },
    ...(live
      ? ([
          { key: 'charge', label: 'Add charge' },
          { key: 'payment', label: 'Payment' },
          { key: 'out', label: 'Check out', alert: owed > 0 && r.departure <= TODAY },
        ] as TabItem<Tab>[])
      : []),
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Folio for ${r.guest}`}
    >
    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
      <div className="border-b border-ink/10 bg-linear-to-r from-brand/[0.07] to-transparent p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">Folio · {r.guest}</h2>
            <p className="text-sm text-ink/60">
              {r.id} · Room {r.room} · {dayMonth(r.arrival)} to {dayMonth(r.departure)}
            </p>
            <div className="mt-1">
              <StatusPill status={r.status} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
            Close
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(s.split
            ? [
                ['To the company', ugx(s.companyBalance), 'text-ink'],
                ['Guest paid', ugx(s.paid), 'text-good'],
                ['Guest owes', ugx(s.guestBalance), s.guestBalance > 0 ? 'text-bad' : 'text-good'],
              ]
            : [
                ['Total', ugx(f.total), 'text-ink'],
                ['Paid', ugx(f.paid), 'text-good'],
                ['Balance', ugx(f.balance), f.balance > 0 ? 'text-bad' : 'text-good'],
              ]
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-ink/10 bg-surface px-2 py-1.5">
              <p className="text-xs text-ink/55">{label}</p>
              <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="border-b border-ink/10 px-3 py-2">
          <Tabs tabs={tabs} value={tab} onChange={setTab} label="Folio sections" />
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {tab === 'folio' && (
          <>
            {s.split && (
              <div className="rounded-xl border border-info/25 bg-info/[0.07] p-3">
                <p className="text-sm font-semibold text-ink">
                  One stay, two bills{s.accountName ? ` · ${s.accountName}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-ink/70">{s.billTo ? BILL_TO_SUMMARY[s.billTo] : ''}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    { key: 'company' as const, title: 'Billed to the company', side: s.company, foot: 'Invoiced to the account against the LPO.' },
                    { key: 'guest' as const, title: 'The guest pays', side: s.guest, foot: 'Settled at the desk before they leave.' },
                  ].map((col) => (
                    <div key={col.key} className="rounded-lg border border-ink/10 bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{col.title}</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {col.side.lines.length === 0 && <li className="text-ink/50">Nothing on this side yet.</li>}
                        {col.side.lines.map((l) => (
                          <li key={l.id} className="flex justify-between gap-3">
                            <span className={l.cancelled ? 'text-ink/40 line-through' : 'text-ink/70'}>{l.label}</span>
                            <span className={`shrink-0 tabular-nums ${l.cancelled ? 'text-ink/40 line-through' : ''}`}>
                              {l.amount < 0 ? `− ${ugx(Math.abs(l.amount))}` : ugx(l.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex justify-between gap-3 border-t border-ink/10 pt-2 text-sm font-bold">
                        <span>Total</span>
                        <span className="tabular-nums">{ugx(col.side.total)}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink/55">{col.foot}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink/60">
                  The guest can check out once their own side is settled. What the company carries is never in
                  their way at the desk.
                </p>
              </div>
            )}

            <div>
              <div className="mb-4 rounded-xl bg-ink/[0.03] p-3">
                <p className="text-sm font-semibold text-ink">Where this guest's charges go</p>
                {(r.routing ?? []).length === 0 ? (
                  <p className="mt-0.5 text-xs text-ink/60">Everything stays on this bill.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs text-ink/75">
                    {(r.routing ?? []).map((rule) => (
                      <li key={rule.id} className="flex items-center justify-between gap-2">
                        <span>
                          {describeRule(rule)} <span className="text-ink/50">· {rule.by}, {rule.at}</span>
                        </span>
                        <button
                          type="button"
                          className="font-semibold text-bad"
                          onClick={() => setRouting(r.id, (r.routing ?? []).filter((x) => x.id !== rule.id))}
                        >
                          Stop
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {live && others.length > 0 && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <select value={routeCat} onChange={(e) => setRouteCat(e.target.value)} aria-label="Charges of this kind" className={field}>
                      <option>Everything</option>
                      {chargeCategories.map((cat) => (
                        <option key={cat}>{cat}</option>
                      ))}
                    </select>
                    <select value={routeTo} onChange={(e) => setRouteTo(e.target.value)} aria-label="Go to this guest" className={field}>
                      <option value="">Choose a guest</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.guest}
                          {o.room ? ` · room ${o.room}` : ''}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={!routeTo}
                      onClick={() => {
                        const to = others.find((o) => o.id === routeTo)
                        if (!to) return
                        setRouting(r.id, [
                          ...(r.routing ?? []),
                          {
                            id: newRoutingId(r.routing ?? []),
                            category: routeCat,
                            toReservationId: to.id,
                            toGuest: to.guest,
                            at: stamp(),
                            by: me,
                          },
                        ])
                        setRouteTo('')
                      }}
                    >
                      Route it
                    </Button>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-ink/55">
                  A charge is sent to the other bill as it is posted, carrying this guest's name, so nobody has to work out at checkout why
                  somebody else's dinner is on it. A rule naming one kind beats a rule for everything.
                </p>
              </div>

              <p className={heading}>Charges</p>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/60">
                    Room charges for the stay
                    {r.upgrade && <span className="block text-xs">{r.upgrade.to}, free upgrade from {r.upgrade.from}. Charged at the {r.upgrade.from} rate.</span>}
                  </dt>
                  <dd className="font-medium tabular-nums">{ugx(f.roomCharge)}</dd>
                </div>
                {(r.charges ?? []).map((c) => (
                  <div key={c.id}>
                    <div className="flex justify-between gap-4">
                      <dt className={c.reversedBy ? 'text-ink/40 line-through' : 'text-ink/60'}>
                        {c.category}: {c.description}
                        {s.split && (
                          <span className="ml-1.5 rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/60 no-underline">
                            {payerFor(c.category, s.billTo ?? 'guest') === 'company' ? 'Company' : 'Guest'}
                          </span>
                        )}
                        <span className="block text-xs no-underline">
                          {c.at}
                          {c.routedFrom && ` · for ${c.routedFrom.guest}${c.routedFrom.room ? `, room ${c.routedFrom.room}` : ''}`}
                          {c.reversedBy && ' · cancelled'}
                          {c.reverses && c.approvedBy && ` · ${c.reason} · approved by ${c.approvedBy}`}
                        </span>
                      </dt>
                      <dd
                        className={`font-medium tabular-nums ${
                          c.reversedBy ? 'text-ink/40 line-through' : c.amount < 0 ? 'text-good' : ''
                        }`}
                      >
                        {c.amount < 0 ? `− ${ugx(Math.abs(c.amount))}` : ugx(c.amount)}
                      </dd>
                    </div>
                    {live && !c.reversedBy && !c.reverses && (
                      fixing === c.id ? (
                        <div className="mt-1.5 space-y-2">
                          <div className="space-y-2 rounded-lg border border-warn/30 bg-warn/10 p-2.5">
                            <p className="text-xs font-semibold text-warn">Cancel this charge</p>
                            <input
                              value={fixReason}
                              onChange={(e) => setFixReason(e.target.value)}
                              placeholder="Why is it wrong?"
                              aria-label="Reason"
                              className={field}
                            />
                            {!asking && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" disabled={fixReason.trim() === ''} onClick={() => setAsking(true)}>
                                  Ask for approval
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setFixing(null)
                                    setAsking(false)
                                  }}
                                >
                                  Keep it
                                </Button>
                              </div>
                            )}
                            <p className="text-xs text-ink/60">
                              The charge stays on the folio with a matching line that cancels it, so the guest can see what
                              happened. The amount decides who must approve.
                            </p>
                          </div>
                          {asking && (
                            <ApprovalGate
                              amount={c.amount}
                              limits={options.limits}
                              plan={tenant.plan}
                              kind="charge-reversal"
                              what={`${c.category}: ${c.description}`}
                              onCancel={() => setAsking(false)}
                              onApproved={(approvers, photoSkipped) => {
                                const names = approvers.map((a) => a.name).join(' and ')
                                reverseCharge(r.id, c.id, fixReason.trim(), names)
                                record({
                                  kind: 'charge-reversal',
                                  what: `${c.category}: ${c.description} · ${r.guest}`,
                                  amount: c.amount,
                                  requestedBy: user?.name ?? 'Front desk',
                                  reason: fixReason.trim(),
                                  approvers,
                                  level: approvers.length > 1 ? 'executive' : 'manager',
                                  photoSkipped,
                                  reservationId: r.id,
                                })
                                setFixing(null)
                                setAsking(false)
                                setFixReason('')
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFixing(c.id)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Correct this charge
                        </button>
                      )
                    )}
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-bold tabular-nums">{ugx(f.total)}</dd>
                </div>
                {tax && (vatInside > 0 || taxLines > 0) && (
                  <div className="rounded-lg bg-brand/[0.06] p-2.5 text-xs text-ink/70">
                    <p className="font-semibold text-ink/80">Tax summary</p>
                    {vatInside > 0 && (
                      <p className="mt-1 flex justify-between gap-4">
                        <span>VAT {Math.round(tax.vatRate * 100)}% included in the amounts above</span>
                        <span className="tabular-nums">{ugx(vatInside)}</span>
                      </p>
                    )}
                    {taxLines > 0 && (
                      <p className="mt-1 flex justify-between gap-4">
                        <span>Taxes and service charge added at check-in</span>
                        <span className="tabular-nums">{ugx(taxLines)}</span>
                      </p>
                    )}
                  </div>
                )}
              </dl>
            </div>

            <div>
              <p className={heading}>Payments</p>
              <dl className="mt-2 space-y-2 text-sm">
                {f.earlier > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/60">Deposit and earlier payments</dt>
                    <dd className="font-medium tabular-nums">{ugx(f.earlier)}</dd>
                  </div>
                )}
                {(r.payments ?? []).map((p) => (
                  <div key={p.id} className="flex justify-between gap-4">
                    <dt className="text-ink/60">
                      {p.method}
                      {p.reference ? ` · ${p.reference}` : ''}
                      <span className="block text-xs">{p.at}</span>
                    </dt>
                    <dd className="font-medium tabular-nums">{ugx(p.amount)}</dd>
                  </div>
                ))}
                {f.earlier <= 0 && (r.payments ?? []).length === 0 && <p className="text-ink/55">Nothing paid yet.</p>}
                <div className="flex justify-between gap-4 border-t border-ink/10 pt-2">
                  <dt className="font-semibold">Paid</dt>
                  <dd className="font-bold tabular-nums">{ugx(f.paid)}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPrinting(true)}>
                {r.invoice ? 'Print tax invoice' : owed <= 0 ? 'Print receipt' : 'Print folio'}
              </Button>
              <span className="self-center text-xs text-ink/55">
                {r.invoice ? 'The invoice as issued at check-out.' : 'A copy of the folio so far, for the guest.'}
              </span>
            </div>

            {r.invoice && (
              <div className="rounded-lg border border-good/40 bg-good/10 p-3 text-sm">
                <p className="font-semibold text-good">Checked out {r.checkedOutAt}</p>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/60">Invoice</dt>
                    <dd className="font-medium">{r.invoice.number}</dd>
                  </div>
                  {r.invoice.roomNote && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink/60">Room</dt>
                      <dd className="text-right font-medium">{r.invoice.roomNote}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/60">Amount</dt>
                    <dd className="font-medium tabular-nums">{ugx(r.invoice.amount)}</dd>
                  </div>
                  {vatInside > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink/60">Includes VAT</dt>
                      <dd className="font-medium tabular-nums">{ugx(vatInside)}</dd>
                    </div>
                  )}
                  {r.invoice.fiscal === 'exempt' ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink/60">EFRIS</dt>
                      <dd className="text-right font-medium">Exempt{r.invoice.exemptReason ? `: ${r.invoice.exemptReason}` : ''}</dd>
                    </div>
                  ) : r.invoice.fiscal === 'notSet' ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink/60">EFRIS</dt>
                      <dd className="font-medium text-warn">Not set up. Open Admin, Taxes and EFRIS.</dd>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink/60">Fiscal document no.</dt>
                        <dd className="font-medium">{r.invoice.fiscalCode}</dd>
                      </div>
                      {r.invoice.verification && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-ink/60">Verification code</dt>
                          <dd className="font-medium">{r.invoice.verification}</dd>
                        </div>
                      )}
                      {r.invoice.tin && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-ink/60">Seller TIN</dt>
                          <dd className="font-medium">{r.invoice.tin}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
                {r.unpaidAtCheckout && (
                  <p className="mt-2 text-bad">
                    Left with {ugx(r.unpaidAtCheckout)} unpaid. Reason: {r.checkoutNote}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink/60">
                  This is a simulated invoice. In the real system the URA EFRIS system returns the fiscal code. Room {r.room} is now dirty and waiting for housekeeping.
                </p>
              </div>
            )}
          </>
        )}

        {tab === 'charge' && live && (
          <div className="space-y-3">
            <p className={heading}>Add a charge</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1`}>
                  {chargeCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Amount (UGX)
                <input inputMode="numeric" value={chargeText} onChange={(e) => setChargeText(e.target.value)} className={`${field} mt-1`} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Description
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="For example: dinner for two"
                className={`${field} mt-1`}
              />
            </label>
            <Button variant="secondary" onClick={postCharge} disabled={!chargeValid}>
              Post charge
            </Button>
          </div>
        )}

        {tab === 'payment' && live && (
          <div className="space-y-3">
            <p className={heading}>Take a payment</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Method
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${field} mt-1`}>
                  {paymentMethods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Amount (UGX)
                <input inputMode="numeric" value={payText} onChange={(e) => setPayText(e.target.value)} className={`${field} mt-1`} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Reference (optional)
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Mobile money transaction ID or card slip"
                className={`${field} mt-1`}
              />
            </label>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={takePayment} disabled={!payValid}>
                Record payment
              </Button>
              {owed > 0 && (
                <button type="button" onClick={() => setPayText(String(owed))} className="text-sm font-semibold text-brand">
                  Pay full balance
                </button>
              )}
            </div>
            {payAmount > owed && <p className="text-xs text-bad">That is more than the guest owes.</p>}
            <p className="text-xs text-ink/60">
              Payments are simulated here. In the real system a mobile money payment is recorded only after the provider confirms it.
            </p>
          </div>
        )}

        {tab === 'out' && live && (
          <div className="space-y-3">
            <p className={heading}>Check out</p>
            {r.departure <= TODAY && late.kind !== 'none' && !lateCharged && (
              <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm">
                <p className="font-semibold text-warn">Past check-out time ({stayTimes.checkOutTime})</p>
                <p className="mt-0.5 text-xs text-ink/70">
                  It is {clock}. Rule: free until {stayTimes.lateFreeUntil}, half a night until {stayTimes.lateHalfUntil}, then a
                  full night. {late.label}: {ugx(late.amount)}.
                </p>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => addCharge(r.id, { category: 'Late check-out', description: late.label, amount: late.amount })}
                  >
                    Add late check-out charge {ugx(late.amount)}
                  </Button>
                </div>
              </div>
            )}
            {lateCharged && <p className="rounded-lg bg-good/10 p-2.5 text-xs font-semibold text-good">Late check-out charge is on the folio.</p>}
            {r.departure !== TODAY && (
              <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">
                Departure is booked for {dayMonth(r.departure)}. If the guest is leaving on a different day, use Change stay first so the room charges are right.
              </p>
            )}
            {owed > 0 ? (
              <>
                <p className="rounded-lg bg-bad/10 p-3 text-sm text-bad">
                  The guest still owes {ugx(owed)}. Take the payment, or a manager can authorise check-out with a reason.
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={authorise} onChange={(e) => setAuthorise(e.target.checked)} className="mt-1" />
                  <span>Manager authorises check-out with the balance unpaid.</span>
                </label>
                {authorise && (
                  <label className="block text-sm font-medium">
                    Manager reason
                    <input
                      value={authReason}
                      onChange={(e) => setAuthReason(e.target.value)}
                      placeholder="At least 5 characters"
                      className={`${field} mt-1`}
                    />
                    <span className="mt-1 block text-xs font-normal text-ink/60">
                      Manager approval is simulated here. The real system asks a manager to approve and logs who did.
                    </span>
                  </label>
                )}
              </>
            ) : (
              <p className="rounded-lg bg-good/10 p-3 text-sm text-good">The balance is settled. The guest can check out.</p>
            )}
            <Button className="w-full" onClick={confirmCheckOut} disabled={!canOut}>
              Check out and issue invoice
            </Button>
            {features.expressCheckout && r.status === 'in-house' && (
              <div className="rounded-xl bg-brand/[0.06] p-3">
                <p className="text-sm font-semibold text-ink">Leaving without stopping at the desk</p>
                {expressNow.ok ? (
                  <>
                    <p className="mt-0.5 text-xs text-ink/70">
                      {expressNow.guestOwed > 0
                        ? `On the morning they leave, ${ugx(expressNow.guestOwed)} goes to ${expressNow.chargeTo} and the bill is sent to them.`
                        : 'There is nothing to collect from the guest, so they can simply go.'}
                    </p>
                    <div className="mt-2">
                      {express === 'agreed' ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs font-semibold text-good">Agreed {r.express?.agreedAt}</span>
                          <button type="button" className="text-xs font-semibold text-bad" onClick={() => cancelExpress(r.id)}>
                            Cancel it
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => agreeExpress(r.id, me, 'desk')}>
                          The guest agrees
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-0.5 text-xs text-ink/70">{expressNow.why && REFUSAL_NOTE[expressNow.why]}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    {printing && (
      <DocumentDialog
        doc={folioDoc(r, tenant.name, user?.name ?? 'Front desk', { vatInside, vatRate: tax?.vatRate })}
        onClose={() => setPrinting(false)}
      />
    )}
    </div>
  )
}
