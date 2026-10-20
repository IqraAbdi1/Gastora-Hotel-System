import { useState } from 'react'
import Switch from '../../components/Switch'
import { Badge, Button, Card, PageHeader, Tabs } from '../../components/ui'
import { useHotel } from '../../lib/hotelContext'
import { FEATURES, PLANS } from '../../lib/features'
import { slugOf } from '../../lib/bookingEngine'
import { dayMonth } from '../../lib/format'
import { AREA_FREQUENCY_LABEL, newAreaId } from '../../lib/cleaning'
import type { AreaFrequency, CleaningArea } from '../../lib/cleaning'
import { useFeatures } from '../platform/featuresContext'

const box =
  'mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal tabular-nums'
const cell = 'min-w-0 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'

type SettingsTab = 'hotel' | 'desk' | 'housekeeping' | 'maintenance'

// The first tab: what the hotel has, and the one link it needs to hand out.
function YourHotel() {
  const { tenant, features } = useFeatures()
  const [copied, setCopied] = useState(false)
  const plan = PLANS.find((p) => p.id === tenant.plan)
  const slug = slugOf(tenant.name)
  const link = `${window.location.origin}/book/${slug}`
  const on = FEATURES.filter((f) => features[f.key])
  const off = FEATURES.filter((f) => !features[f.key])

  function copy() {
    navigator.clipboard?.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <div className="space-y-5">
      {features.bookingEngine && (
        <Card title="Your booking page" description="Put this link on your website, your Instagram bio and your Google listing. Guests book and pay their deposit there.">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 truncate rounded-lg border border-ink/10 bg-canvas px-3 py-2 font-mono text-sm text-ink">
              {slug}.gastora.ug/book
            </p>
            <Button variant="ghost" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <a href={`/book/${slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Open
            </a>
          </div>
          <p className="mt-2 text-xs text-ink/50">
            The address above is the one your hotel gets when it goes live. In this demonstration, Copy gives the link that works on
            this computer.
          </p>
        </Card>
      )}

      <Card
        title="Your plan"
        actions={<Badge tone="brand">{plan?.label ?? tenant.plan}</Badge>}
        description={`${on.length} of ${FEATURES.length} features are on. To add one, contact Gastora.`}
      >
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {on.map((f) => (
            <li key={f.key} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-good" aria-hidden="true" />
              <span>
                <span className="font-medium text-ink">{f.label}</span>
                <span className="block text-xs text-ink/55">{f.blurb}</span>
              </span>
            </li>
          ))}
        </ul>
        {off.length > 0 && (
          <details className="mt-4 border-t border-ink/10 pt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-brand">Not on your plan ({off.length})</summary>
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {off.map((f) => (
                <li key={f.key} className="text-ink/55">
                  {f.label}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  )
}

export default function HotelSettingsPage() {
  const { tenant, features, options, setOptions, stayTimes, setStayTimes } = useFeatures()
  const { resetDemo } = useHotel()
  const [resetAt, setResetAt] = useState('')
  const [tab, setTab] = useState<SettingsTab>('hotel')

  const patchArea = (id: string, patch: Partial<CleaningArea>) =>
    setOptions({ areas: options.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) })

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Hotel settings" description={`${tenant.name}. How your hotel runs: the rules the system follows for you.`} />

      {tenant.status === 'overdue' && (
        <div className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-ink">
          <strong>Payment overdue.</strong> Your paid features stay on for now. Please settle your
          account to avoid them being switched off.
        </div>
      )}
      {tenant.status === 'suspended' && (
        <div className="rounded-lg bg-bad/10 px-4 py-3 text-sm text-ink">
          <strong>Account suspended.</strong> Paid features are off. Your data is safe and returns
          when your account is settled.
        </div>
      )}

      <Tabs
        label="Settings"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'hotel', label: 'Your hotel' },
          { key: 'desk', label: 'Front desk' },
          { key: 'housekeeping', label: 'Housekeeping' },
          ...(features.slaEscalation ? [{ key: 'maintenance' as const, label: 'Maintenance' }] : []),
        ]}
      />

      {tab === 'hotel' && <YourHotel />}

      {tab === 'maintenance' && features.slaEscalation && (
        <section className="rounded-xl border border-ink/10 bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Repair targets</h2>
              <p className="mt-1 text-xs text-ink/60">
                How long a repair may take before it goes up. The answer target is how long before anybody picks it
                up; the fix target is how long before it is closed. A repair waiting for a part from the store does
                not go up: its clock is stopped.
              </p>
            </div>
            <Switch
              on={options.sla.on}
              label="Repair targets"
              onChange={(v) => setOptions({ sla: { ...options.sla, on: v } })}
            />
          </div>

          {options.sla.on && (
            <>
              <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
                {(['Urgent', 'High', 'Normal'] as const).map((level) => (
                  <div key={level} className="grid gap-3 sm:grid-cols-[120px_1fr_1fr] sm:items-center">
                    <p className="text-sm font-medium text-ink">{level}</p>
                    <label className="text-xs text-ink/60">
                      Hours to pick it up
                      <input
                        type="number"
                        min={1}
                        value={options.sla.targets[level].answerHours}
                        onChange={(e) =>
                          setOptions({
                            sla: {
                              ...options.sla,
                              targets: {
                                ...options.sla.targets,
                                [level]: { ...options.sla.targets[level], answerHours: Math.max(1, Number(e.target.value)) },
                              },
                            },
                          })
                        }
                        className={box}
                      />
                    </label>
                    <label className="text-xs text-ink/60">
                      Hours to close it
                      <input
                        type="number"
                        min={1}
                        value={options.sla.targets[level].fixHours}
                        onChange={(e) =>
                          setOptions({
                            sla: {
                              ...options.sla,
                              targets: {
                                ...options.sla.targets,
                                [level]: { ...options.sla.targets[level], fixHours: Math.max(1, Number(e.target.value)) },
                              },
                            },
                          })
                        }
                        className={box}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <label className="mt-4 block text-xs text-ink/60 sm:max-w-xs">
                Goes up to the manager once it is this many times past the fix target
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={options.sla.secondStepAt}
                  onChange={(e) => setOptions({ sla: { ...options.sla, secondStepAt: Math.max(1, Number(e.target.value)) } })}
                  className={box}
                />
              </label>
            </>
          )}
        </section>
      )}

      {tab === 'desk' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">Returning guests</h2>
            <p className="mt-1 text-xs text-ink/60">
               When a guest reaches a tier on finished stays or nights, whichever comes first. The discount is on the
              room only, and never on top of a company price.
            </p>
          </div>
          <Switch
            on={options.loyalty.on}
            label="Returning guests"
            onChange={(v) => setOptions({ loyalty: { ...options.loyalty, on: v } })}
          />
        </div>

        {options.loyalty.on && (
          <>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Give the discount automatically</p>
                <p className="text-xs text-ink/60">
                  Off means the front desk sees the reward but a manager must approve it with their PIN.
                </p>
              </div>
              <Switch
                on={options.loyalty.autoApply}
                label="Give the discount automatically"
                onChange={(v) => setOptions({ loyalty: { ...options.loyalty, autoApply: v } })}
              />
            </div>

            <div className="mt-4 space-y-4">
              {options.loyalty.tiers.map((t, i) => {
                const patch = (p: Partial<typeof t>) =>
                  setOptions({
                    loyalty: {
                      ...options.loyalty,
                      tiers: options.loyalty.tiers.map((x) => (x.id === t.id ? { ...x, ...p } : x)),
                    },
                  })
                const num = (v: string) => Number(v.replace(/\D/g, '')) || 0
                return (
                  <div key={t.id} className="rounded-lg border border-ink/10 bg-canvas/60 p-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <label className="block text-sm font-medium text-ink">
                        Tier {i + 1} name
                        <input
                          value={t.name}
                          onChange={(e) => patch({ name: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal"
                        />
                      </label>
                      <label className="block text-sm font-medium text-ink">
                        From this many stays
                        <input
                          inputMode="numeric"
                          value={String(t.minStays)}
                          onChange={(e) => patch({ minStays: num(e.target.value) })}
                          className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal tabular-nums"
                        />
                      </label>
                      <label className="block text-sm font-medium text-ink">
                        Or this many nights
                        <input
                          inputMode="numeric"
                          value={String(t.minNights)}
                          onChange={(e) => patch({ minNights: num(e.target.value) })}
                          className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal tabular-nums"
                        />
                      </label>
                      <label className="block text-sm font-medium text-ink">
                        Room discount %
                        <input
                          inputMode="numeric"
                          value={String(t.discountPercent)}
                          onChange={(e) => patch({ discountPercent: Math.min(100, num(e.target.value)) })}
                          className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal tabular-nums"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-5">
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={t.freeUpgrade} onChange={(e) => patch({ freeUpgrade: e.target.checked })} />
                        Free upgrade when a better room is free
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={t.lateCheckout} onChange={(e) => patch({ lateCheckout: e.target.checked })} />
                        Late check-out at no charge
                      </label>
                    </div>
                    <label className="mt-3 block text-sm font-medium text-ink">
                      Anything else this tier gets
                      <input
                        value={t.perks.join(', ')}
                        onChange={(e) => patch({ perks: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                        placeholder="Welcome drink, airport pickup"
                        className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal"
                      />
                      <span className="mt-1 block text-xs font-normal text-ink/55">Separate them with commas.</span>
                    </label>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
      )}

      {tab === 'desk' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <h2 className="font-semibold text-ink">Approving money off a folio</h2>
        <p className="mt-1 text-xs text-ink/60">
          Rule: the bigger the amount, the more senior the approval. The manager types their own PIN; the front desk cannot
          type it for them.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              { key: 'manager', label: 'A manager may approve up to (UGX)' },
              { key: 'finance', label: 'Finance may approve up to (UGX)' },
              { key: 'coSignAbove', label: 'Two people must sign above (UGX)' },
            ] as const
          ).map((f) => (
            <label key={f.key} className="block text-sm font-medium text-ink">
              {f.label}
              <input
                inputMode="numeric"
                value={String(options.limits[f.key])}
                onChange={(e) =>
                  setOptions({ limits: { ...options.limits, [f.key]: Number(e.target.value.replace(/\D/g, '')) || 0 } })
                }
                className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal tabular-nums"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/55">
          Above the manager's limit, finance approves. Above the last figure, the owner and finance both sign.
          {tenant.plan === 'starter' && ' On Starter there is one step: above the manager\'s limit the owner approves.'}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Take the approver's photo</p>
            <p className="text-xs text-ink/60">
              The camera takes one picture when the PIN is accepted, so a borrowed PIN shows the wrong face. If the computer
              has no camera it is recorded as no photo.
            </p>
          </div>
          <Switch
            on={options.limits.photoRequired}
            label="Take the approver's photo"
            onChange={(v) => setOptions({ limits: { ...options.limits, photoRequired: v } })}
          />
        </div>
      </section>
      )}

      {tab === 'desk' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <h2 className="font-semibold text-ink">Lost and found</h2>
        <label className="mt-2 block max-w-xs text-sm font-medium text-ink">
          Keep lost property for (days)
          <input
            inputMode="numeric"
            value={String(options.keepFoundDays)}
            onChange={(e) => setOptions({ keepFoundDays: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal tabular-nums"
          />
        </label>
        <p className="mt-1 text-xs text-ink/55">
          After this an item is flagged as held too long and may be disposed of. Your council or your own policy decides the
          number.
        </p>
      </section>
      )}

      {tab === 'desk' && features.expressCheckout && (
        <section className="rounded-xl border border-ink/10 bg-surface p-5">
          <h2 className="font-semibold text-ink">Leaving without stopping at the desk</h2>
          <p className="mt-1 text-xs text-ink/60">
            Rule: only a stay secured by a card or a company account can settle itself. A deposit already taken cannot be
            charged again, so those guests always settle at the desk.
          </p>
          <label className="mt-3 block max-w-xs text-sm font-medium text-ink">
            Settle by itself up to (UGX)
            <input
              inputMode="numeric"
              value={String(options.expressMax)}
              onChange={(e) => setOptions({ expressMax: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              className={box}
            />
          </label>
          <p className="mt-1 text-xs text-ink/55">
            Above this a person looks at it before the guest leaves. 0 means no ceiling, which is a decision rather than
            a setting: it says any bill at all may be charged with nobody watching.
          </p>
          {features.guestPortal && (
            <div className="mt-4 flex items-start justify-between gap-4 border-t border-ink/10 pt-3">
              <div>
                <p className="text-sm font-medium text-ink">Guests finish online check-out themselves</p>
                <p className="mt-0.5 text-xs text-ink/55">
                  On the day they leave, a guest who checks out from their own page is checked out at once when the rule
                  above allows it. Off, each one waits for one click at the desk on the Today page.
                </p>
              </div>
              <Switch
                on={options.guestFinishesCheckout}
                label="Guests finish online check-out themselves"
                onChange={(v) => setOptions({ guestFinishesCheckout: v })}
              />
            </div>
          )}
        </section>
      )}

      {tab === 'desk' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <h2 className="font-semibold text-ink">Guest records</h2>
        <p className="mt-1 text-xs text-ink/60">
          Rule: a guest's booking, the identification taken at check-in and their invoices are kept because the stay and
          the law require them. The profile — what they like, how often they come, what they earn — is kept only while
          the guest allows it.
        </p>
        <label className="mt-3 block max-w-xs text-sm font-medium text-ink">
          Keep a guest profile for (months after their last stay)
          <input
            inputMode="numeric"
            value={String(options.keepGuestMonths)}
            onChange={(e) => setOptions({ keepGuestMonths: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            className={box}
          />
        </label>
        <p className="mt-1 text-xs text-ink/55">
          After this the profile is cleared and the guest is no longer recognised. Their stays and invoices stay, because
          they must. Estimate: tax records are kept far longer than this; confirm the period with your accountant.
        </p>
      </section>
      )}

      {tab === 'housekeeping' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <h2 className="font-semibold text-ink">Servicing a room with a guest in it</h2>
        <p className="mt-1 text-xs text-ink/60">
          Rule: every occupied room is serviced each day. These two numbers decide what that means here.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink">
            Change the sheets every (nights)
            <input
              inputMode="numeric"
              value={String(options.service.linenDays)}
              onChange={(e) =>
                setOptions({
                  service: { ...options.service, linenDays: Number(e.target.value.replace(/\D/g, '')) || 1 },
                })
              }
              className={box}
            />
            <span className="mt-1 block text-xs font-normal text-ink/55">
              Towels are changed whenever the guest asks. Sheets on this cycle.
            </span>
          </label>
          <label className="block text-sm font-medium text-ink">
            Send a supervisor after (days with no service)
            <input
              inputMode="numeric"
              value={String(options.service.dndEscalateDays)}
              onChange={(e) =>
                setOptions({
                  service: { ...options.service, dndEscalateDays: Number(e.target.value.replace(/\D/g, '')) || 1 },
                })
              }
              className={box}
            />
            <span className="mt-1 block text-xs font-normal text-ink/55">
              A room nobody has entered for days is a welfare question, not a cleaning one.
            </span>
          </label>
        </div>
      </section>
      )}

      {tab === 'housekeeping' && features.hkZones && (
        <section className="rounded-xl border border-ink/10 bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Assign new tasks automatically</h2>
              <p className="mt-1 text-xs text-ink/60">
                Cleaning by zone. New work, such as a room just checked out, goes straight to the attendant on that
                floor or area with the least to do, and lands in her list in order. Off: it waits for the head of
                housekeeping to share it out.
              </p>
            </div>
            <Switch
              on={options.hkAutoAssign}
              label="Assign new tasks automatically"
              onChange={(v) => setOptions({ hkAutoAssign: v })}
            />
          </div>
        </section>
      )}

      {tab === 'housekeeping' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Public areas</h2>
            <p className="mt-1 text-xs text-ink/60">
              Corridors, the lobby, the pool. They go on the roster with the rooms and into the cleaning record.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand-deep">
            {options.areas.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {options.areas.map((a) => (
            <div
              key={a.id}
              className="grid items-center gap-2 rounded-lg border border-ink/10 bg-canvas/60 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_auto]"
            >
              <input
                aria-label="Area name"
                value={a.name}
                onChange={(e) => patchArea(a.id, { name: e.target.value })}
                className={cell}
              />
              <input
                aria-label="Where it is"
                value={a.where}
                onChange={(e) => patchArea(a.id, { where: e.target.value })}
                className={cell}
              />
              <select
                aria-label="How often"
                value={a.frequency}
                onChange={(e) => patchArea(a.id, { frequency: e.target.value as AreaFrequency })}
                className={cell}
              >
                {(['twice', 'daily', 'weekly'] as AreaFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {AREA_FREQUENCY_LABEL[f]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOptions({ areas: options.areas.filter((x) => x.id !== a.id) })}
                aria-label={`Remove ${a.name || 'this area'}`}
                className="rounded-lg px-2 py-2 text-sm text-ink/45 hover:bg-bad/10 hover:text-bad"
              >
                Remove
              </button>
            </div>
          ))}
          {options.areas.length === 0 && (
            <p className="text-sm text-ink/60">No public areas. Only rooms will be scheduled.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            setOptions({
              areas: [...options.areas, { id: newAreaId(options.areas), name: '', where: '', frequency: 'daily' }],
            })
          }
          className="mt-3 text-sm font-semibold text-brand hover:underline"
        >
          + Add an area
        </button>
      </section>
      )}

      {tab === 'desk' && features.roomAutoAssign && (
        <section className="rounded-xl border border-ink/10 bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Assign rooms each morning</h2>
              <p className="mt-1 text-xs text-ink/60">
                At the hour below, every arrival for the day that has no room is given one by the assignment rules, as if the desk had
                pressed Assign rooms. A room somebody chose by hand is never changed. Off unless you turn it on.
              </p>
            </div>
            <Switch
              on={options.autoAssign.on}
              label="Assign rooms each morning"
              onChange={(v) => setOptions({ autoAssign: { ...options.autoAssign, on: v } })}
            />
          </div>
          {options.autoAssign.on && (
            <label className="mt-3 block max-w-xs text-sm font-medium text-ink">
              Run at
              <input
                type="time"
                value={options.autoAssign.at}
                onChange={(e) => e.target.value && setOptions({ autoAssign: { ...options.autoAssign, at: e.target.value } })}
                className={box}
              />
              <span className="mt-1 block text-xs font-normal text-ink/55">
                {options.autoAssign.lastRun ? `Last ran on ${dayMonth(options.autoAssign.lastRun)}. ` : ''}In this prototype it runs only while the app is open.
              </span>
            </label>
          )}
        </section>
      )}

      {tab === 'desk' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">Night audit</h2>
            <p className="mt-1 text-xs text-ink/60">
              The end-of-day check: arrivals that never came, guests who should have left, and tonight's room charges. Switch
              it off if your hotel does not close the day this way.
            </p>
          </div>
          <Switch on={options.nightAudit} label="Night audit" onChange={(v) => setOptions({ nightAudit: v })} />
        </div>
        {options.nightAudit && (
          <label className="mt-3 block max-w-xs text-sm font-medium text-ink">
            Close the day at
            <input
              type="time"
              value={options.nightAuditAt}
              onChange={(e) => e.target.value && setOptions({ nightAuditAt: e.target.value })}
              className={box}
            />
            <span className="mt-1 block text-xs font-normal text-ink/55">
              At this hour the day closes itself: the figures are recorded and a booking that never arrived becomes a no-show, so
              tomorrow's arrivals are true. Somebody can still close it earlier by hand.
            </span>
          </label>
        )}
      </section>
      )}

      {tab === 'desk' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <h2 className="font-semibold text-ink">Check-in and check-out</h2>
        <p className="mt-1 text-xs text-ink/60">
          Rule: rooms are promised from the check-in time. Early check-in is free when a clean room is ready; otherwise the
          guest waits. Late check-out is free until the hour below, then half a night, then a full night.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { key: 'checkInTime', label: 'Check-in from' },
              { key: 'checkOutTime', label: 'Check-out by' },
              { key: 'lateFreeUntil', label: 'Late, free until' },
              { key: 'lateHalfUntil', label: 'Half night until' },
              { key: 'earlyFreeFrom', label: 'Early, free from' },
              { key: 'earlyFullBefore', label: 'Full night before' },
            ] as const
          ).map((t) => (
            <label key={t.key} className="block text-sm font-medium text-ink">
              {t.label}
              <input
                type="time"
                value={stayTimes[t.key]}
                onChange={(e) => e.target.value && setStayTimes({ [t.key]: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/55">
          After {stayTimes.lateHalfUntil} a full night is charged for leaving late. Arriving before {stayTimes.earlyFreeFrom} costs half a
          night, and before {stayTimes.earlyFullBefore} a full one, because the guest has slept a night the hotel could have sold.
        </p>
        <label className="mt-3 block max-w-sm text-sm font-medium text-ink">
          Partner hotel for overflow (optional)
          <input
            value={stayTimes.partnerHotel}
            onChange={(e) => setStayTimes({ partnerHotel: e.target.value })}
            placeholder="For example: Savannah Lodge"
            className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm font-normal"
          />
        </label>
        <p className="mt-1 text-xs text-ink/55">
          When no room and no upgrade is possible, the front desk is offered a task to move the guest there.
        </p>
      </section>
      )}

      {tab === 'housekeeping' && features.inspections && (
        <section className="rounded-xl border border-ink/10 bg-surface p-5">
          <h2 className="font-semibold text-ink">Room inspections</h2>
          <p className="mt-1 text-xs text-ink/60">
            These are rules decide which cleaned rooms a supervisor must check.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { id: 'spot', label: 'Spot-check' },
                { id: 'every', label: 'Every room' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setOptions({ inspectionMode: m.id })}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  options.inspectionMode === m.id
                    ? 'bg-brand text-white'
                    : 'border border-ink/15 text-ink hover:bg-canvas'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {options.inspectionMode === 'spot' && (
            <>
              <label className="mt-4 block text-sm text-ink">
                Share of rooms to inspect: <strong>{options.spotPercent}%</strong>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={10}
                  value={options.spotPercent}
                  onChange={(e) => setOptions({ spotPercent: Number(e.target.value) })}
                  className="mt-2 block w-full max-w-xs"
                />
              </label>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Always inspect rooms with a guest arriving today</p>
                  <p className="text-xs text-ink/60">
                    Off means a pure percentage, even for rooms promised to an arriving guest.
                  </p>
                </div>
                <Switch
                  on={options.alwaysInspectArrivals}
                  label="Always inspect rooms with a guest arriving today"
                  onChange={(v) => setOptions({ alwaysInspectArrivals: v })}
                />
              </div>
            </>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Rushed rooms skip inspection</p>
              <p className="text-xs text-ink/60">
                A room the front desk asked for first goes straight to ready, so the guest is not kept waiting.
              </p>
            </div>
            <Switch
              on={options.skipRushed}
              label="Rushed rooms skip inspection"
              onChange={(v) => setOptions({ skipRushed: v })}
            />
          </div>
        </section>
      )}

      {tab === 'hotel' && (
      <section className="rounded-xl border border-ink/10 bg-surface p-5">
        <p className="text-sm font-semibold text-ink">The demonstration</p>
        <p className="mt-0.5 text-xs text-ink/60">
          Bookings, rooms and guests are kept in this browser so that the guest's own pages - the pre-arrival form and the
          bill - see what the front desk sees when they are opened in another tab. Two tabs on this machine share it; two
          devices do not, which needs the real server.
        </p>
        <div className="mt-3">
          <Button
            variant="ghost"
            onClick={() => {
              resetDemo()
              setResetAt(new Date().toLocaleTimeString())
            }}
          >
            Put the sample data back
          </Button>
          {resetAt && <span className="ml-3 text-xs text-good">Reset at {resetAt}</span>}
        </div>
      </section>
      )}
    </div>
  )
}