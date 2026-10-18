import { useMemo, useState } from 'react'
import { Badge, Button, Card, Field, Input, PageHeader, StatCard } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { soldByNight } from '../../lib/availability'
import {
  addDays,
  ariFor,
  commissionOn,
  KIND_LABEL,
  KIND_NOTE,
  newChannelId,
  newPushId,
  PUSH_TONE,
  pushProblem,
  sellableBy,
  unmapped,
} from '../../lib/channels'
import type { Channel, ChannelKind, Push } from '../../lib/channels'
import { stamp } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { DAY_SHORT, dayOf } from '../../lib/rateCalendar'
import { roomTypeList } from '../../lib/rates'
import type { Room } from '../../types'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import GroupDistributionCard from './GroupDistributionCard'
import ParityCard from './ParityCard'
import ProductionCard from './ProductionCard'
import { useChannels } from './useChannels'

const AHEAD = 14
const box = 'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink'
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * The hotel's side of its channels.
 *
 * Everything here is real except the wire: what each channel may sell, what it would be told, what it
 * costs, and the bookings it brings. No travel agent is contacted, and the page says so once, plainly,
 * rather than pretending.
 */
export default function ChannelsPage() {
  const { channels, setChannels, pushes, setPushes } = useChannels()
  const { rooms, reservations, addReservation, addGuest } = useHotel()
  const { tenant, options } = useFeatures()
  const { user } = useAuth()
  const [openId, setOpenId] = useState<string | null>(null)

  const by = user?.name ?? 'Front desk'
  const sold = useMemo(
    () => soldByNight(rooms, reservations, TODAY, addDays(TODAY, AHEAD)),
    [rooms, reservations],
  )

  const live = channels.filter((c) => c.on)
  const broken = channels.filter((c) => c.on && pushProblem(c))
  const fromChannels = reservations.filter((r) => r.channel && r.status !== 'cancelled')
  const owed = fromChannels.reduce((n, r) => n + commissionOn(r.total, r.channel!), 0)

  const change = (id: string, patch: Partial<Channel>) =>
    setChannels(channels.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  function push(c: Channel) {
    const why = pushProblem(c)
    const lines = why ? 0 : ariFor(c, rooms, reservations, options.rates, TODAY, AHEAD, (d) => sold[d]).length
    const made: Push = {
      id: newPushId(pushes),
      channelId: c.id,
      channelName: c.name,
      at: stamp(),
      from: TODAY,
      to: addDays(TODAY, AHEAD - 1),
      lines,
      state: why ? 'failed' : 'sent',
      reason: why,
      by,
    }
    setPushes([made, ...pushes].slice(0, 40))
    if (!why) change(c.id, { lastPush: made.at })
  }

  /** A booking arriving the other way. In production this is the channel calling the hotel. */
  function receive(c: Channel) {
    const type = sellableBy(c)[0] ?? 'Standard'
    const arrival = addDays(TODAY, 3)
    const departure = addDays(TODAY, 5)
    const guest = addGuest({ name: `Guest from ${c.name}`, phone: '0700 000 000' })
    const nightly = options.rates.roomRates[type] ?? 150000
    addReservation({
      guest: guest.name,
      guestId: guest.id,
      roomType: type,
      room: null,
      arrival,
      departure,
      total: nightly * 2,
      paid: 0,
      plan: options.rates.plans[0]?.id,
      guarantee: 'card',
      source: 'ota',
      adults: 2,
      children: 0,
      channel: { id: c.id, name: c.name, commissionPercent: c.commissionPercent },
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Channels"
        description={`${tenant.name}. Where this hotel is sold other than its own desk and its own site.`}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              setChannels([
                ...channels,
                {
                  id: newChannelId(channels),
                  name: '',
                  kind: 'ota',
                  commissionPercent: 15,
                  allotment: 0,
                  on: false,
                  mappings: roomTypeList.map((t) => ({ type: t, theirName: '', on: false })),
                },
              ])
            }
          >
            Add a channel
          </Button>
        }
      />

      <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3 text-sm text-ink/80">
        <p className="font-semibold text-ink">No travel agent is contacted from here.</p>
        <p className="mt-0.5 text-xs">
          Everything on this page is the hotel's own side: what each channel may sell, at what price, what it costs
          and what it brought. Sending it is a commercial agreement with a channel manager, and a push below is a
          simulation that says so in the log.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Channels on" icon="list" value={String(live.length)} hint={`${channels.length} set up`} />
        <StatCard
          label="Need attention"
          icon="alert"
          value={String(broken.length)}
          hint="Switched on but cannot send"
          tone={broken.length > 0 ? 'bad' : 'good'}
        />
        <StatCard label="Bookings from channels" icon="guests" value={String(fromChannels.length)} hint="Not cancelled" />
        <StatCard label="Commission on those" icon="money" value={ugx(owed)} hint="What the channels take" tone={owed > 0 ? 'warn' : 'default'} />
      </div>

      <Card title="Where this hotel is sold" icon="bed" count={channels.length} padded={false}>
        <ul className="divide-y divide-ink/5">
          {channels.map((c) => {
            const why = pushProblem(c)
            const missing = unmapped(c)
            return (
              <li key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{c.name || 'Unnamed channel'}</p>
                      <Badge tone={c.on ? (why ? 'bad' : 'good') : 'neutral'} dot={c.on}>
                        {c.on ? (why ? 'Cannot send' : 'On') : 'Off'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {KIND_LABEL[c.kind]} · takes {c.commissionPercent}% · sells{' '}
                      {sellableBy(c).length === 0 ? 'nothing yet' : sellableBy(c).join(', ')}
                      {c.allotment > 0 ? ` · at most ${c.allotment} rooms a night` : ''}
                    </p>
                    {why && <p className="mt-1 text-xs text-bad">{why}</p>}
                    {c.lastPush && !why && <p className="mt-1 text-xs text-ink/50">Last sent {c.lastPush}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-ink/70">
                      <input type="checkbox" checked={c.on} onChange={(e) => change(c.id, { on: e.target.checked })} />
                      On
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                      {openId === c.id ? 'Close' : 'Set up'}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={!c.on} onClick={() => push(c)}>
                      Send rooms and prices
                    </Button>
                    <Button size="sm" disabled={!!why} onClick={() => receive(c)}>
                      Take a booking from here
                    </Button>
                  </div>
                </div>

                {openId === c.id && (
                  <div className="mt-4 space-y-4 rounded-xl bg-canvas/70 p-3">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <Field label="Name">
                        {(id) => <Input id={id} value={c.name} onChange={(e) => change(c.id, { name: e.target.value })} />}
                      </Field>
                      <Field label="Kind">
                        {(id) => (
                          <select
                            id={id}
                            value={c.kind}
                            onChange={(e) => change(c.id, { kind: e.target.value as ChannelKind })}
                            className={box}
                          >
                            {(['ota', 'gds', 'wholesaler'] as ChannelKind[]).map((k) => (
                              <option key={k} value={k}>
                                {KIND_LABEL[k]}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      <Field label="Commission %">
                        {(id) => (
                          <Input
                            id={id}
                            inputMode="numeric"
                            className="tabular-nums"
                            value={String(c.commissionPercent)}
                            onChange={(e) => change(c.id, { commissionPercent: Math.min(100, num(e.target.value)) })}
                          />
                        )}
                      </Field>
                      <Field label="Rooms a night" hint="0 is the whole house">
                        {(id) => (
                          <Input
                            id={id}
                            inputMode="numeric"
                            className="tabular-nums"
                            value={String(c.allotment)}
                            onChange={(e) => change(c.id, { allotment: num(e.target.value) })}
                          />
                        )}
                      </Field>
                    </div>
                    <p className="text-xs text-ink/55">{KIND_NOTE[c.kind]}</p>

                    <div>
                      <p className="text-sm font-medium text-ink/80">What this channel calls each room</p>
                      <p className="mt-0.5 text-xs text-ink/55">
                        Nothing can be sent for a room type until this is filled in. A wrong name here sells the wrong
                        room, which is the most expensive mistake in distribution.
                      </p>
                      <ul className="mt-2 space-y-2">
                        {c.mappings.map((m) => (
                          <li key={m.type} className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr_5rem]">
                            <span className="self-center text-sm font-medium text-ink">{m.type}</span>
                            <Input
                              value={m.theirName}
                              aria-label={`${c.name} ${m.type} name`}
                              placeholder={`What ${c.name || 'the channel'} calls it`}
                              onChange={(e) =>
                                change(c.id, {
                                  mappings: c.mappings.map((x) =>
                                    x.type === m.type ? { ...x, theirName: e.target.value } : x,
                                  ),
                                })
                              }
                            />
                            <Input
                              value={m.theirRate ?? ''}
                              aria-label={`${c.name} ${m.type} rate plan`}
                              placeholder="Their rate plan, if any"
                              onChange={(e) =>
                                change(c.id, {
                                  mappings: c.mappings.map((x) =>
                                    x.type === m.type ? { ...x, theirRate: e.target.value || undefined } : x,
                                  ),
                                })
                              }
                            />
                            <label className="flex items-center gap-1.5 self-center text-xs text-ink/70">
                              <input
                                type="checkbox"
                                checked={m.on}
                                onChange={(e) =>
                                  change(c.id, {
                                    mappings: c.mappings.map((x) =>
                                      x.type === m.type ? { ...x, on: e.target.checked } : x,
                                    ),
                                  })
                                }
                              />
                              Sell
                            </label>
                          </li>
                        ))}
                      </ul>
                      {missing.length > 0 && (
                        <p className="mt-2 text-xs text-bad">
                          {missing.join(' and ')} {missing.length === 1 ? 'has' : 'have'} no name yet.
                        </p>
                      )}
                    </div>

                    <Ari channel={c} />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-xs font-semibold text-bad"
                        onClick={() => {
                          setChannels(channels.filter((x) => x.id !== c.id))
                          setOpenId(null)
                        }}
                      >
                        Remove this channel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
          {channels.length === 0 && (
            <li className="p-4 text-sm text-ink/55">
              This hotel sells only at its own desk and on its own site, which costs no commission at all.
            </li>
          )}
        </ul>
      </Card>

      <GroupDistributionCard />

      <ParityCard channels={channels} />

      <ProductionCard />

      <Card
        title="What was sent"
        icon="list"
        count={pushes.length}
        padded={false}
        description="Every push, including the ones that did not go."
      >
        {pushes.length === 0 ? (
          <p className="p-4 text-sm text-ink/55">Nothing has been sent yet.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {pushes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{p.channelName}</p>
                  <p className="text-xs text-ink/55">
                    {dayMonth(p.from)} to {dayMonth(p.to)} · {p.lines} line{p.lines === 1 ? '' : 's'} · {p.by}, {p.at}
                  </p>
                  {p.reason && <p className="mt-1 text-xs text-bad">{p.reason}</p>}
                </div>
                <Badge tone={PUSH_TONE[p.state]} dot>
                  {p.state === 'sent' ? 'Sent (simulated)' : p.state}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  )
}

/** What would go out for the next fortnight, as the channel would receive it. */
function Ari({ channel }: { channel: Channel }) {
  const { rooms, reservations } = useHotel()
  const { options } = useFeatures()
  const [type, setType] = useState<Room['type'] | ''>('')
  const sold = useMemo(() => soldByNight(rooms, reservations, TODAY, addDays(TODAY, AHEAD)), [rooms, reservations])
  const lines = useMemo(
    () => ariFor(channel, rooms, reservations, options.rates, TODAY, AHEAD, (d) => sold[d]),
    [channel, rooms, reservations, options.rates, sold],
  )
  const types = sellableBy(channel)
  const shown = type ? lines.filter((l) => l.type === type) : lines.filter((l) => l.type === types[0])

  if (types.length === 0) return null

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink/80">What {channel.name || 'this channel'} would be told</p>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={(type || types[0]) === t}
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                (type || types[0]) === t ? 'bg-brand/10 text-brand ring-brand/30' : 'bg-ink/5 text-ink/55 ring-ink/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-ink/55">
        Sold as “{shown[0]?.theirName}”. The count is the hotel's real free rooms, never more, and the price is the
        hotel's own for that night.
      </p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {shown.map((l) => (
          <li key={`${l.date}-${l.type}`} className="flex items-baseline justify-between gap-3">
            <span className="text-ink/70">
              {DAY_SHORT[dayOf(l.date)]} {dayMonth(l.date)}
            </span>
            <span className="flex items-baseline gap-3">
              <span className={`tabular-nums ${l.rooms === 0 ? 'text-bad' : 'text-ink/70'}`}>
                {l.rooms === 0 ? 'closed' : `${l.rooms} room${l.rooms === 1 ? '' : 's'}`}
              </span>
              <span className="w-24 text-right tabular-nums font-medium text-ink/80">{ugx(l.rate)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
