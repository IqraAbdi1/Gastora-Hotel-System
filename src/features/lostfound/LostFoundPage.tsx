import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Chip, Field, Input, PageHeader, Select, StatCard } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { LOST_CATEGORIES, daysHeld, isValuable, searchItems, staysForItem } from '../../lib/lostFound'
import type { LostItem } from '../../lib/lostFound'
import LogItemDialog from './LogItemDialog'
import ReleaseItemPanel from './ReleaseItemPanel'
import { useLostFound } from './lostFoundContext'
import { useFeatures } from '../platform/featuresContext'

type View = 'held' | 'overdue' | 'returned' | 'disposed' | 'all'

const allChips: { key: View; label: string; dot?: string; simple: boolean }[] = [
  { key: 'held', label: 'Still held', dot: 'bg-brand', simple: true },
  { key: 'overdue', label: 'Held too long', dot: 'bg-bad', simple: false },
  { key: 'returned', label: 'Given back', dot: 'bg-good', simple: true },
  { key: 'disposed', label: 'Disposed of', simple: false },
  { key: 'all', label: 'All', simple: true },
]

function ItemCard({
  item,
  keepDays,
  simple,
  onOpen,
  onDispose,
}: {
  item: LostItem
  keepDays: number
  simple: boolean
  onOpen: () => void
  onDispose: () => void
}) {
  const { reservations } = useHotel()
  const stays = staysForItem(item, reservations)
  const held = daysHeld(item, TODAY)
  const overdue = item.status === 'held' && held > keepDays

  return (
    <div className="flex gap-3 rounded-xl border border-ink/10 bg-surface p-3">
      {item.photo ? (
        <img src={item.photo} alt={item.description} className="h-20 w-24 shrink-0 rounded-lg border border-ink/10 object-cover" />
      ) : (
        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink/20 text-xs text-ink/40">
          No photo
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold text-ink">{item.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {!simple && isValuable(item.category) && <Badge tone="warn">Valuable</Badge>}
            {item.status === 'held' && <Badge tone={overdue ? 'bad' : 'brand'}>{overdue ? `Held ${held} days` : 'Held'}</Badge>}
            {item.status === 'returned' && <Badge tone="good">Given back</Badge>}
            {item.status === 'disposed' && <Badge>Disposed of</Badge>}
          </div>
        </div>
        <p className="text-xs text-ink/60">
          {item.id} · {item.category} · found in <strong className="font-semibold text-ink/75">{item.foundIn}</strong>,{' '}
          {item.foundWhere}
        </p>
        <p className="text-xs text-ink/55">
          {dayMonth(item.foundOn)} by {item.foundBy} · kept in {item.storedAt}
        </p>
        {item.status === 'held' && stays.length > 0 && (
          <p className="mt-1 text-xs text-ink/70">
            In the room then: {stays.map((s) => s.guest).join(', ')}
          </p>
        )}
        {item.release && (
          <p className="mt-1 text-xs text-good">
            Given to {item.release.name} ({item.release.idType} {item.release.idNumber}) on {item.release.at}
            {item.release.onBehalfOf ? ` for ${item.release.onBehalfOf}` : ''} by {item.release.releasedBy}
            {item.release.approvedBy ? `, approved by ${item.release.approvedBy}` : ''}
          </p>
        )}
        {item.disposal && (
          <p className="mt-1 text-xs text-ink/60">
            Disposed of {item.disposal.at} by {item.disposal.by}: {item.disposal.reason}
          </p>
        )}
        {item.status === 'held' && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onOpen}>
              A guest is asking for this
            </Button>
            {!simple && (
              <Button size="sm" variant="ghost" onClick={onDispose}>
                Dispose of it
              </Button>
            )}
            {overdue && (
              <span className="text-xs font-semibold text-bad">
                Past the {keepDays}-day limit. It may be disposed of.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Lost and found. Housekeeping logs what they pick up; the front desk searches it when a guest asks,
// checks who was in that room, and records who collected it.
export default function LostFoundPage() {
  const { items } = useLostFound()
  const { options, tenant } = useFeatures()
  // A Starter hotel gets the plain version: log it, find it, give it back.
  const simple = tenant.plan === 'starter'
  const keepDays = options.keepFoundDays
  const chips = allChips.filter((c) => !simple || c.simple)
  const [params, setParams] = useSearchParams()
  const [logging, setLogging] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [disposeId, setDisposeId] = useState<string | null>(null)

  const view = (params.get('view') ?? 'held') as View
  const [room, setRoom] = useState('')
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')

  function setParam(key: string, value: string, fallback = '') {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const counts = useMemo(
    () => ({
      held: items.filter((i) => i.status === 'held').length,
      overdue: items.filter((i) => i.status === 'held' && daysHeld(i, TODAY) > keepDays).length,
      returned: items.filter((i) => i.status === 'returned').length,
      disposed: items.filter((i) => i.status === 'disposed').length,
      all: items.length,
      valuables: items.filter((i) => i.status === 'held' && isValuable(i.category)).length,
    }),
    [items, keepDays],
  )

  const list = useMemo(() => {
    let out = searchItems(items, { room, text, from: from || undefined })
    if (view === 'overdue') out = out.filter((i) => i.status === 'held' && daysHeld(i, TODAY) > keepDays)
    else if (view !== 'all') out = out.filter((i) => i.status === view)
    if (category) out = out.filter((i) => i.category === category)
    return out.sort((a, b) => b.foundOn.localeCompare(a.foundOn))
  }, [items, room, text, from, view, category, keepDays])

  const open = openId ? items.find((i) => i.id === openId) : undefined
  const disposing = disposeId ? items.find((i) => i.id === disposeId) : undefined

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Lost and found"
        description="Items guests leave behind."
        actions={<Button onClick={() => setLogging(true)}>Log a found item</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Still held" icon="list" value={counts.held} hint="Waiting for the owner" active={view === 'held'} onClick={() => setParam('view', 'held', 'held')} />
        {simple ? (
          <StatCard label="Given back" icon="check" value={counts.returned} hint="With proof of collection" active={view === 'returned'} onClick={() => setParam('view', 'returned', 'held')} />
        ) : (
          <StatCard
            label="Held too long"
            icon="alert"
            value={counts.overdue}
            hint={`Over ${keepDays} days`}
            tone={counts.overdue > 0 ? 'bad' : 'default'}
            active={view === 'overdue'}
            onClick={() => setParam('view', 'overdue', 'held')}
          />
        )}
        {!simple && (
          <StatCard label="In the safe" icon="list" value={counts.valuables} hint="Valuables, a manager approves" tone={counts.valuables > 0 ? 'warn' : 'default'} />
        )}
        <StatCard label="All items" icon="tasks" value={counts.all} hint="Including disposed of" active={view === 'all'} onClick={() => setParam('view', 'all', 'held')} />
      </div>

      <Card
        title="A guest is asking for something"
        icon="sparkles"
        padded
        description="Ask for the room, the item and roughly when."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Room they stayed in" hint="Or where they lost it, such as Restaurant.">
            {(id) => <Input id={id} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="203" />}
          </Field>
          <Field label="What is it" hint="Any word they use: charger, watch, blue.">
            {(id) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="watch" />}
          </Field>
          <Field label="Kind of item">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Any</option>
                {LOST_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Lost on or after">
            {(id) => <Input id={id} type="date" value={from} max={TODAY} onChange={(e) => setFrom(e.target.value)} />}
          </Field>
        </div>
        {(room || text || category || from) && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRoom('')
                setText('')
                setCategory('')
                setFrom('')
              }}
            >
              Clear the search
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-ink/55">
          Let the guest describe it first. Never read out the list.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.key} active={view === c.key} dot={c.dot} count={counts[c.key]} onClick={() => setParam('view', c.key, 'held')}>
            {c.label}
          </Chip>
        ))}
      </div>

      <Card title={chips.find((c) => c.key === view)?.label ?? 'Items'} icon="list" count={list.length} padded>
        {list.length === 0 ? (
          <p className="text-sm text-ink/55">
            Nothing matches. Try fewer words.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((i) => (
              <ItemCard
                key={i.id}
                item={i}
                keepDays={keepDays}
                simple={simple}
                onOpen={() => setOpenId(i.id)}
                onDispose={() => setDisposeId(i.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {logging && <LogItemDialog onClose={() => setLogging(false)} />}
      {open && <ReleaseItemPanel item={open} onClose={() => setOpenId(null)} />}
      {disposing && <ReleaseItemPanel item={disposing} startOn="dispose" onClose={() => setDisposeId(null)} />}
    </div>
  )
}
