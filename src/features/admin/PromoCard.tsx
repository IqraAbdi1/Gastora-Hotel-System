import { useState } from 'react'
import { Badge, Button, Card, Field, Input } from '../../components/ui'
import { describePromo, newPromoId, tidyCode } from '../../lib/promos'
import type { Promo } from '../../lib/promos'
import { roomTypeList } from '../../lib/rates'
import type { RatesPolicy } from '../../lib/rates'
import type { Room } from '../../types'

const box = 'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink'
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * Codes the hotel gives out, each with its own limits and its own tally.
 *
 * The tally is the point. A rate nobody can count is a rate nobody can judge: a code tells the hotel
 * what the radio advertisement or the conference list actually brought in, which a quiet discount
 * never does.
 */
export default function PromoCard({ rates, set }: { rates: RatesPolicy; set: (patch: Partial<RatesPolicy>) => void }) {
  const promos = rates.promos ?? []
  const [open, setOpen] = useState(false)

  const change = (id: string, patch: Partial<Promo>) =>
    set({ promos: promos.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  return (
    <Card
      title="Promotional codes"
      icon="money"
      count={promos.length}
      padded
      description="A price offered to people who know a word, and counted afterwards."
    >
      <ul className="space-y-2">
        {promos.map((p) => {
          const spent = p.maxUses > 0 && p.used >= p.maxUses
          return (
            <li key={p.id} className="rounded-lg border border-ink/10 p-3">
              <div className="grid gap-2 sm:grid-cols-[9rem_1fr_7rem_6rem]">
                <Input
                  value={p.code}
                  onChange={(e) => change(p.id, { code: tidyCode(e.target.value) })}
                  aria-label="Code"
                  className="font-mono uppercase"
                />
                <Input
                  value={p.name}
                  onChange={(e) => change(p.id, { name: e.target.value })}
                  aria-label={`${p.code} name`}
                  placeholder="What it is for"
                />
                <select
                  value={p.how}
                  onChange={(e) => change(p.id, { how: e.target.value as Promo['how'] })}
                  aria-label={`${p.code} how`}
                  className={box}
                >
                  <option value="percent">% off</option>
                  <option value="amount">UGX a night</option>
                </select>
                <Input
                  inputMode="numeric"
                  className="tabular-nums"
                  value={String(p.value)}
                  onChange={(e) => change(p.id, { value: num(e.target.value) })}
                  aria-label={`${p.code} value`}
                />
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-5">
                <Field label="Stays from">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={p.from ?? ''}
                      onChange={(e) => change(p.id, { from: e.target.value || undefined })}
                      className={box}
                    />
                  )}
                </Field>
                <Field label="Stays to">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={p.to ?? ''}
                      onChange={(e) => change(p.id, { to: e.target.value || undefined })}
                      className={box}
                    />
                  )}
                </Field>
                <Field label="Book by">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={p.bookBy ?? ''}
                      onChange={(e) => change(p.id, { bookBy: e.target.value || undefined })}
                      className={box}
                    />
                  )}
                </Field>
                <Field label="Least nights">
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      className="tabular-nums"
                      value={String(p.minNights ?? 0)}
                      onChange={(e) => change(p.id, { minNights: num(e.target.value) || undefined })}
                    />
                  )}
                </Field>
                <Field label="Times allowed" hint="0 is no limit">
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      className="tabular-nums"
                      value={String(p.maxUses)}
                      onChange={(e) => change(p.id, { maxUses: num(e.target.value) })}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {roomTypeList.map((t) => {
                  const on = (p.types ?? []).includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = on ? (p.types ?? []).filter((x) => x !== t) : [...(p.types ?? []), (t as Room['type'])]
                        change(p.id, { types: next.length ? next : undefined })
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                        on ? 'bg-brand/10 text-brand ring-brand/30' : 'bg-ink/5 text-ink/55 ring-ink/10'
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
                <span className="self-center text-xs text-ink/45">
                  {(p.types ?? []).length === 0 ? 'Every room type' : 'Only these types'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="flex flex-wrap items-center gap-2 text-ink/60">
                  <Badge tone={spent ? 'bad' : p.on ? 'good' : 'neutral'} dot={p.on}>
                    {spent ? 'Used up' : p.on ? 'Offered' : 'Off'}
                  </Badge>
                  {describePromo(p)} · used {p.used}
                  {p.maxUses > 0 ? ` of ${p.maxUses}` : ' times'}
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-ink/70">
                    <input type="checkbox" checked={p.on} onChange={(e) => change(p.id, { on: e.target.checked })} />
                    Offered
                  </label>
                  <button
                    type="button"
                    className="font-semibold text-bad"
                    onClick={() => set({ promos: promos.filter((x) => x.id !== p.id) })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          )
        })}
        {promos.length === 0 && <li className="text-xs text-ink/55">No codes. Everyone pays the published price.</li>}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            set({
              promos: [
                ...promos,
                { id: newPromoId(promos), code: `CODE${promos.length + 1}`, name: '', how: 'percent', value: 10, maxUses: 0, used: 0, on: false },
              ],
            })
          }
        >
          Add a code
        </Button>
        <button type="button" onClick={() => setOpen(!open)} className="text-xs font-semibold text-brand">
          {open ? 'Hide the rules' : 'How codes behave'}
        </button>
      </div>

      {open && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink/65">
          <li>One code per booking.</li>
          <li>A code never applies on top of a company's agreed price.</li>
          <li>Counted when the booking is made.</li>
          <li>The guest is told why a code was refused.</li>
          <li>Editing a code does not change past bookings.</li>
        </ul>
      )}
      <p className="mt-2 text-xs text-ink/55">
        Codes work on the hotel's own booking page only.
      </p>
      {promos.some((p) => p.used > 0) && (
        <p className="mt-1 text-xs text-ink/70">
          Used so far:{' '}
          {promos
            .filter((p) => p.used > 0)
            .map((p) => `${tidyCode(p.code)} ${p.used}`)
            .join(' · ')}
          . What each one gave away is recorded on the bookings themselves.
        </p>
      )}
    </Card>
  )
}
