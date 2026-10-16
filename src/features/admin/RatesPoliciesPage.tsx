import { Badge, Card, Field, Input, PageHeader, Textarea } from '../../components/ui'
import { ugx } from '../../lib/format'
import { guaranteeRules, roomTypeList } from '../../lib/rates'
import type { MealPlanSetting, RatesPolicy } from '../../lib/rates'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
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
  const rates = options.rates
  const editable = can('changeSettings')

  const set = (patch: Partial<RatesPolicy>) => setOptions({ rates: { ...rates, ...patch } })
  const setPlan = (id: string, patch: Partial<MealPlanSetting>) =>
    set({ plans: rates.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

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
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-brand/[0.06] p-3 text-sm">
            <p className="font-semibold text-ink">What a guest pays tonight</p>
            <ul className="mt-1 space-y-1 text-xs text-ink/70">
              {roomTypeList.map((t) => (
                <li key={t} className="flex justify-between gap-4">
                  <span>
                    {t} · {rates.plans[rates.plans.length - 1]?.name ?? 'top plan'}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {ugx(rates.roomRates[t] + (rates.plans[rates.plans.length - 1]?.extraPerNight ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Deposit" icon="money" padded description="What the desk suggests when it takes a booking. The desk can still change it.">
          <div className="max-w-40">
            <Field label="Suggested deposit %">
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
          </div>
          <p className="mt-2 text-xs text-ink/55">
            On a {ugx(rates.roomRates.Standard)} night that suggests {ugx(Math.round((rates.roomRates.Standard * rates.depositPercent) / 100 / 1000) * 1000)}.
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

        <Card title="House rules shown to the guest" icon="list" padded description="Printed on the registration card at check-in.">
          <Textarea
            rows={3}
            defaultValue={`Check-in from ${stayTimes.checkInTime}. Check-out by ${stayTimes.checkOutTime}. Smoking is not allowed in the rooms.`}
            readOnly
          />
          <p className="mt-2 text-xs text-ink/55">
            Times come from Hotel settings, so there is one place to change them.{' '}
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
