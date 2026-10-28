import { Badge, Card } from '../../components/ui'
import type { Tone } from '../../components/ui'
import type { HeldOrder, KitchenStatus, LineStatus } from './posTypes'

const FLOW: KitchenStatus[] = ['New', 'Preparing', 'Ready', 'Served']
const LINE_TONE: Record<LineStatus, Tone> = { New: 'neutral', Preparing: 'warn', Ready: 'good', Served: 'brand', Cancelled: 'bad' }

// Orders sent to the kitchen or bar, with where each one has got to.
export default function HeldOrdersCard({
  orders,
  courseControl,
  canApprove,
  onResume,
  onCancel,
  onFire,
  onApprove,
}: {
  orders: HeldOrder[]
  courseControl: boolean
  canApprove: boolean
  onResume: (order: HeldOrder) => void
  onCancel: (order: HeldOrder) => void
  onFire: (order: HeldOrder, course: string) => void
  onApprove: (order: HeldOrder) => void
}) {
  if (!orders.length) return null
  return (
    <Card title="Open orders" count={orders.length}>
      <div className="space-y-2">
        {orders.map((held) => {
          const status = held.kitchenStatus ?? 'New'
          const step = FLOW.indexOf(status)
          const counts = held.items.reduce<Record<string, number>>((acc, l) => {
            const s = l.status ?? 'New'
            acc[s] = (acc[s] ?? 0) + l.qty
            return acc
          }, {})
          return (
            <div key={held.id} className="rounded-lg border border-black/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{held.id} · {held.outlet} · {held.orderType}</p>
                  <p className="text-sm text-ink/60">
                    {held.items.reduce((n, x) => n + x.qty, 0)} items · {held.customer || 'Walk-in customer'}
                    {held.orderType === 'Dine-in' && held.table ? ` · Table ${held.table}` : ''}
                    {held.orderType === 'Delivery' && held.table ? ` · Delivery: ${held.table}` : ''}
                    {held.room ? ` · Room ${held.room}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {held.discountNeedsApproval && canApprove && (
                    <button onClick={() => onApprove(held)} className="rounded-lg border border-warn px-3 py-2 text-sm font-semibold text-warn">Approve discount</button>
                  )}
                  <button onClick={() => onResume(held)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Resume</button>
                  <button onClick={() => onCancel(held)} className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold">Cancel</button>
                </div>
              </div>
              <ol className="mt-3 flex flex-wrap items-center gap-1 text-xs" aria-label="Kitchen progress">
                {FLOW.map((s, i) => (
                  <li key={s} className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${i <= step ? 'bg-brand text-white' : 'bg-ink/8 text-ink/50'}`}>{s}</span>
                    {i < FLOW.length - 1 && <span className="text-ink/30">›</span>}
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {Object.entries(counts).map(([s, n]) => <Badge key={s} tone={LINE_TONE[s as LineStatus] ?? 'neutral'}>{n} {s.toLowerCase()}</Badge>)}
                {held.discountNeedsApproval && <Badge tone="warn" dot>Discount awaits a manager</Badge>}
                {courseControl && (held.heldCourses ?? []).map((course) => (
                  <button key={course} onClick={() => onFire(held, course)} className="rounded-full border border-brand px-2.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand/5">
                    Fire {course.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
