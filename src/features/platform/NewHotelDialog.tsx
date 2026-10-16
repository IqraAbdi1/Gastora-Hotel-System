import { useState } from 'react'
import { Badge, Button, Field, Input, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { PLANS } from '../../lib/features'
import type { CompanySize, PlanId, TenantRegistry } from '../../lib/features'
import { SIZE_LABEL } from '../../lib/corporate'
import { useFeatures } from './featuresContext'

const num = (s: string) => Number(s.replace(/\D/g, '')) || 0

/** The hotel size Gastora suggests from the number of rooms. The admin can still change it. */
function sizeForRooms(rooms: number): CompanySize {
  if (rooms >= 80) return 'large'
  if (rooms >= 25) return 'medium'
  return 'small'
}

// Signing up a hotel. Gastora keeps what it needs to invoice them and to reach a real person,
// plus the licence and TIN the hotel's own invoices depend on.
export default function NewHotelDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { addTenant } = useFeatures()

  const [name, setName] = useState('')
  const [rooms, setRooms] = useState('')
  const [plan, setPlan] = useState<PlanId>('starter')
  const [size, setSize] = useState<CompanySize | ''>('')
  const [reg, setReg] = useState<TenantRegistry>({ joinedOn: TODAY, billingStartsOn: TODAY })

  const roomCount = num(rooms)
  const suggested = sizeForRooms(roomCount)
  const chosenSize = size || suggested
  const set = (patch: Partial<TenantRegistry>) => setReg((r) => ({ ...r, ...patch }))

  const problems: string[] = []
  if (name.trim().length < 2) problems.push('Enter the hotel name.')
  if (roomCount < 1) problems.push('Enter how many rooms it has.')
  if (!reg.contactName?.trim()) problems.push('Enter who Gastora talks to at the hotel.')
  if (!reg.contactPhone?.trim()) problems.push('Enter that person’s phone number.')
  if (reg.tin && reg.tin.replace(/\D/g, '').length !== 10) problems.push('A Uganda TIN is 10 digits.')

  function save() {
    if (problems.length) return
    const created = addTenant({
      name: name.trim(),
      rooms: roomCount,
      plan,
      companySize: chosenSize,
      registry: {
        ...reg,
        legalName: reg.legalName?.trim() || undefined,
        tin: reg.tin?.trim() || undefined,
      },
    })
    onCreated(created.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label="Add a hotel">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-linear-to-r from-brand-deep to-brand p-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Gastora · Platform admin</p>
            <h2 className="text-lg font-semibold">Add a hotel</h2>
            <p className="text-sm text-white/80">It starts active, on the plan you choose. You can change everything afterwards.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-white/90 hover:text-white">
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">The hotel</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hotel name" required>
                {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lakeview Grand Hotel" />}
              </Field>
              <Field label="Name on the certificate" hint="Only if it differs from the trading name.">
                {(id) => <Input id={id} value={reg.legalName ?? ''} onChange={(e) => set({ legalName: e.target.value })} />}
              </Field>
              <Field label="Rooms" required hint={roomCount > 0 ? `Suggests ${SIZE_LABEL[suggested].toLowerCase()} company rules.` : undefined}>
                {(id) => <Input id={id} inputMode="numeric" className="tabular-nums" value={rooms} onChange={(e) => setRooms(e.target.value)} />}
              </Field>
              <Field label="Star rating" hint="Used for the Local Hotel Tax band.">
                {(id) => (
                  <Select id={id} value={String(reg.stars ?? '')} onChange={(e) => set({ stars: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">Not rated</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} star
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Town or city">
                {(id) => <Input id={id} value={reg.town ?? ''} onChange={(e) => set({ town: e.target.value })} placeholder="Kampala" />}
              </Field>
              <Field label="Address">
                {(id) => <Input id={id} value={reg.address ?? ''} onChange={(e) => set({ address: e.target.value })} />}
              </Field>
              <Field label="TIN" hint="10 digits. Needed before EFRIS can be switched on.">
                {(id) => <Input id={id} inputMode="numeric" value={reg.tin ?? ''} onChange={(e) => set({ tin: e.target.value.replace(/\D/g, '').slice(0, 10) })} />}
              </Field>
              <Field label="Trading licence number">
                {(id) => <Input id={id} value={reg.licenceNumber ?? ''} onChange={(e) => set({ licenceNumber: e.target.value })} />}
              </Field>
              <Field label="Hotel phone">
                {(id) => <Input id={id} value={reg.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="+256 7.." />}
              </Field>
              <Field label="Hotel email">
                {(id) => <Input id={id} type="email" value={reg.email ?? ''} onChange={(e) => set({ email: e.target.value })} />}
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Who we talk to</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required>
                {(id) => <Input id={id} value={reg.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} />}
              </Field>
              <Field label="Their job">
                {(id) => <Input id={id} value={reg.contactRole ?? ''} onChange={(e) => set({ contactRole: e.target.value })} placeholder="Owner, general manager" />}
              </Field>
              <Field label="Phone" required>
                {(id) => <Input id={id} value={reg.contactPhone ?? ''} onChange={(e) => set({ contactPhone: e.target.value })} />}
              </Field>
              <Field label="Email">
                {(id) => <Input id={id} type="email" value={reg.contactEmail ?? ''} onChange={(e) => set({ contactEmail: e.target.value })} />}
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Plan and billing</p>
            <div className="flex flex-wrap gap-2">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    plan === p.id ? 'border-brand bg-brand/8 ring-2 ring-brand/20' : 'border-ink/12 bg-canvas hover:border-brand/40'
                  }`}
                >
                  <p className="font-semibold text-ink">{p.label}</p>
                  <p className="mt-0.5 max-w-60 text-xs text-ink/60">{p.blurb}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Company rules" hint="Suggested from the number of rooms.">
                {(id) => (
                  <Select id={id} value={chosenSize} onChange={(e) => setSize(e.target.value as CompanySize)}>
                    {(['small', 'medium', 'large'] as CompanySize[]).map((s) => (
                      <option key={s} value={s}>
                        {SIZE_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Joined on">
                {(id) => <Input id={id} type="date" value={reg.joinedOn ?? TODAY} onChange={(e) => set({ joinedOn: e.target.value })} />}
              </Field>
              <Field label="Billing starts" hint="Leave later than joining for a free trial.">
                {(id) => <Input id={id} type="date" value={reg.billingStartsOn ?? TODAY} onChange={(e) => set({ billingStartsOn: e.target.value })} />}
              </Field>
            </div>
            <Field label="Notes">
              {(id) => <Textarea id={id} rows={2} value={reg.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything the Gastora team should know" />}
            </Field>
          </section>

          {problems.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-bad/10 p-3 text-sm text-bad">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <p className="rounded-xl bg-brand/6 p-3 text-xs text-ink/65">
            Prototype: this keeps the hotel in this browser only. In the real system it creates the hotel's own space, its
            first admin account and its subscription. <Badge tone="neutral">Nothing is billed here</Badge>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 p-4">
          <Button className="flex-1" onClick={save} disabled={problems.length > 0}>
            Add {name.trim() || 'the hotel'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
