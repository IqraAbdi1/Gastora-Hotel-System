import { Card, DataTable, StatCard } from '../../components/ui'
import type { DiscountApplied, RoomPosting } from '../../services/pos/posTypes'
import { cash } from './posFormat'
import type { Payment, Sale } from './posTypes'

const METHODS: Payment[] = ['Cash', 'Mobile money', 'Card', 'Room charge']

export default function PaymentsView({
  sales,
  postings,
  discounts,
  onReceipt,
}: {
  sales: Sale[]
  postings: RoomPosting[]
  discounts: DiscountApplied[]
  onReceipt: (sale: Sale) => void
}) {
  const tips = sales.reduce((s, x) => s + (x.tip ?? 0), 0)
  const service = sales.reduce((s, x) => s + (x.serviceCharge ?? 0), 0)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METHODS.map((method) => {
          const list = sales.filter((sale) => sale.payment === method)
          return <StatCard key={method} label={method} value={cash(list.reduce((sum, sale) => sum + sale.total, 0))} hint={`${list.length} transaction(s)`} />
        })}
      </div>
      <Card title="Payments" count={sales.length} description={`Service charge ${cash(service)} · tips ${cash(tips)}`} padded={false}>
        <DataTable
          rows={sales}
          rowKey={(s) => s.id}
          empty={{ title: 'No payments yet' }}
          onRowClick={onReceipt}
          columns={[
            { key: 'id', header: 'Receipt', cell: (s) => <span className="font-semibold">{s.id}</span> },
            { key: 'at', header: 'Date', cell: (s) => new Date(s.createdAt).toLocaleString(), hideBelow: 'md' },
            { key: 'who', header: 'Customer / room', cell: (s) => s.customer || (s.room ? `Room ${s.room}` : 'Walk-in') },
            { key: 'method', header: 'Method', cell: (s) => s.payment },
            { key: 'ref', header: 'Reference', cell: (s) => s.paymentReference || '—', hideBelow: 'lg' },
            { key: 'amount', header: 'Amount', align: 'right', cell: (s) => <span className="font-semibold">{cash(s.total)}</span> },
          ]}
        />
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Charged to rooms" count={postings.length} padded={false}>
          <DataTable
            rows={postings}
            rowKey={(p) => p.id}
            empty={{ title: 'No room charges yet' }}
            columns={[
              { key: 'room', header: 'Room', cell: (p) => `${p.room} · ${p.guest}` },
              { key: 'cat', header: 'Category', cell: (p) => p.category, hideBelow: 'sm' },
              { key: 'by', header: 'By', cell: (p) => `${p.postedBy} · ${new Date(p.postedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, hideBelow: 'md' },
              { key: 'amt', header: 'Amount', align: 'right', cell: (p) => cash(p.amount) },
            ]}
          />
        </Card>
        <Card title="Discounts given" count={discounts.length} padded={false}>
          <DataTable
            rows={discounts}
            rowKey={(d) => d.id}
            empty={{ title: 'No discounts yet' }}
            columns={[
              { key: 'order', header: 'Order', cell: (d) => d.orderId },
              { key: 'reason', header: 'Reason', cell: (d) => `${d.percent}% · ${d.reason}` },
              { key: 'who', header: 'Approved', cell: (d) => d.approvedBy ?? d.appliedBy, hideBelow: 'md' },
              { key: 'amt', header: 'Amount', align: 'right', cell: (d) => cash(d.amount) },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
