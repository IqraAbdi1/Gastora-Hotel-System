import { useMemo, useState } from 'react'
import StatusPill from '../../components/StatusPill'
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { BILLING_LABEL, commissionOf, newAgentId, statements } from '../../lib/agents'
import type { AgentStatement, TravelAgent } from '../../lib/agents'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { Reservation } from '../../types'
import { useFeatures } from '../platform/featuresContext'
import ReservationPanel from './ReservationPanel'

const blank: TravelAgent = { id: '', name: '', contact: '', phone: '', email: '', commissionPercent: 10, collectsPayment: false, active: true }

/** Add or change one agent. A new rate applies to bookings made from now on; booked stays keep theirs. */
function AgentDialog({ agent, onSave, onClose }: { agent: TravelAgent; onSave: (a: TravelAgent) => void; onClose: () => void }) {
  const [a, setA] = useState(agent)
  const ok = a.name.trim().length >= 2 && a.commissionPercent >= 0 && a.commissionPercent <= 50
  const set = (patch: Partial<TravelAgent>) => setA((x) => ({ ...x, ...patch }))
  return (
    <Modal
      title={agent.id ? `Change ${agent.name}` : 'Add a travel agent'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ok} onClick={() => onSave({ ...a, name: a.name.trim() })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Agency name" required>
          {(id) => <Input id={id} value={a.name} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label="Contact person">{(id) => <Input id={id} value={a.contact} onChange={(e) => set({ contact: e.target.value })} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={a.phone} onChange={(e) => set({ phone: e.target.value })} />}</Field>
        <Field label="Email">{(id) => <Input id={id} value={a.email ?? ''} onChange={(e) => set({ email: e.target.value })} />}</Field>
        <Field label="Commission (%)" hint="On the room money only, never on extras or tax.">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={50}
              value={a.commissionPercent}
              onChange={(e) => set({ commissionPercent: Math.max(0, Number(e.target.value) || 0) })}
            />
          )}
        </Field>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={a.collectsPayment} onChange={(e) => set({ collectsPayment: e.target.checked })} className="mt-1" />
          <span>
            <b>The agent collects payment from the guest</b>
            <span className="block text-xs text-ink/60">
              {a.collectsPayment ? BILLING_LABEL.net : BILLING_LABEL.commission}. Past bookings are not changed.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={a.active} onChange={(e) => set({ active: e.target.checked })} />
          Offered on new bookings
        </label>
      </div>
    </Modal>
  )
}

/**
 * The agents the hotel deals with, and what it owes each of them. Commission is earned on the room
 * money of completed stays only, exactly as points are; cancelled bookings and no-shows earn none.
 */
