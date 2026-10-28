import { useFeatures } from '../platform/featuresContext'
import { cash } from './posFormat'
import type { Sale } from './posTypes'

export default function ReceiptDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { tenant } = useFeatures()
  const subtotal = sale.subtotal ?? sale.total + (sale.discount ?? 0) - (sale.serviceCharge ?? 0) - (sale.tip ?? 0)
  return (
    <div className="pos-receipt-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Sales receipt">
      <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl print:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink/50">{tenant.name}</p>
            <h2 className="mt-1 text-xl font-bold">Sales receipt{sale.checkLabel ? ` · check ${sale.checkLabel}` : ''}</h2>
          </div>
          <button onClick={onClose} className="rounded-md border border-black/10 px-3 py-1 text-sm print:hidden">Close</button>
        </div>

        <div className="mt-5 space-y-1 border-b border-dashed border-black/20 pb-4 text-sm">
          <p><strong>Receipt:</strong> {sale.id}</p>
          <p><strong>Date:</strong> {new Date(sale.createdAt).toLocaleString()}</p>
          <p><strong>Outlet:</strong> {sale.outlet}</p>
          {sale.orderType && <p><strong>Order type:</strong> {sale.orderType}</p>}
          {sale.table && <p><strong>{sale.orderType === 'Delivery' ? 'Delivery address' : 'Table'}:</strong> {sale.table}</p>}
          {sale.customer && <p><strong>Customer:</strong> {sale.customer}</p>}
          <p><strong>Payment:</strong> {sale.payment}</p>
          {sale.paymentReference && <p><strong>Reference:</strong> {sale.paymentReference}</p>}
          {sale.room && <p><strong>Room:</strong> {sale.room}</p>}
          {sale.notes && <p><strong>Notes:</strong> {sale.notes}</p>}
        </div>

        <div className="py-4">
          {sale.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex justify-between gap-3 py-1.5 text-sm">
              <span>{item.qty} × {item.name}<span className="block text-xs text-ink/50">{cash(item.price)} each</span></span>
              <strong>{cash(item.qty * item.price)}</strong>
            </div>
          ))}
        </div>

        {((sale.discount ?? 0) > 0 || (sale.serviceCharge ?? 0) > 0 || (sale.tip ?? 0) > 0) && (
          <div className="flex justify-between border-t border-black/10 pt-3 text-sm"><span>Subtotal</span><span>{cash(subtotal)}</span></div>
        )}
        {(sale.discount ?? 0) > 0 && <div className="flex justify-between pt-1 text-sm"><span>Discount</span><span>−{cash(sale.discount ?? 0)}</span></div>}
        {(sale.serviceCharge ?? 0) > 0 && <div className="flex justify-between pt-1 text-sm"><span>Service charge</span><span>{cash(sale.serviceCharge ?? 0)}</span></div>}
        {(sale.tip ?? 0) > 0 && <div className="flex justify-between pt-1 text-sm"><span>Tip</span><span>{cash(sale.tip ?? 0)}</span></div>}
        <div className="flex justify-between border-t border-black/10 pt-4 text-lg font-bold"><span>Total</span><span>{cash(sale.total)}</span></div>
        {sale.payment === 'Cash' && <div className="mt-2 flex justify-between text-sm"><span>Cash received</span><span>{cash(sale.amountTendered ?? sale.total)}</span></div>}
        {sale.payment === 'Cash' && <div className="flex justify-between text-sm"><span>Change</span><span>{cash(sale.changeDue ?? 0)}</span></div>}
        <p className="mt-5 text-center text-xs text-ink/50">Thank you for dining with us.</p>
        <button onClick={() => window.print()} className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white print:hidden">Print receipt</button>
      </section>
    </div>
  )
}
