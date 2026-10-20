import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, MoneyBars, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { inBlock, masterBill, rateFor, routeOf } from '../../lib/groups'
import { splitFolio } from '../../lib/folioSplit'
import { useHotel } from '../../lib/hotelContext'
import { nightlyRate } from '../../lib/rates'
import { beoLineTotal, eventMoney, hireFor, livePostings, marginPct } from '../../services/events/eventsRules'
import type { EventBooking, EventPosting, EventsData, MasterAccount, PostingCategory, PostingInput } from '../../services/events/eventsTypes'
import { useCorporate } from '../corporate/corporateContext'
import { useGroups } from '../groups/groupsContext'
import { useFeatures } from '../platform/featuresContext'
import { ErrorNote } from './ErrorNote'
import { COST_CATEGORIES, COST_LABEL, EVENT_STATUS_LABEL, EVENT_STATUS_TONE, POSTING_CATEGORIES, num, shortDate, stampText, ugxShort } from './eventsUi'
import PaymentDialog from './PaymentDialog'
import { useEvents, useRun } from './useEvents'

/** A deposit held ahead of the charges reads as a credit, not a negative number. */
const balanceText = (n: number) => (n < 0 ? `${ugx(-n)} credit` : ugx(n))

/** Posted charges once the event is over; until then the larger of the BEO forecast and what is posted. */
const eventRevenue = (b: EventBooking, m: ReturnType<typeof eventMoney>) =>
  b.status === 'completed' && m.postedRevenue > 0 ? m.postedRevenue : Math.max(m.postedRevenue, m.forecastRevenue)

/** Where an event charge lands on a guest folio. */
const folioCategory = (c: PostingCategory) => (c === 'Food' || c === 'Beverage' ? 'Restaurant' : 'Other')

/** The group block's side of the bill: rooms and anything else the block sends to the organiser. */
function useRoomSide() {
  const { reservations } = useHotel()
  const { byId } = useGroups()
  const { byId: account } = useCorporate()
  const { options } = useFeatures()
  return (blockId: string | undefined) => {
    const block = byId(blockId)
    if (!block) return null
    const bill = masterBill(
      block,
      reservations,
      (r, b) => splitFolio(r, block.accountId ? account(block.accountId)?.name : undefined, b),
      (t) => nightlyRate(t, 0, options.rates),
    )
    const nights = Math.max(1, nightsBetween(block.arrival, block.departure))
    const value = block.rooms.reduce((s, r) => s + rateFor(block, r.type, nightlyRate(r.type, 0, options.rates)) * r.count * nights, 0)
    const lead = inBlock(reservations, block.id).find((r) => r.status === 'in-house')
    return { block, bill, value, lead }
  }
}

function accountTotals(m: MasterAccount, data: EventsData, roomMaster: number) {
  const posts = livePostings(data.postings.filter((p) => p.masterAccountId === m.id))
  // A charge also put on the group folio is already inside the group's master bill.
  const charges = posts.filter((p) => !p.folioReservationId).reduce((s, p) => s + p.amount, 0)
  const paid = data.payments.filter((p) => p.eventBookingId === m.eventBookingId).reduce((s, p) => s + p.amount, 0)
  return { charges, rooms: roomMaster, paid, balance: charges + roomMaster - paid }
}

