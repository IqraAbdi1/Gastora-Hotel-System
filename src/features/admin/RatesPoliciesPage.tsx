import { useState } from 'react'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui'
import { ugx } from '../../lib/format'
import {
  DEPOSIT_MODE_LABEL,
  DEPOSIT_MODE_NOTE,
  defaultHouseRules,
  depositExplained,
  depositFor,
  guaranteeRules,
  newPlanId,
  nightlyRate,
  roomTypeList,
} from '../../lib/rates'
import type { DepositMode, MealPlanSetting, RatesPolicy } from '../../lib/rates'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { useHotel } from '../../lib/hotelContext'
import { useFeatures } from '../platform/featuresContext'

const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * The hotel's own prices and booking rules. These are what an ordinary guest pays.
 * A company's agreed prices are not here: they belong to that company's account, under Companies.
 */
export default function RatesPoliciesPage() {
  const { tenant, options, setOptions, stayTimes } = useFeatures()
  const { can } = useAuth()
  const { accounts } = useCorporate()
  const { reservations } = useHotel()
  const [previewPlan, setPreviewPlan] = useState('')
  const [previewNights, setPreviewNights] = useState(3)
  const rates = options.rates
  const editable = can('changeSettings')

  const set = (patch: Partial<RatesPolicy>) => setOptions({ rates: { ...rates, ...patch } })
  const setPlan = (id: string, patch: Partial<MealPlanSetting>) =>
    set({ plans: rates.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  const addPlan = () =>
    set({ plans: [...rates.plans, { id: newPlanId(rates.plans), name: '', inclusions: '', extraPerNight: 0 }] })
  const removePlan = (id: string) => {
    set({ plans: rates.plans.filter((p) => p.id !== id) })
    if (previewPlan === id) setPreviewPlan('')
  }
  // A plan a guest is already booked on cannot be removed: the price they were sold would lose its meaning.
  const planInUse = (id: string) => reservations.some((r) => r.plan === id && r.status !== 'cancelled')

  // The wording is the hotel's own once it has typed one; until then it follows the times in Hotel settings.
  const houseRulesDefault = defaultHouseRules(stayTimes.checkInTime, stayTimes.checkOutTime)
  const houseRules = rates.houseRules || houseRulesDefault

  const shown = rates.plans.find((p) => p.id === previewPlan) ?? rates.plans[rates.plans.length - 1]

  const withAgreements = accounts.filter((a) => a.agreement && a.agreement.rules.length > 0)
  const guarantees = guaranteeRules(rates)

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        eyebrow="Admin"
        title="Rates and policies"
        description={`${tenant.name}. What an ordinary guest pays, and the rules for changing or cancelling.`}
        meta={<Badge tone={editable ? 'good' : 'neutral'}>{editable ? 'You can edit' : 'View only'}</Badge>}
      />

      <div className="rounded-xl border border-info/25 bg-info/[0.07] p-3 text-sm text-ink/80">
        <p className="font-semibold text-ink">These are the hotel's normal prices.</p>
        <p className="mt-0.5 text-xs">
          A company with an agreed price is not affected: those prices sit on the company's own account under Companies, and
          only apply to its bookings.
          {withAgreements.length > 0 && ` ${withAgreements.length} company account${withAgreements.length === 1 ? ' has' : 's have'} agreed prices.`}
        </p>
      </div>

      <fieldset disabled={!editable} className="space-y-5">
        <Card title="Room rates" icon="bed" padded description="The published price of one night, before any meal plan.">
          <div className="grid gap-3 sm:grid-cols-3">
            {roomTypeList.map((t) => (
              <Field key={t} label={`${t} per night (UGX)`}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(rates.roomRates[t])}
                    onChange={(e) => set({ roomRates: { ...rates.roomRates, [t]: num(e.target.value) } })}
                  />
                )}
              </Field>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/55">
            Changing a rate affects new bookings only. A booking already taken keeps the price it was sold at.
          </p>
        </Card>

        <Card title="Meal plans" icon="money" count={rates.plans.length} padded description="Added to the room rate, per night.">
          <div className="space-y-3">
            {rates.plans.map((p) => (
              <div key={p.id} className="grid gap-3 rounded-lg border border-ink/10 bg-canvas/60 p-3 sm:grid-cols-[1fr_2fr_auto]">
                <Field label="Name">
                  {(id) => <Input id={id} value={p.name} onChange={(e) => setPlan(p.id, { name: e.target.value })} />}
                </Field>
                <Field label="What the guest gets">
                  {(id) => <Input id={id} value={p.inclusions} onChange={(e) => setPlan(p.id, { inclusions: e.target.value })} />}
                </Field>
                <div className="flex items-end gap-2">
                  <Field label="Extra per night">
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="numeric"
                        className="w-32 tabular-nums"
                        value={String(p.extraPerNight)}
                        onChange={(e) => setPlan(p.id, { extraPerNight: num(e.target.value) })}
                      />
                    )}
                  </Field>
                  <button
                    type="button"
                    onClick={() => removePlan(p.id)}
                    disabled={rates.plans.length < 2 || planInUse(p.id)}
                    title={
                      planInUse(p.id)
                        ? 'A guest is booked on this plan'
                        : rates.plans.length < 2
                          ? 'Keep at least one plan'
                          : 'Remove this plan'
                    }
                    aria-label={`Remove ${p.name || 'this plan'}`}
                    className="mb-1 rounded-lg px-2 py-2 text-sm text-ink/45 hover:bg-bad/10 hover:text-bad disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink/45"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPlan}
            className="mt-3 text-sm font-semibold text-brand hover:underline"
          >
            + Add a meal plan
          </button>
          <div className="mt-3 rounded-lg bg-brand/[0.06] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">What a guest pays tonight</p>
              <Select
                aria-label="Meal plan to price"
                className="w-auto"
                value={shown?.id ?? ''}
                onChange={(e) => setPreviewPlan(e.target.value)}
              >
                {rates.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'Unnamed plan'}
                  </option>
                ))}
              </Select>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-ink/70">
              {roomTypeList.map((t) => (
                <li key={t} className="flex justify-between gap-4">
                  <span>
                    {t} · {shown?.name || 'Room only'}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {ugx(rates.roomRates[t] + (shown?.extraPerNight ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card
          title="Deposit"
          icon="money"
          padded
          description="What the desk asks for when it takes a booking. The desk can still change it."
        >
          <div className="space-y-2">
            {(['floor', 'nights', 'percent'] as DepositMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ depositMode: m })}
                aria-pressed={rates.depositMode === m}
                className={`block w-full rounded-lg px-4 py-3 text-left ring-1 transition ${
                  rates.depositMode === m ? 'bg-brand/[0.08] ring-brand' : 'bg-white ring-ink/15 hover:ring-brand/40'
                }`}
              >
                <span className="block text-sm font-semibold text-ink">{DEPOSIT_MODE_LABEL[m]}</span>
                <span className="mt-0.5 block text-xs text-ink/60">{DEPOSIT_MODE_NOTE[m]}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {rates.depositMode !== 'nights' && (
              <Field label="Share of the stay %">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(rates.depositPercent)}
                    onChange={(e) => set({ depositPercent: Math.min(100, num(e.target.value)) })}
                  />
                )}
              </Field>
            )}
            {rates.depositMode !== 'percent' && (
              <Field label="Nights it must cover">
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={String(rates.depositNights)}
                    onChange={(e) => set({ depositNights: Math.min(30, Math.max(1, num(e.target.value))) })}
                  />
                )}
              </Field>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-brand/[0.06] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">What the desk would ask for</p>
              <Select
                aria-label="Nights to price"
                className="w-auto"
                value={String(previewNights)}
                onChange={(e) => setPreviewNights(Number(e.target.value))}
              >
                {[1, 2, 3, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} night{n === 1 ? '' : 's'}
                  </option>
                ))}
              </Select>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-ink/70">
              {roomTypeList.map((t) => {
                const nightly = nightlyRate(t, 0, rates)
                const amount = depositFor(nightly, previewNights, rates)
                return (
                  <li key={t} className="flex justify-between gap-4">
                    <span>
                      {t} &middot; {ugx(nightly)} a night
                      <span className="block text-ink/50">{depositExplained(nightly, previewNights, rates)}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{ugx(amount)}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="mt-2 text-xs text-ink/55">
            A no-show keeps {rates.noShowNights} night{rates.noShowNights === 1 ? '' : 's'} of this, and the rest is
            refunded. A booking on a company account is not asked for a deposit: the account and its LPO are the
            guarantee.
          </p>
        </Card>

        <Card title="Changing a booking" icon="calendar" padded description="Extending a stay is always free.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Free this many days before arrival">
              {(id) => (
                <Input id={id} inputMode="numeric" className="tabular-nums" value={String(rates.changeFreeDays)} onChange={(e) => set({ changeFreeDays: num(e.target.value) })} />
              )}
            </Field>
            <Field label="Nights charged for a late change">
              {(id) => (
                <Input id={id} inputMode="numeric" className="tabular-nums" value={String(rates.changeFeeNights)} onChange={(e) => set({ changeFeeNights: num(e.target.value) })} />
              )}
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink/55">
            Moving or shortening a booking less than {rates.changeFreeDays} day{rates.changeFreeDays === 1 ? '' : 's'} before
            arrival costs {rates.changeFeeNights} night{rates.changeFeeNights === 1 ? '' : 's'}. A manager can still waive it.
          </p>
        </Card>

        <Card title="Cancelling and no-shows" icon="alert" padded>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Free this many days before arrival">
              {(id) => (
                <Input id={id} inputMode="numeric" className="tabular-nums" value={String(rates.cancelFreeDays)} onChange={(e) => set({ cancelFreeDays: num(e.target.value) })} />
              )}
            </Field>
            <Field label="Nights charged for a late cancellation">
              {(id) => (
                <Input id={id} inputMode="numeric" className="tabular-nums" value={String(rates.cancelChargeNights)} onChange={(e) => set({ cancelChargeNights: num(e.target.value) })} />
              )}
            </Field>
            <Field label="Nights charged for a no-show">
              {(id) => (
                <Input id={id} inputMode="numeric" className="tabular-nums" value={String(rates.noShowNights)} onChange={(e) => set({ noShowNights: num(e.target.value) })} />
              )}
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Release an unguaranteed booking at" hint="A booking with no deposit and no card is let go at this time on the arrival day.">
              {(id) => <Input id={id} type="time" className="w-40" value={rates.releaseTime} onChange={(e) => e.target.value && set({ releaseTime: e.target.value })} />}
            </Field>
            <label className="mt-2 flex items-start gap-2 text-sm text-ink/80">
              <input type="checkbox" className="mt-1" checked={rates.autoRelease} onChange={(e) => set({ autoRelease: e.target.checked })} />
              <span>
                Put the room back on sale by itself at that time.
                <span className="block text-xs text-ink/55">
                  Off, the front desk is told the room can be resold and presses the button. On, the hour does it and says so. A guest who
                  confirmed by phone is never released by the clock either way.
                </span>
              </span>
            </label>
          </div>
          <div className="mt-3 rounded-lg border border-ink/10 bg-canvas/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">What each guarantee means here</p>
            <ul className="mt-1.5 space-y-1 text-xs text-ink/70">
              <li><strong className="text-ink/80">Deposit paid:</strong> {guarantees.deposit}</li>
              <li><strong className="text-ink/80">Card guarantee:</strong> {guarantees.card}</li>
              <li><strong className="text-ink/80">Company account:</strong> {guarantees.company}</li>
              <li><strong className="text-ink/80">No guarantee:</strong> {guarantees.none}</li>
            </ul>
          </div>
        </Card>

        <Card
          title="House rules shown to the guest"
          icon="list"
          padded
          description="Printed on the registration card at check-in. Write whatever this hotel needs the guest to agree to."
          actions={
            rates.houseRules ? (
              <Button size="sm" variant="secondary" onClick={() => set({ houseRules: '' })}>
                Reset to the standard wording
              </Button>
            ) : undefined
          }
        >
          <Textarea
            rows={4}
            aria-label="House rules"
            value={houseRules}
            onChange={(e) => set({ houseRules: e.target.value })}
          />
          <p className="mt-2 text-xs text-ink/55">
            {rates.houseRules
              ? 'This hotel has written its own rules. Resetting brings back the wording built from your check-in and check-out times.'
              : 'The times come from Hotel settings, so there is one place to change them. Start typing to write the hotel\u2019s own rules.'}{' '}
            <a href="/admin" className="font-semibold text-brand hover:underline">Open hotel settings</a>
          </p>
        </Card>
      </fieldset>

      {!editable && (
        <p className="text-xs text-ink/55">Only the hotel admin or the owner can change prices and policies.</p>
      )}
      {editable && <p className="text-xs text-ink/55">Changes are saved as you type.</p>}
    </div>
  )
}
