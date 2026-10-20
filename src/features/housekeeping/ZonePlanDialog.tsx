import { useState } from 'react'
import Switch from '../../components/Switch'
import { Badge, Button, Modal } from '../../components/ui'
import { SHIFT_LABEL, hoursAndMinutes, urgencyRank } from '../../lib/hkAllocation'
import { TASK_MINUTES } from '../../lib/cleaning'
import { useHousekeeping } from './hkContext'
import { placeLabel } from './hkModel'

/**
 * The plan by zone, shown before anything changes. The supervisor reads it, and applies it or closes it.
 * Worked out by rules from the live list (see lib/hkAllocation.ts), not AI.
 */
export default function ZonePlanDialog({ onClose, onRoster }: { onClose: () => void; onRoster: () => void }) {
  const hk = useHousekeeping()
  const [reshare, setReshare] = useState(false)
  // Worked out once per choice, so the list does not shift under her while she reads it.
  const [plan, setPlan] = useState(() => hk.planByZone(false))
  function choose(next: boolean) {
    setReshare(next)
    setPlan(hk.planByZone(next))
  }
  const onToday = hk.roster.filter((r) => r.shift !== 'off')
  const total = plan.people.reduce((s, p) => s + p.minutes, 0)

  function apply() {
    hk.applyPlan(plan)
    onClose()
  }

  return (
    <Modal
      wide
      title="Share out by zone"
      description="Each person stays on her own floor or area where she can, and the minutes of work are evened out. Rooms with a guest arriving today and urgent work come first in each list."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={apply} disabled={plan.people.length === 0 || plan.changes === 0}>
            {plan.changes === 0 ? 'Nothing to change' : `Apply plan (${plan.changes} change${plan.changes === 1 ? '' : 's'})`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-canvas/60 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Also share out work already given but not started</p>
            <p className="text-xs text-ink/60">Off: only work with nobody on it is placed. Started work never moves.</p>
          </div>
          <Switch on={reshare} onChange={choose} label="Also share out work already given but not started" />
        </div>

        {onToday.length === 0 ? (
          <div className="rounded-xl border border-warn/30 bg-warn/[0.07] p-3 text-sm text-ink/80">
            <p className="font-semibold text-ink">Nobody is on the roster today</p>
            <p className="mt-0.5 text-xs">Put each attendant on a zone and a shift first.</p>
            <Button size="sm" className="mt-2" onClick={onRoster}>
              Open the roster
            </Button>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
            <Badge tone="brand">Rule</Badge>
            {plan.people.length} on today &middot; {hoursAndMinutes(total)} of work in all &middot; typical minutes: departure{' '}
            {TASK_MINUTES['Departure Clean']}, stayover {TASK_MINUTES['Stay Over']}, public area {TASK_MINUTES['Public Area']}. A
            Deluxe room counts a third more, a suite double.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {plan.people.map((p) => {
            const over = p.minutes > p.capacity
            const share = Math.min(100, Math.round((p.minutes / p.capacity) * 100))
            return (
              <section key={p.name} className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">{p.name}</h3>
                    <p className="text-xs text-ink/60">
                      {p.zone || 'No zone'} &middot; {SHIFT_LABEL[p.shift]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${over ? 'text-bad' : 'text-ink'}`}>
                      {hoursAndMinutes(p.minutes)}
                    </p>
                    <p className="text-xs text-ink/55">of {hoursAndMinutes(p.capacity)}</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                  <div className={`h-full rounded-full ${over ? 'bg-bad' : 'bg-brand'}`} style={{ width: `${share}%` }} />
                </div>
                {p.zones.length > 1 && (
                  <p className="mt-2 text-xs text-warn">Also goes to: {p.zones.filter((z) => z !== p.zone).join(', ')}</p>
                )}
                {p.items.length === 0 ? (
                  <p className="mt-3 text-sm text-ink/55">Nothing on her list.</p>
                ) : (
                  <ol className="mt-3 space-y-1.5">
                    {p.items.map((x, i) => (
                      <li key={x.item.id} className="flex items-start gap-2 rounded-lg bg-canvas/60 px-2 py-1.5 text-sm">
                        <span className="w-5 shrink-0 text-right text-xs font-semibold text-ink/45 tabular-nums">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink">
                            {placeLabel(x.item.place)}{' '}
                            <span className="font-normal text-ink/55">
                              &middot; {x.item.type}
                              {x.item.zone !== p.zone ? ` · ${x.item.zone}` : ''}
                            </span>
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {x.locked && <Badge tone="info">Started, stays</Badge>}
                            {x.item.arrivingToday && <Badge tone="warn">Guest arriving</Badge>}
                            {!x.item.arrivingToday && urgencyRank(x.item) === 0 && <Badge tone="bad">Urgent</Badge>}
                            {urgencyRank(x.item) === 1 && <Badge tone="warn">High</Badge>}
                            {x.from !== undefined && (
                              <Badge tone="brand">{x.from === 'Unassigned' ? 'New to her' : `From ${x.from}`}</Badge>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-ink/55 tabular-nums">{x.minutes} min</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </div>

        {plan.unplaced.length > 0 && (
          <p className="text-sm text-ink/70">
            {plan.unplaced.length} piece{plan.unplaced.length === 1 ? '' : 's'} of work stay unassigned:{' '}
            {plan.unplaced.map((w) => placeLabel(w.place)).join(', ')}.
          </p>
        )}
        <p className="text-xs text-ink/50">
          Walking between floors is not measured, only avoided. The minutes are typical figures, not this hotel&apos;s own
          timings.
        </p>
      </div>
    </Modal>
  )
}
