import { useMemo, useState } from 'react'
import { Button, ConfirmDialog, Field, Input, Modal, Select } from '../../components/ui'
import { folioOf } from '../../lib/folio'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useCorporate } from '../corporate/corporateContext'
import { CITY_LEDGER_METHOD, transferredFrom } from './daySource'
import { ErrorNote } from './accountingUi'
import { useRun } from './accountingHelpers'
import { balanceOf, limitOf } from './ledger'
import type { AccountingValue } from './useAccounting'

/** Move a folio balance to a direct-bill account. Checks the credit limit and asks before moving money. */
export default function TransferDialog({ acc, reservationId, onClose }: { acc: AccountingValue; reservationId?: string; onClose: () => void }) {
  const { reservations, addPayment } = useHotel()
  const { byId } = useCorporate()
  const { run, busy, error, setError } = useRun()
  const [confirming, setConfirming] = useState(false)

  // Folios with money still owing: in the house, or left today without settling.
  const candidates = useMemo(
    () =>
      reservations
        .filter((r) => r.status === 'in-house' || r.status === 'checked-out')
        .map((r) => ({ r, owed: folioOf(r).balance - (r.status === 'checked-out' ? transferredFrom(acc.transfers, r.id) : 0) }))
        .filter((x) => x.owed > 0),
    [reservations, acc.transfers],
  )
  const active = acc.accounts.filter((a) => a.status === 'active')
  const [resId, setResId] = useState(reservationId ?? candidates[0]?.r.id ?? '')
  const [accountId, setAccountId] = useState(() => {
    const r = reservations.find((x) => x.id === (reservationId ?? candidates[0]?.r.id))
    const match = active.find((a) => (r?.corporate && a.sourceId === r.corporate.accountId) || (r?.agent && a.sourceId === r.agent.id))
    return match?.id ?? active[0]?.id ?? ''
  })
  const chosen = candidates.find((x) => x.r.id === resId)
  const [amount, setAmount] = useState(String(chosen?.owed ?? ''))
  const account = active.find((a) => a.id === accountId)
  const limit = account ? limitOf(account, byId) : 0
  const used = account ? balanceOf(acc.transfers, account.id) : 0
  const value = Number(amount)

  function check(): string | null {
    if (!chosen) return 'Pick a folio'
    if (!account) return 'Pick a direct-bill account'
    if (!(value > 0)) return 'The amount must be more than zero'
    if (value > chosen.owed) return `The folio only owes ${ugx(chosen.owed)}`
    if (used + value > limit) return `Over the credit limit (${ugx(used)} of ${ugx(limit)} used)`
    return null
  }

  async function transfer() {
    if (!chosen || !account) return
    const ok = await run(async () => {
      const t = await acc.service.transferToCityLedger(
        acc.propertyId,
        { accountId: account.id, reservationId: chosen.r.id, guest: chosen.r.guest, amount: value, businessDate: acc.businessDate },
        limit,
        acc.need(),
      )
      // An open folio takes the transfer as a settling line; a closed one is matched by the transfer itself.
      if (chosen.r.status === 'in-house') addPayment(chosen.r.id, { method: CITY_LEDGER_METHOD, amount: t.amount, reference: t.invoiceNo })
    })
    setConfirming(false)
    if (ok) onClose()
  }

  return (
    <>
      <Modal
        title="Transfer to city ledger"
        description="The folio balance becomes an invoice to the company or agent."
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={busy || candidates.length === 0 || active.length === 0}
              onClick={() => {
                const msg = check()
                if (msg) setError(msg)
                else {
                  setError(null)
                  setConfirming(true)
                }
              }}
            >
              Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {candidates.length === 0 ? (
            <p className="text-sm text-ink/60">No folio has a balance to transfer.</p>
          ) : (
            <Field label="Folio" required>
              {(id) => (
                <Select
                  id={id}
                  value={resId}
                  onChange={(e) => {
                    setResId(e.target.value)
                    const c = candidates.find((x) => x.r.id === e.target.value)
                    setAmount(String(c?.owed ?? ''))
                  }}
                >
                  {candidates.map(({ r, owed }) => (
                    <option key={r.id} value={r.id}>
                      {r.guest} · {r.room ? `room ${r.room}` : r.id} · {ugx(owed)}
                      {r.status === 'checked-out' ? ' · left' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Direct-bill account" required hint={account ? `${ugx(used)} of ${ugx(limit)} used` : undefined}>
            {(id) => (
              <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {active.length === 0 && <option value="">No active account</option>}
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Amount (UGX)" required>
            {(id) => <Input id={id} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />}
          </Field>
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Modal>
      {confirming && chosen && account && (
        <ConfirmDialog
          title="Move this balance?"
          message={
            <>
              {ugx(value)} from {chosen.r.guest}'s folio goes to <strong>{account.name}</strong> as an invoice, and Trademate receives it as a receivable.
            </>
          }
          confirmLabel={busy ? 'Moving…' : 'Transfer'}
          onConfirm={transfer}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
