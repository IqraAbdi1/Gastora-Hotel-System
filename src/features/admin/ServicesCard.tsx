import { Badge, Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import { ugx } from '../../lib/format'
import { CATEGORY_CHARGE, CATEGORY_LABEL, newServiceId, startsOf } from '../../lib/services'
import type { BookableService, ServiceCategory } from '../../lib/services'

const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * What a guest can book from their own page besides the room: tables, treatments, trips. Turning one off
 * hides it from guests and keeps every booking already made, so it is never removed outright.
 */
export default function ServicesCard({ services, set }: { services: BookableService[]; set: (next: BookableService[]) => void }) {
  const change = (id: string, patch: Partial<BookableService>) => set(services.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  return (
    <Card
      title="Dining, spa and activities"
      icon="calendar"
      count={services.filter((s) => s.on).length}
      padded
      description="What guests can book from their own page."
    >
      <ul className="space-y-2">
        {services.map((s) => {
          const starts = startsOf(s)
          return (
            <li key={s.id} className="rounded-lg border border-ink/10 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <Input value={s.name} onChange={(e) => change(s.id, { name: e.target.value })} aria-label="Service name" placeholder="Sunset boat trip" />
                <Select
                  value={s.category}
                  onChange={(e) => change(s.id, { category: e.target.value as ServiceCategory })}
                  aria-label={`${s.name} category`}
                >
                  {(Object.keys(CATEGORY_LABEL) as ServiceCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Price (UGX)">
                  {(id) => <Input id={id} inputMode="numeric" className="tabular-nums" value={String(s.price)} onChange={(e) => change(s.id, { price: num(e.target.value) })} />}
                </Field>
                <Field label="Charged">
                  {(id) => (
                    <Select id={id} value={s.per} onChange={(e) => change(s.id, { per: e.target.value as BookableService['per'] })}>
                      <option value="person">each person</option>
                      <option value="booking">once</option>
                    </Select>
                  )}
                </Field>
                <Field label="Minutes">
                  {(id) => <Input id={id} inputMode="numeric" value={String(s.durationMin)} onChange={(e) => change(s.id, { durationMin: num(e.target.value) })} />}
                </Field>
                <Field label="First start">
                  {(id) => <Input id={id} type="time" value={s.firstStart} onChange={(e) => change(s.id, { firstStart: e.target.value })} />}
                </Field>
                <Field label="Last start">
                  {(id) => <Input id={id} type="time" value={s.lastStart} onChange={(e) => change(s.id, { lastStart: e.target.value })} />}
                </Field>
                <Field label="Every (min)">
                  {(id) => <Input id={id} inputMode="numeric" value={String(s.everyMin)} onChange={(e) => change(s.id, { everyMin: num(e.target.value) })} />}
                </Field>
                <Field label="Places each">
                  {(id) => <Input id={id} inputMode="numeric" value={String(s.capacity)} onChange={(e) => change(s.id, { capacity: num(e.target.value) })} />}
                </Field>
                <Field label="Most per booking">
                  {(id) => <Input id={id} inputMode="numeric" value={String(s.maxParty)} onChange={(e) => change(s.id, { maxParty: Math.max(1, num(e.target.value)) })} />}
                </Field>
              </div>
              <div className="mt-2">
                <Field label="What the guest reads">
                  {(id) => <Textarea id={id} rows={2} value={s.blurb} onChange={(e) => change(s.id, { blurb: e.target.value })} />}
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="flex flex-wrap items-center gap-2 text-ink/60">
                  <Badge tone={s.on ? 'good' : 'neutral'} dot={s.on}>
                    {s.on ? 'Offered' : 'Off'}
                  </Badge>
                  {s.price > 0 ? `${ugx(s.price)} ${s.per === 'person' ? 'each' : 'once'}` : 'Free'} ·{' '}
                  {starts.length === 1 ? `starts ${starts[0]}` : `${starts.length} starts, ${starts[0] ?? '-'} to ${starts[starts.length - 1] ?? '-'}`} ·{' '}
                  {s.capacity} each time · charged as {CATEGORY_CHARGE[s.category]}
                </span>
                <label className="flex items-center gap-1.5 text-ink/70">
                  <input type="checkbox" checked={s.on} onChange={(e) => change(s.id, { on: e.target.checked })} />
                  Offered
                </label>
              </div>
            </li>
          )
        })}
        {services.length === 0 && <li className="text-xs text-ink/55">Nothing can be booked from the guest's page yet.</li>}
      </ul>
      <div className="mt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            set([
              ...services,
              {
                id: newServiceId(services),
                name: '',
                category: 'activity',
                blurb: '',
                durationMin: 60,
                price: 0,
                per: 'person',
                firstStart: '09:00',
                lastStart: '17:00',
                everyMin: 60,
                capacity: 4,
                maxParty: 4,
                on: false,
              },
            ])
          }
        >
          Add a service
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink/55">
        Places are counted per starting time.
      </p>
    </Card>
  )
}