export default function TravelAgentsPage() {
  const { reservations } = useHotel()
  const { options, setOptions } = useFeatures()
  const [editing, setEditing] = useState<TravelAgent | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const rows = useMemo(() => statements(options.agents, reservations), [options.agents, reservations])
  const booked = useMemo(
    () => reservations.filter((r) => r.agent).sort((a, b) => b.arrival.localeCompare(a.arrival)),
    [reservations],
  )
  const owedTo = rows.reduce((n, s) => n + s.owedToAgent, 0)
  const owedBy = rows.reduce((n, s) => n + s.owedByAgent, 0)
  const expected = rows.reduce((n, s) => n + s.expected, 0)
  const completed = rows.reduce((n, s) => n + s.completed, 0)
  const opened = reservations.find((r) => r.id === openId) ?? null

  function save(a: TravelAgent) {
    const list = options.agents
    setOptions({
      agents: a.id ? list.map((x) => (x.id === a.id ? a : x)) : [...list, { ...a, id: newAgentId(list) }],
    })
    setEditing(null)
  }

  const columns: Column<AgentStatement>[] = [
    {
      key: 'agent',
      header: 'Agent',
      cell: ({ agent }) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
            {agent.name}
            {!agent.active && <Badge>Not offered</Badge>}
          </p>
          <p className="text-xs text-ink/55">{[agent.contact, agent.phone].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
    {
      key: 'terms',
      header: 'Terms',
      hideBelow: 'md',
      cell: ({ agent }) => (
        <div>
          <p>{agent.commissionPercent}%</p>
          <p className="text-xs text-ink/55">{agent.collectsPayment ? 'Net: agent collects' : 'Commission: hotel pays'}</p>
        </div>
      ),
    },
    {
      key: 'stays',
      header: 'Completed',
      hideBelow: 'lg',
      cell: (s) => (
        <div>
          <p>
            {s.completed} stay{s.completed === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-ink/55">{ugx(s.roomMoney)} room money</p>
        </div>
      ),
    },
    {
      key: 'earned',
      header: 'Commission earned',
      align: 'right',
      cell: (s) => (
        <div className="tabular-nums">
          <p className="font-semibold">{ugx(s.earned)}</p>
          <p className="text-xs text-ink/55">
            {s.expected > 0 ? `${ugx(s.expected)} to come` : 'Nothing to come'}
            {s.lost > 0 ? ` · ${s.lost} lost` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (s) =>
        s.owedToAgent > 0 ? (
          <Badge tone="warn">Hotel owes {ugx(s.owedToAgent)}</Badge>
        ) : s.owedByAgent > 0 ? (
          <Badge tone="brand">Agent owes {ugx(s.owedByAgent)}</Badge>
        ) : (
          <Badge tone="neutral">Nothing due</Badge>
        ),
    },
    {
      key: 'act',
      header: <span className="sr-only">Change</span>,
      align: 'right',
      cell: ({ agent }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(agent)
          }}
        >
          Change
        </Button>
      ),
    },
  ]

  const bookingColumns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{r.guest}</p>
          <p className="text-xs text-ink/55">
            {r.id} · {r.agent?.name}
          </p>
        </div>
      ),
    },
    { key: 'stay', header: 'Stay', hideBelow: 'md', cell: (r) => `${dayMonth(r.arrival)} to ${dayMonth(r.departure)}` },
    { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      cell: (r) => {
        const c = commissionOf(r)
        return (
          <div className="tabular-nums">
            <p className={c.state === 'earned' ? 'font-semibold' : 'text-ink/60'}>{c.state === 'none' ? 'None' : ugx(c.amount)}</p>
            <p className="text-xs text-ink/55">
              {c.state === 'earned' ? 'Earned' : c.state === 'expected' ? 'When the stay completes' : 'Cancelled or no-show'}
            </p>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Travel agents"
        description="Agents and what is owed. Commission on room only, after the stay."
        actions={<Button onClick={() => setEditing(blank)}>Add an agent</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hotel owes agents" icon="money" value={ugx(owedTo)} hint="Commission on completed stays" tone={owedTo > 0 ? 'warn' : 'default'} />
        <StatCard label="Agents owe the hotel" icon="money" value={ugx(owedBy)} hint="Net, where the agent collected" />
        <StatCard label="Commission to come" icon="calendar" value={ugx(expected)} hint="If booked stays complete" />
        <StatCard label="Completed agent stays" icon="check" value={completed} hint={`${booked.length} agent bookings in all`} />
      </div>

      <Card title="Agents" icon="guests" count={rows.length} description="Totals are for completed stays. Click Change to edit an agent." padded={false}>
        <DataTable columns={columns} rows={rows} rowKey={(s) => s.agent.id} empty={{ title: 'No agents yet', hint: 'Add the agents your hotel deals with.' }} />
      </Card>

      <Card title="Agent bookings" icon="list" count={booked.length} description="Every booking made through an agent. Click one to open it." padded={false}>
        <DataTable
          columns={bookingColumns}
          rows={booked}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          empty={{ title: 'No agent bookings yet', hint: 'Choose "Travel agent" under Booked via on a new reservation.' }}
        />
      </Card>
      <p className="text-xs text-ink/55">Figures only. Nothing is paid from here.</p>

      {editing && <AgentDialog agent={editing} onSave={save} onClose={() => setEditing(null)} />}
      {opened && <ReservationPanel reservation={opened} onClose={() => setOpenId(null)} />}
    </div>
  )
}
