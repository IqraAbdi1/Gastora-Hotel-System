import Switch from '../../components/Switch'
import { FEATURES } from '../../lib/features'
import { useFeatures } from '../platform/featuresContext'

export default function HotelSettingsPage() {
  const { tenant, features, options, setOptions } = useFeatures()

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Hotel settings</h1>
        <p className="mt-1 text-sm text-ink/60">{tenant.name}</p>
      </div>

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

      <section className="rounded-xl border border-ink/10 bg-surface p-4">
        <h2 className="font-semibold text-ink">Your features</h2>
        <ul className="mt-2 divide-y divide-ink/10">
          {FEATURES.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{f.label}</p>
                <p className="text-xs text-ink/60">{f.blurb}</p>
              </div>
              {features[f.key] ? (
                <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-medium text-good">
                  On
                </span>
              ) : (
                <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink/60">
                  Not on your plan, contact Gastora
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {features.inspections && (
        <section className="rounded-xl border border-ink/10 bg-surface p-4">
          <h2 className="font-semibold text-ink">Room inspections</h2>
          <p className="mt-1 text-xs text-ink/60">
            These are rules, not AI. They decide which cleaned rooms a supervisor must check.
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
    </div>
  )
}