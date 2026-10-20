import { useMemo, useState } from 'react'
import SignaturePad from '../../components/SignaturePad'
import { Badge, Button, Field, Input, Select } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { stamp } from '../../lib/folio'
import { dayMonth } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { daysHeld, isValuable, staysForItem } from '../../lib/lostFound'
import type { LostItem } from '../../lib/lostFound'
import { useAuth } from '../auth/authContext'
import { useLostFound } from './lostFoundContext'
import ApprovalGate from '../approvals/ApprovalGate'
import { useApprovals } from '../approvals/approvalsContext'
import { useFeatures } from '../platform/featuresContext'

const ID_TYPES = ['NIN', 'Passport', 'Driving permit', 'Other']

// Handing an item back. The hotel has to be able to show it went to the right person, so the collector's
// name, ID and signature are recorded. A valuable also needs a manager's name.
export default function ReleaseItemPanel({
  item,
  onClose,
  startOn = 'release',
}: {
  item: LostItem
  onClose: () => void
  startOn?: 'release' | 'dispose'
}) {
  const { releaseItem, disposeItem } = useLostFound()
  const { reservations } = useHotel()
  const { user } = useAuth()
  const { options, tenant, features } = useFeatures()
  const { record } = useApprovals()
  const [asking, setAsking] = useState(false)

  const stays = useMemo(() => staysForItem(item, reservations), [item, reservations])
  const [mode, setMode] = useState<'release' | 'dispose'>(startOn)
  const [stayId, setStayId] = useState(stays[0]?.id ?? '')
  const [name, setName] = useState(stays[0]?.guest ?? '')
  const [idType, setIdType] = useState(ID_TYPES[0])
  const [idNumber, setIdNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [onBehalf, setOnBehalf] = useState('')
  const [someoneElse, setSomeoneElse] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [manager, setManager] = useState('')
  const [approved, setApproved] = useState<string>('')
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)

  const valuable = isValuable(item.category)
  const held = daysHeld(item, TODAY)
  // A small hotel keeps it simple: no safe rules and no approval step.
  const simple = tenant.plan === 'starter' || !features.inspections ? tenant.plan === 'starter' : false

  const canRelease =
    name.trim() !== '' && idNumber.trim() !== '' && phone.trim() !== '' && !!signature && (!valuable || simple || approved !== '')
  const canDispose = reason.trim() !== '' && manager.trim() !== ''

  function release() {
    if (!canRelease) return
    releaseItem(item.id, {
      at: stamp(),
      name: name.trim(),
      idType,
      idNumber: idNumber.trim(),
      phone: phone.trim(),
      onBehalfOf: someoneElse && onBehalf.trim() ? onBehalf.trim() : undefined,
      signature: signature ?? undefined,
      releasedBy: user?.name ?? 'Front desk',
      approvedBy: valuable && !simple ? approved : undefined,
      reservationId: stayId || undefined,
    })
    setDone(true)
  }

  function dispose() {
    if (!canDispose) return
    disposeItem(item.id, { at: stamp(), by: user?.name ?? 'Front desk', reason: `${reason.trim()} (approved by ${manager.trim()})` })
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={`Hand over ${item.id}`}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-linear-to-r from-brand-deep to-brand p-4 text-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Front desk · Lost and found</p>
            <h2 className="truncate text-lg font-semibold">{item.description}</h2>
            <p className="text-sm text-white/80">
              {item.id} · found in {item.foundIn} on {dayMonth(item.foundOn)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-white/90 hover:text-white">
            Close
          </button>
        </div>

        {done ? (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-good/30 bg-good/10 p-4">
              <p className="font-semibold text-good">
                {mode === 'release' ? `Handed to ${name.trim()}.` : 'Recorded as disposed of.'}
              </p>
              <p className="mt-1 text-sm text-ink/75">
                {mode === 'release'
                  ? 'The name, ID, phone and signature are saved against the item as proof.'
                  : 'The item stays in the list with the reason and who approved it.'}
              </p>
            </div>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="rounded-xl border border-ink/10 bg-canvas p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">The item</p>
                    <p className="mt-1 text-sm text-ink">
                      {item.category} · {item.foundWhere}
                    </p>
                    <p className="text-xs text-ink/60">
                      Found by {item.foundBy} · kept in {item.storedAt} · held {held} day{held === 1 ? '' : 's'}
                    </p>
                    {item.notes && <p className="mt-1 text-xs text-ink/70">{item.notes}</p>}
                  </div>
                  {item.photo && <img src={item.photo} alt={item.description} className="h-20 w-28 rounded-lg border border-ink/15 object-cover" />}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Who stayed in {item.foundIn} then</p>
                {stays.length === 0 ? (
                  <p className="mt-1 text-sm text-ink/60">
                    No stay covers that date. Ask for more detail first.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {stays.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStayId(s.id)
                          setName(s.guest)
                        }}
                        className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                          stayId === s.id ? 'border-brand bg-brand/[0.08] ring-2 ring-brand/20' : 'border-ink/12 bg-canvas hover:border-brand/40'
                        }`}
                      >
                        <p className="font-semibold text-ink">{s.guest}</p>
                        <p className="text-xs text-ink/60">
                          {s.id} · {dayMonth(s.arrival)} to {dayMonth(s.departure)} · {s.details?.phone ?? 'no phone on file'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex gap-2">
                {(
                  [
                    { key: 'release' as const, label: 'Hand it over' },
                    { key: 'dispose' as const, label: 'Dispose of it' },
                  ]
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setMode(o.key)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      mode === o.key ? 'bg-brand text-white' : 'border border-ink/15 text-ink hover:bg-canvas'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {mode === 'release' ? (
                <section className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Who is collecting it" required>
                      {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
                    </Field>
                    <Field label="Phone number" required>
                      {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7.." />}
                    </Field>
                    <Field label="ID type" required>
                      {(id) => (
                        <Select id={id} value={idType} onChange={(e) => setIdType(e.target.value)}>
                          {ID_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="ID number" required hint="Write it down from the card. This is the hotel's proof.">
                      {(id) => <Input id={id} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />}
                    </Field>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={someoneElse} onChange={(e) => setSomeoneElse(e.target.checked)} className="mt-1" />
                    <span>Someone else is collecting it for the guest</span>
                  </label>
                  {someoneElse && (
                    <Field label="Collecting for" required>
                      {(id) => <Input id={id} value={onBehalf} onChange={(e) => setOnBehalf(e.target.value)} placeholder="The guest's name" />}
                    </Field>
                  )}

                  {valuable && !simple && (
                    approved ? (
                      <p className="rounded-xl border border-good/30 bg-good/10 p-3 text-sm font-semibold text-good">
                        Approved by {approved}.
                      </p>
                    ) : asking ? (
                      <ApprovalGate
                        amount={0}
                        limits={options.limits}
                        plan={tenant.plan}
                        kind="valuable-release"
                        what={`${item.description} from the safe`}
                        onCancel={() => setAsking(false)}
                        onApproved={(approvers, photoSkipped) => {
                          const names = approvers.map((a) => a.name).join(' and ')
                          setApproved(names)
                          setAsking(false)
                          record({
                            kind: 'valuable-release',
                            what: `${item.description} (${item.id}) to ${name.trim() || 'a guest'}`,
                            requestedBy: user?.name ?? 'Front desk',
                            reason: `Released from ${item.storedAt}`,
                            approvers,
                            level: 'manager',
                            photoSkipped,
                          })
                        }}
                      />
                    ) : (
                      <div className="rounded-xl border border-warn/30 bg-warn/10 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-warn">This is a valuable</p>
                          <Badge tone="warn">A manager must approve</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-ink/70">It is kept in the safe, so a manager signs with their PIN.</p>
                        <div className="mt-2">
                          <Button size="sm" variant="secondary" onClick={() => setAsking(true)}>
                            Ask for approval
                          </Button>
                        </div>
                      </div>
                    )
                  )}

                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink/80">
                      Signature of the person collecting it <span className="text-bad">*</span>
                    </p>
                    <SignaturePad onChange={setSignature} />
                  </div>
                </section>
              ) : (
                <section className="space-y-3">
                  <p className="rounded-xl border border-ink/10 bg-canvas p-3 text-sm text-ink/70">
                    The item stays in the list, marked disposed.
                  </p>
                  <Field label="Why" required hint="Kept past the hotel's time limit, perishable, given to charity.">
                    {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
                  </Field>
                  <Field label="Manager who approved it" required>
                    {(id) => <Input id={id} value={manager} onChange={(e) => setManager(e.target.value)} />}
                  </Field>
                </section>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 p-4">
              {mode === 'release' ? (
                <Button className="flex-1" onClick={release} disabled={!canRelease}>
                  Hand over and record it
                </Button>
              ) : (
                <Button className="flex-1" onClick={dispose} disabled={!canDispose}>
                  Record as disposed of
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
