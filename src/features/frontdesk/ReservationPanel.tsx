import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { TODAY } from '../../data/sample'
import { guarantees } from '../../data/rates'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { planFor } from '../../lib/booking'
import type { CancelMode } from '../../lib/cancel'
import type { Reservation } from '../../types'
import AmendPanel from './AmendPanel'
import CancelPanel from './CancelPanel'
import ArrivalRoomHelp from './ArrivalRoomHelp'
import CompanyChecks from './CompanyChecks'
import MoveRoomPanel from './MoveRoomPanel'
import { checkInBlock } from '../../lib/corporate'
import { useCorporate } from '../corporate/corporateContext'
import { useMessages } from '../messages/messagesContext'
import { useHotel } from '../../lib/hotelContext'
import { useFeatures } from '../platform/featuresContext'
import { PRE_REG_LABEL, PRE_REG_TONE, portalLink, preRegLink, preRegProgress, preRegState } from '../../lib/preRegistration'
import { SHARE_NOTE, legsOf } from '../../lib/sharing'
import { KEY_STATE_LABEL, KEY_STATE_TONE } from '../../lib/keys'
import { useAuth } from '../auth/authContext'
import ShareDialog from './ShareDialog'
import SplitStayDialog from './SplitStayDialog'
import { Badge } from '../../components/ui'
import { CHANNEL_LABEL, KIND_LABEL } from '../../lib/messages'

type Props = { reservation: Reservation; onClose: () => void; onCheckIn?: () => void }

const sourceLabel = {
  'walk-in': 'Walk-in',
  'front desk': 'Front desk',
  phone: 'Phone',
  email: 'Email',
  online: 'Online',
  ota: 'OTA',
}

const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

