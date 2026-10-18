import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/authContext'
import { formatUGX } from '../procurement/requestsModel'
import type { DocView } from './documents'

type Size = 'A4' | 'A5'

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function Sheet({ doc, size, printedBy }: { doc: DocView; size: Size; printedBy: string }) {
  const a4 = size === 'A4'
  const total = doc.lines.reduce((s, l) => s + l.qty * l.unitCost, 0)
  const costed = doc.lines.some((l) => l.unitCost !== 0)
  const muted = 'opacity-60'
  const cell = 'py-1 pr-2'

  return (
    <div
      className={`print-sheet box-border max-w-full bg-white text-black ${
        a4 ? 'w-[210mm] p-[14mm] text-[13px]' : 'w-[148mm] p-[9mm] text-[11px]'
      }`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-black/40 pb-3">
        <p className={`font-bold ${a4 ? 'text-[22px]' : 'text-[17px]'}`}>
          {doc.hotel}
        </p>
        <div className="text-right">
          <p className="font-bold uppercase tracking-wide">{doc.title}</p>
          <p className="font-mono">{doc.number}</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <dt className={muted}>Date</dt>
          <dd className="font-medium">{stamp(doc.at)}</dd>
        </div>
        <div>
          <dt className={muted}>Prepared by</dt>
          <dd className="font-medium">{doc.by}</dd>
        </div>
        {doc.parties.map((p) => (
          <div key={p.label}>
            <dt className={muted}>{p.label}</dt>
            <dd className="font-medium">{p.value}</dd>
          </div>
        ))}
      </dl>

      {doc.sections?.map((sec) => (
        <section key={sec.heading} className="mt-4">
          <p className="border-b border-black/40 pb-1 font-bold uppercase tracking-wide">{sec.heading}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
            {sec.rows.map((row) => (
              <div key={row.label}>
                <dt className={muted}>{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {doc.terms && (
        <section className="mt-4">
          <p className="border-b border-black/40 pb-1 font-bold uppercase tracking-wide">Terms accepted</p>
          <p className="mt-2 whitespace-pre-wrap">{doc.terms}</p>
        </section>
      )}

      {doc.lines.length > 0 && (
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-black/40 text-left">
            <th className={cell}>#</th>
            <th className={cell}>Item</th>
            <th className={cell}>Unit</th>
            <th className={`${cell} text-right`}>Qty</th>
            {costed && (
              <>
                <th className={`${cell} text-right`}>Unit cost</th>
                <th className={`${cell} text-right`}>Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, n) => (
            <tr key={n} className="border-b border-black/15">
              <td className={cell}>{n + 1}</td>
              <td className={cell}>{l.name}</td>
              <td className={cell}>{l.unit}</td>
              <td className={`${cell} text-right`}>{l.qty}</td>
              {costed && (
                <>
                  <td className={`${cell} text-right`}>{l.unitCost !== 0 ? l.unitCost.toLocaleString('en-US') : ''}</td>
                  <td className={`${cell} text-right`}>{l.unitCost !== 0 ? (l.qty * l.unitCost).toLocaleString('en-US') : ''}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {costed && (
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-2 text-right font-semibold">
                Total
              </td>
              <td className="pt-2 text-right font-bold">{formatUGX(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
      )}

      {doc.signed && (
        <div className="mt-6">
          <img src={doc.signed.image} alt={doc.signed.label} className="h-20 object-contain" />
          <div className="mt-1 w-64 border-t border-black/60 pt-1">{doc.signed.label}</div>
        </div>
      )}

      {doc.note && (
        <p className="mt-3">
          <span className="font-semibold">Note: </span>
          {doc.note}
        </p>
      )}

      <div
        className="mt-10 grid gap-6"
        style={{ gridTemplateColumns: `repeat(${doc.signatures.length}, minmax(0, 1fr))` }}
      >
        {doc.signatures.map((s) => (
          <div key={s}>
            <div className="border-t border-black/60 pt-1">{s}</div>
            <div className={`mt-1 ${muted}`}>Name and date</div>
          </div>
        ))}
      </div>

      <p className={`mt-8 border-t border-black/20 pt-2 text-center ${muted} ${a4 ? 'text-[11px]' : 'text-[9px]'}`}>
        Printed by {printedBy} on {stamp(new Date().toISOString())}
      </p>
    </div>
  )
}

// Shows a receipt or purchase order on screen and prints it on A4 or A5.
// The print copy sits outside the app, which is hidden while printing, so nothing gets cut off.
export default function DocumentDialog({ doc, onClose }: { doc: DocView; onClose: () => void }) {
  const { user } = useAuth()
  const [size, setSize] = useState<Size>('A4')
  const printedBy = user?.name ?? ''

  return (
    <>
      <style>{`
        @page { size: ${size} portrait; margin: 12mm; }
        .print-copy { display: none; }
        @media print {
          #root { display: none !important; }
          .print-copy { display: block !important; }
          .print-copy .print-sheet { width: 100% !important; padding: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4">
        <div className="mx-auto w-fit max-w-full rounded-xl bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {doc.title} · {doc.number}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-ink/15 text-sm font-semibold">
                {(['A4', 'A5'] as Size[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`px-3 py-1.5 ${size === s ? 'bg-brand text-white' : 'text-ink/70 hover:bg-ink/5'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white"
              >
                Print
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-ink/20 px-4 py-1.5 text-sm font-medium text-ink/70"
              >
                Close
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-ink/10 shadow-sm">
            <Sheet doc={doc} size={size} printedBy={printedBy} />
          </div>
          <p className="mt-2 text-xs text-ink/50">Choose Save as PDF in the print window if you do not have a printer.</p>
        </div>
      </div>

      {createPortal(
        <div className="print-copy">
          <Sheet doc={doc} size={size} printedBy={printedBy} />
        </div>,
        document.body,
      )}
    </>
  )
}