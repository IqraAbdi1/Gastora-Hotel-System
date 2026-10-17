import { FEATURES, PLANS, featuresOf, planHas } from '../../lib/features'
import type { FeatureKey, TenantStatus } from '../../lib/features'
import Switch from '../../components/Switch'
import { useFeatures } from './featuresContext'

const STATUSES: { id: TenantStatus; label: string }[] = [
  { id: 'active', label: 'Paid up' },
  { id: 'overdue', label: 'Payment overdue' },
  { id: 'suspended', label: 'Suspended' },
]

export default function PlatformPage() {
  const { tenants, tenant: current, selectTenant, setPlan, setStatus, setOverride, clearOverrides } =
    useFeatures()

  /** Why a switch cannot be turned on yet, from the same rules the app uses. */
  function blockedBy(on: Record<FeatureKey, boolean>, key: FeatureKey): string | null {
    if (key === 'supplyChain' && (!on.requests || !on.stockControl)) return 'Needs Requests to management and Stock control.'
    if (key === 'budgetApproval' && !on.supplyChain) return 'Needs Supply chain.'
    if ((key === 'stores' || key === 'lossReports') && !on.stockControl) return 'Needs Stock control.'
    if (key === 'lossReversal' && !on.lossReports) return 'Needs Damaged & lost.'
    if (key === 'deptReturns' && !on.stockControl) return 'Needs Stock control.'
    return null
  }

  /** Features a plan change would switch off or on, so the admin sees it before clicking. */
  function planChange(tenantPlan: string, nextPlan: string) {
    const lost = FEATURES.filter((f) => planHas(tenantPlan as never, f.key) && !planHas(nextPlan as never, f.key))
    return lost.map((f) => f.label)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Platform admin</h1>
        <p className="mt-1 text-sm text-ink/60">
          You decide which features each hotel has paid for. Hotels cannot switch these themselves.
        </p>
        <p className="mt-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-ink/70">
          Prototype: this only hides screens. In the real system the backend stores each hotel&apos;s
          features and rejects calls for anything that is off.
        </p>
      </div>

      {tenants.map((t) => {
        const on = featuresOf(t)
        const isCurrent = t.id === current.id
        const hasOverrides = Object.keys(t.overrides).length > 0
        return (
          <section key={t.id} className="rounded-xl border border-ink/10 bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{t.name}</h2>
                <p className="text-xs text-ink/60">{t.rooms} rooms</p>
              </div>
              <button
                type="button"
                onClick={() => selectTenant(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isCurrent ? 'bg-brand text-white' : 'border border-ink/15 text-ink hover:bg-canvas'
                }`}
              >
                {isCurrent ? 'Showing this hotel in the app' : 'Show this hotel in the app'}
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">Plan</p>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(t.id, p.id)}
                      title={p.blurb}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        t.plan === p.id
                          ? 'bg-brand text-white'
                          : 'border border-ink/15 text-ink hover:bg-canvas'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink/50">
                  Changing the plan resets your one-off overrides.
                  {hasOverrides && ' This hotel has overrides, they will be lost.'}
                </p>
                {PLANS.filter((p) => p.id !== t.plan).map((p) => {
                  const lost = planChange(t.plan, p.id)
                  return lost.length > 0 ? (
                    <p key={p.id} className="mt-1 text-xs text-warn">
                      Moving to {p.label} switches off: {lost.join(', ')}.
                    </p>
                  ) : null
                })}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
                  Payment
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatus(t.id, s.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        t.status === s.id
                          ? s.id === 'active'
                            ? 'bg-good text-white'
                            : s.id === 'overdue'
                              ? 'bg-warn text-white'
                              : 'bg-bad text-white'
                          : 'border border-ink/15 text-ink hover:bg-canvas'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink/50">
                  Overdue keeps features on and warns the hotel admin. Suspended turns them off; data
                  is kept.
                </p>
              </div>
            </div>

            <ul className="mt-4 divide-y divide-ink/10 border-t border-ink/10">
              {FEATURES.map((f) => {
                const overridden = f.key in t.overrides
                const blocked = blockedBy(on, f.key)
                return (
                  <li key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {f.label}
                        <span className="ml-2 text-xs font-normal text-ink/50">
                          {overridden
                            ? 'Your override'
                            : planHas(t.plan, f.key)
                              ? 'In plan'
                              : 'Not in plan'}
                        </span>
                      </p>
                      <p className="text-xs text-ink/60">{blocked ?? f.blurb}</p>
                    </div>
                    <Switch
                      on={on[f.key]}
                      label={`${f.label} for ${t.name}`}
                      disabled={t.status === 'suspended' || !!blocked}
                      onChange={(v) => setOverride(t.id, f.key, v)}
                    />
                  </li>
                )
              })}
            </ul>
            {hasOverrides && (
              <button
                type="button"
                onClick={() => clearOverrides(t.id)}
                className="mt-2 text-xs font-medium text-brand hover:underline"
              >
                Reset to plan defaults
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}