import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cash } from './posFormat'
import type { Sale } from './posTypes'

export default function SalesHistory({ sales, onReceipt }: { sales: Sale[]; onReceipt: (sale: Sale) => void }) {
  const [salesSearch, setSalesSearch] = useState('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState('All payments')
  const visibleSales = sales.filter(
    (s) =>
      (salesPaymentFilter === 'All payments' || s.payment === salesPaymentFilter) &&
      `${s.id} ${s.customer ?? ''} ${s.room ?? ''} ${s.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(salesSearch.toLowerCase().trim()),
  )

  function exportSalesCsv() {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Order ID', 'Date', 'Outlet', 'Order type', 'Table / delivery', 'Customer', 'Payment', 'Payment reference', 'Items', 'Subtotal UGX', 'Discount UGX', 'Service charge UGX', 'Tip UGX', 'Total UGX', 'Room', 'Notes'],
      ...visibleSales.map((s) => [
        s.id, new Date(s.createdAt).toLocaleString(), s.outlet, s.orderType ?? '', s.table ?? '', s.customer ?? '', s.payment, s.paymentReference ?? '',
        s.items.map((i) => `${i.qty} x ${i.name}`).join('; '), s.subtotal ?? s.total, s.discount ?? 0, s.serviceCharge ?? 0, s.tip ?? 0, s.total, s.room ?? '', s.notes ?? '',
      ]),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `gastora-pos-sales-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3">
        <h2 className="text-[15px] font-semibold">Sales history</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-canvas px-3 py-1 text-sm">{visibleSales.length} of {sales.length}</span>
          <button onClick={exportSalesCsv} disabled={!visibleSales.length} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Export CSV</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 border-b border-black/5 p-4 sm:grid-cols-2">
        <input value={salesSearch} onChange={(e) => setSalesSearch(e.target.value)} placeholder="Search order, customer, room, or item…" aria-label="Search sales" className="rounded-lg border border-black/10 px-3 py-2 text-sm" />
        <select value={salesPaymentFilter} onChange={(e) => setSalesPaymentFilter(e.target.value)} aria-label="Filter by payment" className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
          {['All payments', 'Cash', 'Mobile money', 'Card', 'Room charge'].map((method) => <option key={method}>{method}</option>)}
        </select>
      </div>
      {!sales.length ? (
        <div className="p-10 text-center">
          <p className="font-semibold">No orders yet</p>
          <Link to="/pos" className="mt-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Start a sale</Link>
        </div>
      ) : !visibleSales.length ? (
        <div className="p-8 text-center text-sm text-ink/60">No sales match these filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas/70 text-ink/60"><tr>{['Order', 'Time', 'Outlet', 'Type / Table', 'Payment', 'Items', 'Total', 'Receipt'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {visibleSales.map((sale) => (
                <tr key={sale.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-semibold">{sale.id}{sale.room && <span className="block text-xs font-normal">Room {sale.room}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{sale.outlet}</td>
                  <td className="px-4 py-3">
                    {sale.orderType ?? '—'}
                    {sale.table ? <span className="block text-xs text-ink/50">{sale.orderType === 'Delivery' ? 'Delivery' : 'Table'}: {sale.table}</span> : null}
                  </td>
                  <td className="px-4 py-3">{sale.payment}{sale.checkLabel ? <span className="block text-xs text-ink/50">Check {sale.checkLabel}</span> : null}</td>
                  <td className="px-4 py-3">{sale.items.reduce((n, item) => n + item.qty, 0)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{cash(sale.total)}</td>
                  <td className="px-4 py-3"><button onClick={() => onReceipt(sale)} className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-semibold hover:border-brand/40">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