export default function BillingPage() {
  const { data, sales, service, actor } = useEvents()
  const roomSide = useRoomSide()
  const [tab, setTab] = useState<'accounts' | 'profit'>('accounts')
  const [openId, setOpenId] = useState<string | null>(null)
  const [profitId, setProfitId] = useState<string | null>(null)
  const { error, run } = useRun()

  const eventOf = (id: string) => data.bookings.find((b) => b.id === id)
  const rows = data.masterAccounts.map((m) => ({ m, t: accountTotals(m, data, roomSide(m.groupBlockId)?.bill.masterTotal ?? 0) }))
  const open = rows.filter((r) => r.m.status === 'open')
  const withoutAccount = data.bookings.filter((b) => (b.status === 'definite' || b.status === 'tentative') && !data.masterAccounts.some((m) => m.eventBookingId === b.id))

  const profit = data.bookings
    .filter((b) => b.status !== 'cancelled')
    .map((b) => {
      const money = eventMoney(b.id, data)
      const rooms = roomSide(b.groupBlockId)?.value ?? 0
      const actual = b.status === 'completed' && money.postedRevenue > 0
      const revenue = eventRevenue(b, money) + rooms
      return { b, money, rooms, revenue, cost: money.actualCost, actual }
    })
    .sort((a, b) => b.b.startDate.localeCompare(a.b.startDate))
  const totRev = profit.reduce((s, p) => s + p.revenue, 0)
  const totCost = profit.reduce((s, p) => s + p.cost, 0)

  const shown = data.masterAccounts.find((m) => m.id === openId)
  const shownProfit = profit.find((p) => p.b.id === profitId)

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Events and sales" title="Billing and profit" description="Master accounts for events, charges posted to them, and what each event made." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open accounts" value={String(open.length)} icon="list" />
        <StatCard label="Charges posted" value={ugxShort(open.reduce((s, r) => s + r.t.charges + r.t.rooms, 0))} hint="Open accounts" icon="money" />
        <StatCard label="Balance due" value={ugxShort(open.reduce((s, r) => s + Math.max(0, r.t.balance), 0))} tone={open.some((r) => r.t.balance > 0) ? 'warn' : 'default'} icon="alert" />
        {sales ? (
          <StatCard label="Event margin" value={`${marginPct(totRev, totCost)}%`} hint={`${ugxShort(totRev - totCost)} on ${ugxShort(totRev)}`} tone="good" icon="occupancy" onClick={() => setTab('profit')} />
        ) : (
          <StatCard label="Received" value={ugxShort(data.payments.reduce((s, p) => s + p.amount, 0))} icon="check" />
        )}
      </div>

      {sales && (
        <Tabs
          label="Billing"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'accounts', label: 'Master accounts', count: data.masterAccounts.length },
            { key: 'profit', label: 'Profitability' },
          ]}
        />
      )}
      <ErrorNote error={error} />

      {tab === 'accounts' && (
        <>
          <Card title="Master accounts" icon="money" padded={false}>
            <DataTable
              rows={rows}
              rowKey={(r) => r.m.id}
              onRowClick={(r) => setOpenId(r.m.id)}
              empty={{ title: 'No master accounts' }}
              columns={[
                {
                  key: 'n',
                  header: 'Account',
                  cell: (r) => (
                    <div>
                      <p className="font-medium text-ink">{r.m.name}</p>
                      <p className="text-xs text-ink/55">{eventOf(r.m.eventBookingId) ? dayMonth(eventOf(r.m.eventBookingId)!.startDate) : ''}</p>
                    </div>
                  ),
                },
                { key: 'c', header: 'Charges', cell: (r) => ugx(r.t.charges + r.t.rooms), align: 'right', hideBelow: 'sm' },
                { key: 'p', header: 'Paid', cell: (r) => ugx(r.t.paid), align: 'right', hideBelow: 'md' },
                { key: 'b', header: 'Balance', cell: (r) => <span className={r.t.balance > 0 ? 'font-semibold text-ink' : 'text-good'}>{balanceText(r.t.balance)}</span>, align: 'right' },
                { key: 's', header: 'Status', cell: (r) => <Badge tone={r.m.status === 'open' ? 'info' : 'neutral'}>{r.m.status === 'open' ? 'Open' : 'Closed'}</Badge> },
              ]}
            />
          </Card>
          {withoutAccount.length > 0 && (
            <Card title="Events without a master account" count={withoutAccount.length} padded={false}>
              <ul className="divide-y divide-ink/8">
                {withoutAccount.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink">{b.name}</p>
                      <p className="text-xs text-ink/55">
                        {b.clientName} · {dayMonth(b.startDate)}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => run(() => service.openMasterAccount(b.id, actor)).then((m) => m && setOpenId(m.id))}>
                      Open master account
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'profit' && sales && (
        <Card title="Revenue and cost per event" icon="occupancy" padded={false}>
          <DataTable
            rows={profit}
            rowKey={(p) => p.b.id}
            onRowClick={(p) => setProfitId(p.b.id)}
            empty={{ title: 'No events' }}
            columns={[
              {
                key: 'e',
                header: 'Event',
                cell: (p) => (
                  <div>
                    <p className="font-medium text-ink">{p.b.name}</p>
                    <p className="text-xs text-ink/55">{dayMonth(p.b.startDate)}</p>
                  </div>
                ),
              },
              { key: 's', header: 'Status', cell: (p) => <Badge tone={EVENT_STATUS_TONE[p.b.status]}>{EVENT_STATUS_LABEL[p.b.status]}</Badge>, hideBelow: 'lg' },
              { key: 'r', header: 'Revenue', cell: (p) => <span title={p.actual ? 'Posted' : 'Forecast'}>{ugx(p.revenue)}{p.actual ? '' : ' *'}</span>, align: 'right' },
              { key: 'c', header: 'Cost', cell: (p) => ugx(p.cost), align: 'right', hideBelow: 'sm' },
              { key: 'm', header: 'Margin', cell: (p) => ugx(p.revenue - p.cost), align: 'right', hideBelow: 'md' },
              {
                key: 'pct',
                header: '%',
                align: 'right',
                cell: (p) => {
                  const m = marginPct(p.revenue, p.cost)
                  return <span className={`font-semibold ${m < 30 ? 'text-bad' : m < 50 ? 'text-warn' : 'text-good'}`}>{m}%</span>
                },
              },
            ]}
          />
          <div className="flex flex-wrap justify-between gap-2 border-t border-ink/10 px-4 py-2.5 text-sm">
            <span className="text-xs text-ink/55">* Forecast until the event is completed</span>
            <span className="font-semibold text-ink">
              {ugx(totRev)} revenue · {ugx(totRev - totCost)} margin
            </span>
          </div>
        </Card>
      )}

      {shown && <MasterPanel account={shown} data={data} onClose={() => setOpenId(null)} />}
      {shownProfit && (
        <ProfitPanel booking={shownProfit.b} data={data} rooms={shownProfit.rooms} onClose={() => setProfitId(null)} />
      )}
    </div>
  )
}

type Pending = { key: string; category: PostingCategory; description: string; amount: number; date: string; source: EventPosting['source'] }

function MasterPanel({ account, data, onClose }: { account: MasterAccount; data: EventsData; onClose: () => void }) {
  const { service, actor } = useEvents()
  const { addCharge, reverseCharge, reservations } = useHotel()
  const roomSide = useRoomSide()
  const { busy, error, run } = useRun()
  const [toFolio, setToFolio] = useState(true)
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState<EventPosting | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [closing, setClosing] = useState(false)
  const [manual, setManual] = useState({ category: 'Other' as PostingCategory, description: '', amount: '', date: TODAY })

  const booking = data.bookings.find((b) => b.id === account.eventBookingId) as EventBooking
  const side = roomSide(account.groupBlockId)
  const t = accountTotals(account, data, side?.bill.masterTotal ?? 0)
  const postings = data.postings.filter((p) => p.masterAccountId === account.id).sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  const payments = data.payments.filter((p) => p.eventBookingId === account.eventBookingId)
  const posted = new Set(livePostings(postings).map((p) => p.sourceId).filter(Boolean))
  const isOpen = account.status === 'open'

  const beoIds = new Set(data.beos.filter((b) => b.eventBookingId === booking.id).map((b) => b.id))
  const pending: Pending[] = [
    ...data.sessions
      .filter((s) => s.eventBookingId === booking.id)
      .map((s) => ({ key: s.id, category: 'Room hire' as const, description: `${data.spaces.find((x) => x.id === s.spaceId)?.name}, ${s.title}`, amount: hireFor(s, data), date: s.date, source: 'space' as const })),
    ...data.beoItems
      .filter((i) => beoIds.has(i.beoId))
      .map((i) => ({ key: i.id, category: (i.kind === 'beverage' ? 'Beverage' : 'Food') as PostingCategory, description: `${i.description} × ${i.quantity}`, amount: beoLineTotal(i), date: i.date, source: 'beo' as const })),
    ...data.resourceBookings
      .filter((r) => r.eventBookingId === booking.id)
      .map((r) => ({ key: r.id, category: 'Equipment' as const, description: `${data.equipment.find((e) => e.id === r.equipmentId)?.name} × ${r.quantity}`, amount: r.quantity * r.unitPrice, date: r.date, source: 'resource' as const })),
  ].filter((p) => p.amount > 0 && !posted.has(p.key))

  // A charge goes on the group folio only when the block sends that category to the organiser.
  const canFolio = (c: PostingCategory) => !!side?.lead && routeOf(side.block, folioCategory(c)) === 'master'

  async function post(input: Omit<PostingInput, 'folioReservationId'>) {
    const folio = toFolio && canFolio(input.category) ? side?.lead : undefined
    const saved = await service.postCharge(account.id, { ...input, folioReservationId: folio?.id }, actor)
    if (folio) addCharge(folio.id, { category: folioCategory(input.category), description: `Event: ${input.description}`, amount: input.amount })
    return saved
  }
  const postPending = (p: Pending) => run(() => post({ category: p.category, description: p.description, amount: p.amount, date: p.date, source: p.source, sourceId: p.key }))
  const postAll = () =>
    run(async () => {
      for (const p of pending) await post({ category: p.category, description: p.description, amount: p.amount, date: p.date, source: p.source, sourceId: p.key })
      return true
    })
  const postManual = async () => {
    const ok = await run(() => post({ category: manual.category, description: manual.description, amount: num(manual.amount), date: manual.date, source: 'manual' }))
    if (ok) setManual({ ...manual, description: '', amount: '' })
  }
  const doVoid = async () => {
    const p = voiding
    if (!p) return
    const ok = await run(() => service.voidPosting(p.id, voidReason, actor))
    if (ok && p.folioReservationId) {
      const r = reservations.find((x) => x.id === p.folioReservationId)
      const line = r?.charges?.find((c) => !c.reversedBy && !c.reverses && c.amount === p.amount && c.description === `Event: ${p.description}`)
      if (line) reverseCharge(p.folioReservationId, line.id, voidReason, actor.name)
    }
    if (ok) {
      setVoiding(null)
      setVoidReason('')
    }
  }

  return (
    <Modal title={account.name} description={`Opened ${stampText(account.openedAt)} by ${account.openedBy}`} onClose={onClose} side wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Event charges" value={ugx(t.charges)} />
          <Mini label="Group bill" value={side ? ugx(t.rooms) : '—'} />
          <Mini label="Paid" value={ugx(t.paid)} />
          <Mini label={t.balance < 0 ? 'In credit' : 'Balance'} value={ugx(Math.abs(t.balance))} strong />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isOpen ? 'info' : 'neutral'} dot>
            {isOpen ? 'Open' : `Closed ${account.closedAt ? stampText(account.closedAt) : ''}`}
          </Badge>
          <Link to={`/events/bookings/${booking.id}`} className="text-sm font-semibold text-brand hover:underline">
            {booking.name}
          </Link>
          {side && <span className="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-[11px] text-ink/70">{side.block.code}</span>}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPaying(true)}>
              Record payment
            </Button>
            {isOpen && (
              <Button size="sm" variant="ghost" onClick={() => setClosing(true)}>
                Close account
              </Button>
            )}
          </div>
        </div>
        <ErrorNote error={error} />

        {side && (
          <label className="flex items-start gap-2 text-sm text-ink/80">
            <input type="checkbox" className="mt-0.5" checked={toFolio && !!side.lead} onChange={(e) => setToFolio(e.target.checked)} disabled={!side.lead} />
            <span>
              Also post to the group folio
              <span className="block text-xs text-ink/55">
                {side.lead ? `${side.lead.guest}, room ${side.lead.room}` : 'No room of the block is checked in yet'}
              </span>
            </span>
          </label>
        )}

        {isOpen && pending.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Not posted yet</p>
              <Button size="sm" onClick={postAll} disabled={busy}>
                Post all ({ugx(pending.reduce((s, p) => s + p.amount, 0))})
              </Button>
            </div>
            <ul className="mt-2 divide-y divide-ink/8 rounded-lg border border-ink/10">
              {pending.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-ink">{p.description}</p>
                    <p className="text-xs text-ink/55">
                      {p.category} · {shortDate(p.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{ugx(p.amount)}</span>
                    <Button size="sm" variant="secondary" onClick={() => postPending(p)} disabled={busy}>
                      Post
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isOpen && (
          <div className="rounded-lg border border-ink/10 p-3">
            <p className="text-sm font-semibold text-ink">Other charge</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[130px_1fr_120px_auto] sm:items-end">
              <Field label="Category">
                {(id) => (
                  <Select id={id} value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value as PostingCategory })}>
                    {POSTING_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Description">{(id) => <Input id={id} value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />}</Field>
              <Field label="Amount">{(id) => <Input id={id} inputMode="numeric" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />}</Field>
              <Button onClick={postManual} disabled={busy}>
                Post
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-ink">Posted</p>
          {postings.length === 0 ? (
            <p className="mt-1 text-sm text-ink/55">Nothing posted yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/8 rounded-lg border border-ink/10">
              {postings.map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${p.voidedAt ? 'opacity-55' : ''}`}>
                  <div className="min-w-0">
                    <p className={`text-ink ${p.voidedAt ? 'line-through' : ''}`}>{p.description}</p>
                    <p className="text-xs text-ink/55">
                      {p.category} · {stampText(p.postedAt)} · {p.postedBy}
                      {p.folioReservationId ? ' · on group folio' : ''}
                      {p.voidedAt ? ` · voided by ${p.voidedBy}: ${p.voidReason}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{ugx(p.amount)}</span>
                    {!p.voidedAt && isOpen && (
                      <button type="button" className="text-xs font-semibold text-bad hover:underline" onClick={() => setVoiding(p)}>
                        Void
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {side && side.bill.lines.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-ink">Group bill by room</p>
            <ul className="mt-2 space-y-1 text-sm text-ink/75">
              {side.bill.lines.map((l) => (
                <li key={l.reservationId} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.guest}
                    {l.room ? ` · ${l.room}` : ''}
                  </span>
                  <span className="tabular-nums">{ugx(l.master)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-ink">Payments</p>
          {payments.length === 0 ? (
            <p className="mt-1 text-sm text-ink/55">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-ink/75">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {stampText(p.receivedAt)} · {p.method} {p.reference} · {p.receivedBy}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{ugx(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {paying && <PaymentDialog eventBookingId={booking.id} label={account.name} amount={Math.max(0, t.balance)} onClose={() => setPaying(false)} />}
      {voiding && (
        <Modal
          title="Void this charge?"
          description={`${voiding.description} · ${ugx(voiding.amount)}`}
          onClose={() => setVoiding(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setVoiding(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={doVoid} disabled={busy}>
                Void charge
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Reason" required>
              {(id) => <Input id={id} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />}
            </Field>
            {voiding.folioReservationId && <p className="text-xs text-ink/60">The folio line is reversed too.</p>}
            <ErrorNote error={error} />
          </div>
        </Modal>
      )}
      {closing && (
        <ConfirmDialog
          title="Close the master account?"
          message={t.balance > 0 ? `${ugx(t.balance)} is still owed. Settle it first.` : 'No more charges can be posted.'}
          confirmLabel="Close account"
          onCancel={() => setClosing(false)}
          onConfirm={() => {
            setClosing(false)
            if (t.balance > 0) return
            void run(() => service.closeMasterAccount(account.id, actor))
          }}
        />
      )}
    </Modal>
  )
}

function ProfitPanel({ booking, data, rooms, onClose }: { booking: EventBooking; data: EventsData; rooms: number; onClose: () => void }) {
  const { service, actor } = useEvents()
  const { busy, error, run } = useRun()
  const [cost, setCost] = useState({ category: 'food' as (typeof COST_CATEGORIES)[number], description: '', amount: '' })
  const money = eventMoney(booking.id, data)
  const posts = livePostings(data.postings.filter((p) => p.eventBookingId === booking.id))
  const costs = data.costs.filter((c) => c.eventBookingId === booking.id)
  const byCat = POSTING_CATEGORIES.map((c) => ({ label: c, amount: posts.filter((p) => p.category === c).reduce((s, p) => s + p.amount, 0) })).filter((r) => r.amount > 0)
  const revenue = eventRevenue(booking, money) + rooms
  const add = async () => {
    if (await run(() => service.addCost(booking.id, { category: cost.category, description: cost.description, amount: num(cost.amount) }, actor))) setCost({ ...cost, description: '', amount: '' })
  }
  return (
    <Modal title={booking.name} description={`${dayMonth(booking.startDate)} · ${booking.clientName}`} onClose={onClose} side wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Revenue" value={ugx(revenue)} />
          <Mini label="Cost" value={ugx(money.actualCost)} />
          <Mini label="Margin" value={ugx(revenue - money.actualCost)} strong />
          <Mini label="Margin %" value={`${marginPct(revenue, money.actualCost)}%`} strong />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">Forecast</p>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="BEO, resources, hire" value={ugx(money.forecastRevenue)} />
              <Row label="Room block" value={ugx(rooms)} />
              <Row label="Forecast cost" value={ugx(money.forecastCost)} />
              <Row label="Forecast margin" value={`${marginPct(money.forecastRevenue + rooms, money.forecastCost)}%`} />
            </dl>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Posted by category</p>
            <div className="mt-2">{byCat.length ? <MoneyBars rows={byCat} /> : <p className="text-sm text-ink/55">Nothing posted yet.</p>}</div>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Recorded costs</p>
          {costs.length === 0 ? (
            <p className="mt-1 text-sm text-ink/55">None recorded. The forecast cost is used.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/8 rounded-lg border border-ink/10">
              {costs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="text-ink">{c.description}</p>
                    <p className="text-xs text-ink/55">
                      {COST_LABEL[c.category]} · {c.recordedBy}, {stampText(c.recordedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{ugx(c.amount)}</span>
                    <button type="button" className="text-xs font-semibold text-bad hover:underline" onClick={() => run(() => service.removeCost(c.id, actor))}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_120px_auto] sm:items-end">
            <Field label="Kind">
              {(id) => (
                <Select id={id} value={cost.category} onChange={(e) => setCost({ ...cost, category: e.target.value as typeof cost.category })}>
                  {COST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {COST_LABEL[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Description">{(id) => <Input id={id} value={cost.description} onChange={(e) => setCost({ ...cost, description: e.target.value })} />}</Field>
            <Field label="Amount">{(id) => <Input id={id} inputMode="numeric" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} />}</Field>
            <Button onClick={add} disabled={busy}>
              Add cost
            </Button>
          </div>
          <div className="mt-2">
            <ErrorNote error={error} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-ink/10 px-3 py-2">
      <p className="text-xs text-ink/55">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap text-[15px] tabular-nums ${strong ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink/65">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  )
}