export default function ReservationPanel({ reservation: r, onClose, onCheckIn }: Props) {
  const [amending, setAmending] = useState(false)
  const [moving, setMoving] = useState(false)
  const [cancelMode, setCancelMode] = useState<CancelMode | null>(null)
  const [showPhoto, setShowPhoto] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const balance = r.total - r.paid
  const { byId } = useCorporate()
  const { forStay, queue } = useMessages()
  const stayMessages = forStay(r.id)
  const { sendPreReg, reservations, addShare, splitStay, keys, issueKey, returnKey, cancelKey } = useHotel()
  const { features } = useFeatures()
  const { user } = useAuth()
  const me = user?.name ?? 'Front desk'
  const preState = preRegState(r.preReg)
  const canArrange = r.status === 'booked' || r.status === 'in-house'
  const stayKeys = keys.filter((k) => k.reservationId === r.id)
  const preProgress = preRegProgress(r.preReg?.details)
  const blocked = r.corporate && r.status === 'booked' ? checkInBlock(r, byId(r.corporate.accountId)) : null

  const rows: string[][] = [
    ['Booked via', r.source ? sourceLabel[r.source] : 'Not recorded'],
    ...(r.upgrade ? [['Upgrade', `Free, from ${r.upgrade.from}`]] : []),
    ['Room', r.room ? `${r.room} (${r.roomType})` : `${r.roomType}, not assigned yet`],
    ['Arrival', dayMonth(r.arrival)],
    ['Departure', dayMonth(r.departure)],
    ['Nights', String(nightsBetween(r.arrival, r.departure))],
  ]
  if (r.plan) rows.push(['Rate plan', planFor(r.plan).name])
  if (r.guarantee) rows.push(['Guarantee', guarantees.find((g) => g.key === r.guarantee)?.label ?? r.guarantee])
  if (r.adults !== undefined) rows.push(['Guests', `${r.adults} adult${r.adults === 1 ? '' : 's'}${r.children ? `, ${r.children} child${r.children === 1 ? '' : 'ren'}` : ''}`])

  const d = r.details
  const guestRows: string[][] = []
  if (d) {
    guestRows.push(
      ['ID', `${d.idType} ending ${d.idNumber.slice(-4)}${d.idReadFrom ? d.idReadFrom === 'typed' ? ', typed from the strip' : ', read from the card' : ''}`],
      ['Nationality', d.nationality],
      ['Phone', d.phone],
    )
    if (d.idName) guestRows.push(['Name on the ID', d.idName])
    if (d.idExpiry) guestRows.push(['ID expiry', d.idExpiry])
    if (d.dateOfBirth) guestRows.push(['Date of birth', d.dateOfBirth])
    if (d.purpose) guestRows.push(['Purpose', d.purpose])
    if (d.vehiclePlate) guestRows.push(['Vehicle', d.vehiclePlate])
    if (d.emergencyName) guestRows.push(['Emergency contact', `${d.emergencyName} ${d.emergencyPhone ?? ''}`.trim()])
    guestRows.push(['Requests', d.specialRequests || 'None'])
  }

  const isBooked = r.status === 'booked'
  const canChange = isBooked || r.status === 'in-house'
  const c = r.cancellation

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Booking for ${r.guest}`}
    >
    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">{r.guest}</h2>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill status={r.status} />
            <span className="text-xs text-ink/55">{r.id}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Total', ugx(r.total), 'text-ink'],
            ['Paid', ugx(r.paid), 'text-good'],
            ['Balance', ugx(balance), balance > 0 ? 'text-bad' : 'text-good'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-ink/10 bg-linear-to-br from-brand/[0.06] to-surface px-2 py-2">
              <p className="text-xs text-ink/55">{label}</p>
              <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-ink/55">{label}</dt>
              <dd className="truncate font-medium" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {r.corporate && (
          <div>
            <p className={`${heading} mb-2`}>Company booking</p>
            <CompanyChecks r={r} />
          </div>
        )}

        {c && (
          <div>
            <p className={heading}>{c.kind === 'no-show' ? 'No-show' : 'Cancellation'}</p>
            <dl className="mt-2 space-y-2 text-sm">
              {[
                ['When', c.at],
                ['Reason', c.reason],
                ['Charge', c.waived ? 'Waived' : ugx(c.charge)],
                ['Refund (simulated)', ugx(c.refund)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink/60">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {d && (
          <div>
            <p className={heading}>Guest details</p>
            <dl className="mt-2 space-y-2 text-sm">
              {guestRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink/60">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {(d.idPhoto || d.signature) && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowPhoto((s) => !s)}
                  className="text-sm font-semibold text-brand"
                >
                  {showPhoto ? 'Hide ID photo and signature' : 'Show ID photo and signature'}
                </button>
                {showPhoto && (
                  <div className="mt-2 space-y-3">
                    {d.idPhoto && <img src={d.idPhoto} alt="Guest ID" className="max-h-56 rounded-lg border border-ink/10" />}
                    {d.signature && (
                      <img src={d.signature} alt="Guest signature" className="max-h-24 rounded-lg border border-ink/10 bg-white" />
                    )}
                    <p className="text-xs text-ink/60">Personal data. In the real system only authorised staff can open this.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {features.guestPortal && r.status !== 'cancelled' && (
          <div>
            <p className={heading}>Their own page</p>
            <p className="mt-1 text-sm text-ink/70">
              One link holding their stay, their bill, the form before arrival and anything they want to ask for.
              Send it with any message, or read it out over the telephone.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-sm font-semibold text-brand"
                onClick={() => void navigator.clipboard?.writeText(portalLink(window.location.origin, r.id, r.arrival))}
              >
                Copy the link
              </button>
              <a
                href={portalLink(window.location.origin, r.id, r.arrival)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-ink/60"
              >
                Open it
              </a>
            </div>
            <p className="mt-1 break-all text-xs text-ink/45">
              {portalLink(window.location.origin, r.id, r.arrival)}
            </p>
          </div>
        )}

        {features.preRegistration && r.status === 'booked' && (
          <div>
            <p className={heading}>Before they arrive</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={PRE_REG_TONE[preState]} dot>
                {PRE_REG_LABEL[preState]}
              </Badge>
              {preState === 'filled in' && (
                <span className="text-xs text-ink/60">
                  {preProgress.answered} of {preProgress.total} answered · sent {r.preReg?.submittedAt}
                </span>
              )}
              {preState === 'opened' && <span className="text-xs text-ink/60">Opened {r.preReg?.openedAt}, not finished yet.</span>}
              {preState === 'sent' && <span className="text-xs text-ink/60">Sent {r.preReg?.sentAt}, not opened yet.</span>}
            </div>
            {preState === 'filled in' && (
              <p className="mt-2 text-sm text-ink/70">
                Their answers are waiting in the check-in form. Check them against the ID when they arrive.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-sm font-semibold text-brand"
                onClick={() => {
                  sendPreReg(r.id)
                  queue({ kind: 'before arrival', reservationId: r.id })
                }}
              >
                {preState === 'not sent' ? 'Send the link' : 'Send the link again'}
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-ink/60"
                onClick={() => void navigator.clipboard?.writeText(preRegLink(window.location.origin, r.id, r.arrival))}
              >
                Copy the link
              </button>
            </div>
          </div>
        )}

        {(r.share || r.legs) && (
          <div>
            <p className={heading}>{r.share ? 'Sharing this room' : 'This stay is in more than one room'}</p>
            {r.share && (
              <p className="mt-1 text-sm text-ink/75">
                With <strong>{r.share.withGuest}</strong>.{' '}
                {r.share.splitRoom ? SHARE_NOTE.split : SHARE_NOTE.primary}{' '}
                {r.share.primary ? 'This booking holds the room.' : 'The room is held by the other booking, so it is only counted once.'}
              </p>
            )}
            {r.legs && (
              <ul className="mt-1 space-y-1 text-sm text-ink/75">
                {legsOf(reservations, r.id).map((leg) => (
                  <li key={leg.id} className={leg.id === r.id ? 'font-medium text-ink' : ''}>
                    {dayMonth(leg.arrival)} to {dayMonth(leg.departure)} · {leg.roomType}
                    {leg.room ? ` · Room ${leg.room}` : ' · room not assigned'}
                    {leg.id === r.id ? ' · this part' : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {features.roomKeys && r.room && (r.status === 'in-house' || r.status === 'checked-out') && (
          <div>
            <p className={heading}>Keys</p>
            {stayKeys.length === 0 ? (
              <p className="mt-1 text-sm text-ink/60">No key has been cut for this stay.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {stayKeys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink/75">
                      {k.copy ? 'Copy' : 'Key'} · {k.id} · works until {k.worksUntil}
                      <span className="block text-xs text-ink/55">
                        {k.issuedBy}, {k.issuedAt}
                        {k.returnedAt ? ` · handed back ${k.returnedAt}` : ''}
                        {k.cancelledReason ? ` · ${k.cancelledReason}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={KEY_STATE_TONE[k.state]} dot>
                        {KEY_STATE_LABEL[k.state]}
                      </Badge>
                      {k.state === 'active' && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand" onClick={() => returnKey(k.id)}>
                            Handed back
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-bad"
                            onClick={() => cancelKey(k.id, 'Reported lost')}
                          >
                            Lost
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {r.status === 'in-house' && (
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => issueKey(r.id, me, stayKeys.length > 0)}>
                  {stayKeys.length > 0 ? 'Cut another copy' : 'Cut a key'}
                </button>
              </div>
            )}
            <p className="mt-1 text-xs text-ink/55">
              The hotel's own record of who could open this room and until when. Writing the card itself belongs to the door-lock vendor, and
              in this prototype nothing is written.
            </p>
          </div>
        )}

        {canArrange && (
          <div>
            <p className={heading}>Arrangements</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {!r.share && r.room && r.status === 'in-house' && (
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setSharing(true)}>
                  Add somebody sharing this room
                </button>
              )}
              {!r.legs && nightsBetween(r.arrival, r.departure) > 1 && (
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setSplitting(true)}>
                  Move rooms part-way through
                </button>
              )}
            </div>
          </div>
        )}

        {stayMessages.length > 0 && (
          <div>
            <p className={heading}>Messages to the guest</p>
            <ul className="mt-2 space-y-2 text-sm">
              {stayMessages.map((m) => (
                <li key={m.id} className="border-b border-ink/5 pb-2 last:border-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{KIND_LABEL[m.kind]}</span>
                    <span className="text-xs text-ink/55">
                      {m.status === 'sent'
                        ? `Sent ${m.sentAt} by ${CHANNEL_LABEL[m.channel]}${m.by ? ` (${m.by})` : ''}`
                        : m.status === 'queued'
                          ? 'Written, waiting to be sent'
                          : m.status === 'failed'
                            ? `Could not go: ${m.problem}`
                            : 'Not sent'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-ink/70">{m.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.changes && r.changes.length > 0 && (
          <div>
            <p className={heading}>Changes</p>
            <ul className="mt-2 space-y-2 text-sm">
              {r.changes.map((ch, i) => (
                <li key={i} className="rounded-lg bg-canvas p-2">
                  <p className="font-medium">
                    {dayMonth(ch.fromArrival)} to {dayMonth(ch.fromDeparture)} → {dayMonth(ch.toArrival)} to {dayMonth(ch.toDeparture)}
                  </p>
                  <p className="text-xs text-ink/60">
                    {ch.at} · {ch.reason}
                    {ch.fee > 0 && ` · fee ${ugx(ch.fee)}`}
                    {ch.waived && ' · fee waived'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isBooked && r.arrival <= TODAY && (
        <div className="border-t border-warn/30 bg-warn/[0.07] p-4 empty:hidden">
          <ArrivalRoomHelp reservation={r} />
        </div>
      )}
      {blocked && isBooked && onCheckIn && (
        <p className="border-t border-bad/20 bg-bad/10 px-4 py-2 text-xs font-medium text-bad">Check-in blocked: {blocked}</p>
      )}
      {(canChange || (isBooked && onCheckIn)) && (
        <div className="flex flex-wrap gap-3 border-t border-ink/10 p-4">
          {isBooked && onCheckIn && (
            <button
              type="button"
              onClick={onCheckIn}
              disabled={!!blocked}
              title={blocked ?? undefined}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Check in
            </button>
          )}
          {canChange && (
            <button
              type="button"
              onClick={() => setAmending(true)}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold"
            >
              Change stay
            </button>
          )}
          {r.status === 'in-house' && r.room && (
            <button
              type="button"
              onClick={() => setMoving(true)}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold"
            >
              Move room
            </button>
          )}
          {isBooked && (
            <button
              type="button"
              onClick={() => setCancelMode('cancel')}
              className="rounded-lg border border-bad/40 px-4 py-2 text-sm font-semibold text-bad"
            >
              Cancel
            </button>
          )}
          {isBooked && r.arrival <= TODAY && (
            <button
              type="button"
              onClick={() => setCancelMode('no-show')}
              className="rounded-lg border border-bad/40 px-4 py-2 text-sm font-semibold text-bad"
            >
              No-show
            </button>
          )}
        </div>
      )}

            {(r.status === 'in-house' || r.status === 'checked-out') && (
        <div className="border-t border-ink/10 p-4">
          <Link
            to={`/desk/folios?view=${r.status === 'in-house' ? 'inhouse' : 'out'}&r=${r.id}`}
            className="block rounded-lg bg-brand px-4 py-2 text-center text-sm font-semibold text-white"
          >
            {r.status === 'in-house' ? 'Open folio' : 'View folio and invoice'}
          </Link>
        </div>
      )}

    </div>

      {sharing && (
        <ShareDialog
          reservation={r}
          onClose={() => setSharing(false)}
          onAdd={(g, p, split) => {
            addShare(r.id, g, p, split)
            setSharing(false)
          }}
        />
      )}
      {splitting && (
        <SplitStayDialog
          reservation={r}
          onClose={() => setSplitting(false)}
          onSplit={(date, type, room) => {
            splitStay(r.id, date, type, room)
            setSplitting(false)
          }}
        />
      )}
      {amending && <AmendPanel reservation={r} onClose={() => setAmending(false)} onDone={onClose} />}
      {moving && <MoveRoomPanel reservation={r} onClose={() => setMoving(false)} onDone={() => setMoving(false)} />}
      {cancelMode && (
        <CancelPanel reservation={r} mode={cancelMode} onClose={() => setCancelMode(null)} onDone={onClose} />
      )}
    </div>
  )
}