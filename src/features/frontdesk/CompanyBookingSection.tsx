import { useMemo, useState } from 'react'
import { Badge, Button, Input, Select } from '../../components/ui'
import { BILL_TO_LABEL, creditPosition, ruleText, STATUS_LABEL, TERMS_LABEL } from '../../lib/corporate'
import type { CompanyInput, CompanyPlan } from '../../lib/corporateBooking'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { BillTo } from '../../types'
import { useCorporate } from '../corporate/corporateContext'
import { BILL_TOS, creditText, statusTone } from '../corporate/corporateUi'

const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

// The company side of a new booking: which company, who is booking, who pays and which agreed
// price applies. Shows the original price, the discount and the final price before confirming.
export default function CompanyBookingSection({
  value,
  onChange,
  plan,
}: {
  value: CompanyInput | null
  onChange: (next: CompanyInput | null) => void
  plan: CompanyPlan | null
}) {
  const { accounts } = useCorporate()
  const { reservations } = useHotel()
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const text = q.trim().toLowerCase()
    if (!text) return accounts.filter((a) => a.status === 'active').slice(0, 5)
    return accounts
      .filter((a) => a.name.toLowerCase().includes(text) || a.tin.includes(text) || a.id.toLowerCase().includes(text))
      .slice(0, 6)
  }, [accounts, q])

  const on = value !== null
  const account = value ? accounts.find((a) => a.id === value.accountId) : undefined
  const set = (patch: Partial<CompanyInput>) => value && onChange({ ...value, ...patch })

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={heading}>Company booking</p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) =>
              onChange(e.target.checked ? { accountId: '', bookerContactId: '', bookerName: '', bookerPhone: '', claimedLpo: '', billTo: 'company-room', ruleIds: [] } : null)
            }
          />
          Book for a company
        </label>
      </div>

      {on && !account && (
        <div className="space-y-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company name, TIN or account number" className={field} autoFocus />
          {results.length === 0 ? (
            <p className="text-sm text-ink/60">No company found. A new company account must be requested on the Companies page and approved first.</p>
          ) : (
            <ul className="divide-y divide-ink/8 rounded-lg border border-ink/10">
              {results.map((a) => {
                const p = creditPosition(a, reservations)
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          accountId: a.id,
                          // Most company bookings come from the person the company listed, so start there.
                          bookerContactId: a.contacts.find((c) => c.active && c.canBook)?.id ?? '',
                          bookerName: '',
                          bookerPhone: '',
                          claimedLpo: '',
                          billTo: a.billing.defaultBillTo,
                          ruleIds: [],
                        })
                      }
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-canvas"
                    >
                      <span>
                        <span className="block text-sm font-semibold">{a.name}</span>
                        <span className="block text-xs text-ink/55">
                          {TERMS_LABEL[a.paymentTerms]}
                          {a.creditLimit > 0 && ` · ${creditText(p.available)}${p.available >= 0 ? ' credit available' : ''}`}
                        </span>
                      </span>
                      <Badge tone={statusTone[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {value && account && plan && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ink/10 bg-canvas/60 p-3">
            <div className="min-w-0">
              <p className="font-semibold">{account.name}</p>
              <p className="text-xs text-ink/60">
                {TERMS_LABEL[account.paymentTerms]}
                {account.creditLimit > 0 ? ` · ${creditText(plan.credit.available)}${plan.credit.available >= 0 ? ` of ${ugx(account.creditLimit)} credit available` : ''}` : ' · no credit'}
              </p>
              {account.billing.instructions && <p className="mt-1 text-xs text-ink/70">{account.billing.instructions}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone[account.status]} dot>
                {STATUS_LABEL[account.status]}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, accountId: '', bookerContactId: '' })}>
                Change
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Booked by
              <select
                value={value.bookerContactId}
                onChange={(e) => set({ bookerContactId: e.target.value })}
                className={`${field} mt-1`}
              >
                {account.contacts
                  .filter((c) => c.active && c.canBook)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.jobTitle}
                    </option>
                  ))}
                <option value="">Someone else, not on the company's list</option>
              </select>
              {value.bookerContactId ? (
                <span className="mt-1 block text-xs font-normal text-ink/60">
                  {account.contacts.find((c) => c.id === value.bookerContactId)?.phone}. From the company's list, so nothing
                  needs typing.
                </span>
              ) : (
                <span className="mt-1 block text-xs font-normal text-warn">
                  Not on the list. Their name and phone are needed, and they are checked at check-in.
                </span>
              )}
            </label>
            <label className="block text-sm font-medium">
              Who pays
              <Select value={value.billTo} onChange={(e) => set({ billTo: e.target.value as BillTo })} className="mt-1 bg-canvas">
                {BILL_TOS.map((t) => (
                  <option key={t} value={t}>
                    {BILL_TO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm font-medium md:col-span-2">
              LPO number, if the company has given one
              <Input
                value={value.claimedLpo}
                onChange={(e) => set({ claimedLpo: e.target.value })}
                placeholder="Leave blank if not yet given"
                className="mt-1 bg-canvas"
              />
              <span className="mt-1 block text-xs font-normal text-ink/60">Noted now and checked against the company's LPO at check-in.</span>
            </label>
            {!value.bookerContactId && (
              <>
                <label className="block text-sm font-medium">
                  Booker's name
                  <Input value={value.bookerName} onChange={(e) => set({ bookerName: e.target.value })} className="mt-1 bg-canvas" />
                </label>
                <label className="block text-sm font-medium">
                  Booker's phone
                  <Input value={value.bookerPhone} onChange={(e) => set({ bookerPhone: e.target.value })} className="mt-1 bg-canvas" />
                </label>
              </>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Company price</p>
            {plan.checks.length === 0 ? (
              <p className="text-sm text-ink/60">No agreed prices. The normal rate applies.</p>
            ) : (
              <ul className="space-y-1.5">
                {plan.checks.map(({ rule, ok, reason }) => {
                  const checked = value.ruleIds.includes(rule.id)
                  return (
                    <li key={rule.id}>
                      <label
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                          ok ? (checked ? 'border-brand bg-brand/5' : 'border-ink/10') : 'border-ink/8 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          disabled={!ok}
                          checked={checked && ok}
                          onChange={(e) =>
                            set({ ruleIds: e.target.checked ? [...value.ruleIds, rule.id] : value.ruleIds.filter((x) => x !== rule.id) })
                          }
                        />
                        <span>
                          <span className="font-medium">{rule.label}</span> · {ruleText(rule)}
                          {rule.requiresApproval && ok && <span className="block text-xs text-warn">Needs a manager's approval on this booking</span>}
                          {!ok && <span className="block text-xs text-ink/60">{reason}</span>}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {plan.selected.length > 0 && (
            <dl className="space-y-1 rounded-lg bg-canvas p-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/60">Normal price per night</dt>
                <dd>{ugx(plan.quote.perNightOriginal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Company price per night</dt>
                <dd className="font-medium">{ugx(plan.quote.perNightFinal)}</dd>
              </div>
              {plan.quote.planExtra > 0 && (
                <p className="text-xs text-ink/55">Includes the meal plan at the normal {ugx(plan.quote.planExtra)} per night. Company prices apply to the room only.</p>
              )}
              <div className="flex justify-between border-t border-ink/10 pt-1">
                <dt className="text-ink/60">Normal total, {plan.quote.nights} night{plan.quote.nights === 1 ? '' : 's'}</dt>
                <dd>{ugx(plan.quote.originalTotal)}</dd>
              </div>
              <div className="flex justify-between text-good">
                <dt>Company discount</dt>
                <dd>− {ugx(plan.quote.discountTotal)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Company total</dt>
                <dd>{ugx(plan.quote.finalTotal)}</dd>
              </div>
            </dl>
          )}

          {plan.errors.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-bad/10 p-3 text-sm text-bad">
              {plan.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {plan.notes.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-info/10 p-3 text-sm text-ink/80">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink/55">
            The guest's ID is checked at check-in. Claiming to work for the company does not, by itself, allow charges to its account.
          </p>
        </div>
      )}
    </section>
  )
}
