import { useState } from 'react'
import { Badge, Button, Input, Modal, Segmented, Select } from '../../components/ui'
import type { Check, CheckPaymentMethod, FolioControl, SplitMode } from '../../services/pos/posTypes'
import { cash } from './posFormat'
import { lineDiscountOf, lineGross, splitByAssignment, splitBySeat, splitEqually } from './posRules'
import type { OrderTotals, PricedLine, SplitPart } from './posRules'
import RoomChargePicker from './RoomChargePicker'

export type CheckPayInput = { method: CheckPaymentMethod; reference: string; tendered: number; reservationId: string }

const METHODS: CheckPaymentMethod[] = ['Cash', 'Mobile money', 'Card', 'Room charge']

// Split one bill into checks, by item, by seat or equally, and take each check's payment on its own.
export default function SplitBillDialog({
  lines,
  totals,
  checks,
  controls,
  category,
  onCreate,
  onPay,
  onClose,
}: {
  lines: PricedLine[]
  totals: OrderTotals
  /** Checks already made for this order. */
  checks: Check[]
  controls: FolioControl[]
  category: string
  onCreate: (parts: SplitPart[], mode: SplitMode) => Promise<string | null>
  onPay: (check: Check, input: CheckPayInput) => Promise<string | null>
  onClose: () => void
}) {
  const [mode, setMode] = useState<Exclude<SplitMode, 'none'>>('item')
  const [ways, setWays] = useState(2)
  const [assign, setAssign] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pay, setPay] = useState<Record<string, CheckPayInput>>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const anyPaid = checks.some((c) => c.status === 'paid')
  const editing = checks.length === 0

  const preview: SplitPart[] =
    mode === 'equal' ? splitEqually(totals, ways) : mode === 'seat' ? splitBySeat(lines, totals) : splitByAssignment(lines, assign, totals)
  const labels = ['A', 'B', 'C', 'D', 'E', 'F']

  async function create() {
    if (preview.length < 2) return setError(mode === 'seat' ? 'Give the items at least two different seats.' : 'Put items on at least two checks.')
    setBusy(true)
    const result = await onCreate(preview, mode)
    setBusy(false)
    setError(result ?? '')
  }

  async function payCheck(check: Check) {
    const input = pay[check.id] ?? { method: 'Cash', reference: '', tendered: 0, reservationId: '' }
    // A room charge moves money onto a folio: ask once more before posting it.
    if (input.method === 'Room charge' && confirming !== check.id) return setConfirming(check.id)
    setConfirming(null)
    setBusy(true)
    const result = await onPay(check, input)
    setBusy(false)
    setError(result ?? '')
  }

  const setInput = (id: string, patch: Partial<CheckPayInput>) => {
    setConfirming(null)
    setPay((old) => ({ ...old, [id]: { ...{ method: 'Cash' as CheckPaymentMethod, reference: '', tendered: 0, reservationId: '' }, ...old[id], ...patch } }))
  }

  return (
    <Modal title="Split bill" description={`${cash(totals.total)} in total`} onClose={onClose} wide>
      <div className="space-y-4">
        {editing ? (
          <>
            <Segmented
              label="Split by"
              value={mode}
              onChange={setMode}
              options={[{ key: 'item', label: 'By item' }, { key: 'seat', label: 'By seat' }, { key: 'equal', label: 'Equally' }]}
            />
            {mode === 'equal' && (
              <label className="flex items-center gap-2 text-sm font-semibold">
                Ways
                <Input type="number" min={2} max={20} value={ways} onChange={(e) => setWays(Number(e.target.value) || 2)} className="w-24" />
              </label>
            )}
            {mode !== 'equal' && (
              <div className="divide-y divide-ink/8 rounded-lg border border-ink/10">
                {lines.map((l) => (
                  <div key={l.lineId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      {l.qty} × {l.product.name}
                      {l.modifiers?.length ? <span className="block text-xs text-ink/50">{l.modifiers.map((m) => m.name).join(', ')}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-ink/60">{cash(lineGross(l, l.product) - lineDiscountOf(l, l.product))}</span>
                      {mode === 'item' ? (
                        <div className="flex gap-1" role="group" aria-label={`Check for ${l.product.name}`}>
                          {labels.slice(0, 4).map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setAssign((old) => ({ ...old, [l.lineId ?? '']: label }))}
                              className={`h-7 w-7 rounded-md text-xs font-bold ${(assign[l.lineId ?? ''] ?? 'A') === label ? 'bg-brand text-white' : 'border border-ink/15'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Badge>Seat {l.seat ?? 1}</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {preview.map((p) => (
                <div key={p.label} className="rounded-lg bg-canvas px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-ink/60">{mode === 'seat' ? p.label : `Check ${p.label}`}</p>
                  <p className="font-bold">{cash(p.total)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={create} disabled={busy}>Create {preview.length} checks</Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {checks.map((c) => {
              const input = pay[c.id] ?? { method: 'Cash' as CheckPaymentMethod, reference: '', tendered: 0, reservationId: '' }
              return (
                <div key={c.id} className="rounded-lg border border-ink/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{c.label.startsWith('Seat') ? c.label : `Check ${c.label}`} · {cash(c.total)}</p>
                    {c.status === 'paid' ? <Badge tone="good" dot>Paid</Badge> : <Badge tone="warn" dot>To pay</Badge>}
                  </div>
                  {c.status === 'open' && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
                      <Select aria-label="Payment method" value={input.method} onChange={(e) => setInput(c.id, { method: e.target.value as CheckPaymentMethod })}>
                        {METHODS.map((m) => <option key={m}>{m}</option>)}
                      </Select>
                      <div>
                        {input.method === 'Cash' && (
                          <Input type="number" min={c.total} placeholder={`Cash received (${Math.round(c.total)})`} value={input.tendered || ''} onChange={(e) => setInput(c.id, { tendered: Number(e.target.value) })} />
                        )}
                        {(input.method === 'Card' || input.method === 'Mobile money') && (
                          <Input placeholder="Transaction reference" value={input.reference} onChange={(e) => setInput(c.id, { reference: e.target.value })} />
                        )}
                        {input.method === 'Room charge' && (
                          <RoomChargePicker reservationId={input.reservationId} onChange={(id) => setInput(c.id, { reservationId: id })} amount={c.total} category={category} controls={controls} />
                        )}
                      </div>
                      <Button onClick={() => payCheck(c)} disabled={busy}>{confirming === c.id ? `Confirm room charge ${cash(c.total)}` : `Pay ${cash(c.total)}`}</Button>
                    </div>
                  )}
                </div>
              )
            })}
            {!anyPaid && (
              <button type="button" onClick={() => onCreate([], 'none')} className="text-sm font-semibold text-brand hover:underline">
                Change the split
              </button>
            )}
          </div>
        )}
        {error && <p className="text-sm font-medium text-bad" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
