import { useState } from 'react'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { shortDate } from './procurementUi'
import { useRequests } from './requestsContext'
import { useProcurement } from './useProcurement'

// Area I: goods turned away on a delivery. Feeds the supplier scorecard and the three-way match.

const REASONS = ['Damaged on arrival', 'Wrong item', 'Past or near expiry', 'Poor quality', 'Short-dated', 'Other']

export default function RejectDialog({ poId, onClose }: { poId?: string; onClose: () => void }) {
  const { receipts } = useRequests()
  const { run, service, propertyId } = useProcurement()
  const grns = receipts.filter((r) => r.kind === 'GRN' && r.supplier && (!poId || r.poId === poId))
  const [grnId, setGrnId] = useState(grns[0]?.id ?? '')
  const grn = grns.find((g) => g.id === grnId)
  const [item, setItem] = useState(grn?.lines[0]?.name ?? '')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState(REASONS[0])
  const [error, setError] = useState<string | null>(null)
  const line = grn?.lines.find((l) => l.name === item)

  async function save() {
    if (!grn || !line) return setError('Pick the delivery and the item.')
    const e = await run((a) =>
      service.logReject(
        { propertyId, grnId: grn.id, poId: grn.poId, supplierName: grn.supplier ?? '', itemName: line.name, qty: Number(qty), delivered: line.qty, reason },
        a,
      ),
    )
    if (e) setError(e)
    else onClose()
  }

  return (
    <Modal
      title="Log a reject"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!grn}>Save reject</Button>
        </>
      }
    >
      {grns.length === 0 ? (
        <p className="text-sm text-ink/60">No deliveries from suppliers yet.</p>
      ) : (
        <div className="space-y-4">
          <Field label="Delivery">
            {(id) => (
              <Select id={id} value={grnId} onChange={(e) => { setGrnId(e.target.value); setItem(grns.find((g) => g.id === e.target.value)?.lines[0]?.name ?? '') }}>
                {grns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id} · {g.supplier} · {g.poId ?? ''} · {shortDate(g.at)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item">
              {(id) => (
                <Select id={id} value={item} onChange={(e) => setItem(e.target.value)}>
                  {grn?.lines.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name} ({l.qty} {l.unit})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Rejected">{(id) => <Input id={id} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
          </div>
          <Field label="Reason">
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            )}
          </Field>
          {error && <p className="text-sm font-medium text-bad">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
