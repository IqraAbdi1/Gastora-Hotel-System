import { useState } from 'react'
import { FEATURES, PLANS, featuresOf, planHas } from '../../lib/features'
import type { FeatureKey, Tenant, TenantStatus } from '../../lib/features'
import Switch from '../../components/Switch'
import { Badge, Button, Card, DataTable, PageHeader, Segmented, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import NewHotelDialog from './NewHotelDialog'
import { useFeatures } from './featuresContext'

const STATUSES: { id: TenantStatus; label: string }[] = [
  { id: 'active', label: 'Paid up' },
  { id: 'overdue', label: 'Payment overdue' },
  { id: 'suspended', label: 'Suspended' },
]

const STATUS_TONE = { active: 'good', overdue: 'warn', suspended: 'bad' } as const

// The feature list grouped the way a hotel thinks about it. A feature not named here still shows,
// under "Other", so a new one is never hidden from the person who sells it.
const AREAS: { label: string; keys: string[] }[] = [
  {
    label: 'Front desk and guests',
    keys: ['idScan', 'preRegistration', 'waitlist', 'expressCheckout', 'groups', 'roomKeys', 'guestMessages', 'guestPortal', 'guestValue', 'loyaltyPoints', 'crossProperty', 'serviceBookings', 'roomAutoAssign', 'multiRoom', 'travelAgents'],
  },
  { label: 'Selling rooms', keys: ['bookingEngine', 'channels', 'revenue', 'taxLines'] },
  { label: 'Housekeeping', keys: ['inspections', 'roomCheck', 'hkZones'] },
  {
    label: 'Maintenance',
    keys: ['maintenanceFull', 'repairSignoff', 'assetRegister', 'assetCosts', 'preventiveMaintenance', 'maintenanceParts', 'slaEscalation', 'roomDowntime', 'engineeringDashboard'],
  },
  {
    label: 'Stock and purchasing',
    keys: ['requests', 'stockControl', 'lossReports', 'stores', 'deptReturns', 'batchExpiry', 'lossReversal', 'supplyChain', 'budgetApproval'],
  },
]

export default function PlatformPage() {
  const { tenants, tenant: current, selectTenant, setPlan, setStatus, setOverride, clearOverrides } = useFeatures()

  // Two different sales, one form. `adding` with no parent is a customer Gastora does not have;
  // with a parent it is a second property for one it already bills.
  const [adding, setAdding] = useState<{ branchOf?: Tenant } | null>(null)
  // The hotel open below the list. It starts on the one the app is showing.
  const [openId, setOpenId] = useState(current.id)
  const t = tenants.find((x) => x.id === openId) ?? current

  const sistersOf = (x: Tenant) => (x.group ? tenants.filter((y) => y.group === x.group && y.id !== x.id) : [])

  /** Why a switch cannot be turned on yet, from the same rules the app uses. */
  function blockedBy(on: Record<FeatureKey, boolean>, key: FeatureKey): string | null {
    if (key === 'supplyChain' && (!on.requests || !on.stockControl)) return 'Needs Requests to management and Stock control.'
    if (key === 'budgetApproval' && !on.supplyChain) return 'Needs Supply chain.'
    if ((key === 'stores' || key === 'lossReports' || key === 'batchExpiry') && !on.stockControl) return 'Needs Stock control.'
    if (key === 'lossReversal' && !on.lossReports) return 'Needs Damage and loss.'
    if (key === 'deptReturns' && !on.stockControl) return 'Needs Stock control.'
    return null
  }

  /** Features a plan change would switch off or on, so the admin sees it before clicking. */
  function planChange(tenantPlan: string, nextPlan: string) {
    const lost = FEATURES.filter((f) => planHas(tenantPlan as never, f.key) && !planHas(nextPlan as never, f.key))
    return lost.map((f) => f.label)
  }

  const rooms = tenants.reduce((n, x) => n + x.rooms, 0)
  const count = (s: TenantStatus) => tenants.filter((x) => x.status === s).length
  const planLabel = (id: string) => PLANS.find((p) => p.id === id)?.label ?? id

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Hotel',
      cell: (x) => (
        <div>
          <p className="font-semibold text-ink">
            {x.name}
            {x.id === current.id && <span className="ml-2 text-xs font-medium text-brand">In the app now</span>}
          </p>
          <p className="text-xs text-ink/55">{x.group ?? 'Stands on its own'}</p>
        </div>
      ),
    },
    { key: 'rooms', header: 'Rooms', align: 'right', cell: (x) => x.rooms },
    { key: 'plan', header: 'Plan', cell: (x) => <Badge tone="brand">{planLabel(x.plan)}</Badge> },
    {
      key: 'status',
      header: 'Payment',
      cell: (x) => (
        <Badge tone={STATUS_TONE[x.status]} dot>
          {STATUSES.find((s) => s.id === x.status)?.label}
        </Badge>
      ),
    },
    {
      key: 'features',
      header: 'Features on',
      hideBelow: 'md',
      align: 'right',
      cell: (x) => {
        const on = featuresOf(x)
        return `${FEATURES.filter((f) => on[f.key]).length} of ${FEATURES.length}`
      },
    },
  ]

  const on = featuresOf(t)
  const hasOverrides = Object.keys(t.overrides).length > 0
  const grouped = [
    ...AREAS.map((a) => ({ label: a.label, items: FEATURES.filter((f) => a.keys.includes(f.key)) })),
    { label: 'Other', items: FEATURES.filter((f) => !AREAS.some((a) => a.keys.includes(f.key))) },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform admin"
        description="Every hotel on Gastora: what plan it is on, whether it has paid, and which features it has."
        actions={<Button onClick={() => setAdding({})}>+ Add a hotel</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hotels" value={tenants.length} hint={PLANS.map((p) => `${tenants.filter((x) => x.plan === p.id).length} ${p.label}`).join(' · ')} />
        <StatCard label="Rooms on Gastora" value={rooms.toLocaleString('en-US')} hint="Across every hotel" />
        <StatCard label="Payment overdue" value={count('overdue')} tone={count('overdue') ? 'warn' : 'default'} hint="Features still on" />
        <StatCard label="Suspended" value={count('suspended')} tone={count('suspended') ? 'bad' : 'default'} hint="Features off, data kept" />
      </div>

      <Card title="Hotels" count={tenants.length} padded={false} description="Choose a hotel to change its plan, payment or features.">
        <DataTable columns={columns} rows={tenants} rowKey={(x) => x.id} onRowClick={(x) => setOpenId(x.id)} />
      </Card>

      <Card
        title={t.name}
        description={
          <>
            {t.rooms} rooms · {t.group ? t.group : 'stands on its own'}
            {sistersOf(t).length > 0 && ` · sees the free rooms of ${sistersOf(t).map((x) => x.name).join(', ')}`}
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAdding({ branchOf: t })}>
              Add a branch for this owner
            </Button>
            <Button size="sm" variant={t.id === current.id ? 'primary' : 'secondary'} onClick={() => selectTenant(t.id)}>
              {t.id === current.id ? 'Showing this hotel in the app' : 'Show this hotel in the app'}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Plan</p>
            <Segmented
              label={`Plan for ${t.name}`}
              options={PLANS.map((p) => ({ key: p.id, label: p.label }))}
              value={t.plan}
              onChange={(p) => setPlan(t.id, p)}
            />
            <p className="mt-2 text-xs text-ink/55">
              {PLANS.find((p) => p.id === t.plan)?.blurb} Changing the plan resets one-off overrides.
              {hasOverrides && ' This hotel has overrides, they will be lost.'}
            </p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-semibold text-brand">What a plan change would switch off</summary>
              {PLANS.filter((p) => p.id !== t.plan).map((p) => {
                const lost = planChange(t.plan, p.id)
                return (
                  <p key={p.id} className="mt-1.5 text-warn">
                    {lost.length > 0 ? `Moving to ${p.label} switches off: ${lost.join(', ')}.` : `Moving to ${p.label} switches nothing off.`}
                  </p>
                )
              })}
            </details>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Payment</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(t.id, s.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    t.status === s.id
                      ? s.id === 'active'
                        ? 'bg-good text-white'
                        : s.id === 'overdue'
                          ? 'bg-warn text-white'
                          : 'bg-bad text-white'
                      : 'border border-ink/15 text-ink/75 hover:bg-canvas'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/55">
              Overdue keeps features on and warns the hotel admin. Suspended turns them off; data is kept.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-x-8 gap-y-6 border-t border-ink/10 pt-5 lg:grid-cols-2">
          {grouped.map((g) => (
            <div key={g.label}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">{g.label}</p>
              <ul className="divide-y divide-ink/8">
                {g.items.map((f) => {
                  const overridden = f.key in t.overrides
                  const blocked = blockedBy(on, f.key)
                  return (
                    <li key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {f.label}
                          <span className={`ml-2 text-xs font-normal ${overridden ? 'text-accent' : 'text-ink/45'}`}>
                            {overridden ? 'Your override' : planHas(t.plan, f.key) ? 'In plan' : 'Not in plan'}
                          </span>
                        </p>
                        <p className="text-xs text-ink/55">{blocked ?? f.blurb}</p>
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
            </div>
          ))}
        </div>
        {hasOverrides && (
          <button type="button" onClick={() => clearOverrides(t.id)} className="mt-3 text-xs font-semibold text-brand hover:underline">
            Reset to plan defaults
          </button>
        )}
      </Card>

      <p className="text-xs text-ink/50">
        Prototype: this only hides screens. In the real system the backend stores each hotel&apos;s features and rejects calls for
        anything that is off.
      </p>

      {adding && (
        <NewHotelDialog
          branchOf={adding.branchOf}
          onClose={() => setAdding(null)}
          onCreated={(id) => {
            setAdding(null)
            setOpenId(id)
            selectTenant(id)
          }}
        />
      )}
    </div>
  )
}
