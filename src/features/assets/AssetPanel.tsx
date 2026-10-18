import { useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Tabs } from '../../components/ui'
import type { Column, TabItem } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonthYear, ugx } from '../../lib/format'
import {
  DEFAULT_LIFE_YEARS,
  WARRANTY_LABEL,
  ageMonths,
  ageWords,
  bookValue,
  latestReading,
  lifeUsed,
  readingProblem,
  usePerDay,
  warrantyOf,
} from '../../lib/assets'
import type { Asset, MeterReading } from '../../lib/assets'
import { useAuth } from '../auth/authContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import { defectStatusTone } from '../housekeeping/hkModel'
import type { RoomDefect } from '../housekeeping/hkModel'

type Tab = 'about' | 'meter' | 'repairs'

const warrantyTone = { none: 'neutral', 'in warranty': 'good', 'ending soon': 'warn', expired: 'neutral' } as const

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-canvas p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  )
}

/** One machine: what it is, what the dial says, and everything that has gone wrong with it. */
export default function AssetPanel({
  asset,
  showCosts,
  onClose,
  onEdit,
  onReading,
}: {
  asset: Asset
  showCosts: boolean
  onClose: () => void
  onEdit: () => void
  onReading: (reading: MeterReading) => void
}) {
  const hk = useHousekeeping()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('about')
  const [reading, setReading] = useState('')
  const [takenOn, setTakenOn] = useState(TODAY)
  const [touched, setTouched] = useState(false)

  // Every repair that named this machine, wherever it was reported from.
  const repairs = hk.allDefects.filter((d) => d.defect.assetId === asset.id)
  const open = repairs.filter((r) => r.defect.status !== 'Resolved').length

  const warranty = warrantyOf(asset, TODAY)
  const months = ageMonths(asset, TODAY)
  const worth = bookValue(asset, TODAY)
  const used = lifeUsed(asset, TODAY)
  const last = latestReading(asset)
  const perDay = usePerDay(asset)

  const problem = touched ? readingProblem(asset, Number(reading), takenOn) : null

  function addReading() {
    setTouched(true)
    if (reading === '' || readingProblem(asset, Number(reading), takenOn)) return
    onReading({ reading: Number(reading), takenOn, takenBy: user?.staffName || user?.name || 'Staff' })
    setReading('')
    setTouched(false)
  }

  const tabs: TabItem<Tab>[] = [
    { key: 'about', label: 'About' },
    ...(asset.meterUnit ? ([{ key: 'meter', label: 'Readings', count: asset.readings?.length ?? 0 }] as TabItem<Tab>[]) : []),
    { key: 'repairs', label: 'Repairs', count: repairs.length, alert: open > 0 },
  ]

  const repairColumns: Column<{ room: string; defect: RoomDefect }>[] = [
    {
      key: 'what',
      header: 'Fault',
      cell: ({ defect }) => (
        <>
          <p className="font-medium text-ink">{defect.category}</p>
          <p className="max-w-xs text-xs text-ink/60">{defect.description}</p>
        </>
      ),
    },
    { key: 'room', header: 'Room', hideBelow: 'sm', cell: ({ room }) => <span className="text-ink/70">{room}</span> },
    {
      key: 'when',
      header: 'Reported',
      hideBelow: 'sm',
      cell: ({ defect }) => (
        <span className="text-ink/70">{defect.reportedOn ? dayMonthYear(defect.reportedOn) : defect.reportedAt}</span>
      ),
    },
    { key: 'status', header: 'Status', align: 'right', cell: ({ defect }) => <Badge tone={defectStatusTone[defect.status]}>{defect.status}</Badge> },
  ]

  const readingColumns: Column<MeterReading>[] = [
    { key: 'when', header: 'Taken', cell: (r) => dayMonthYear(r.takenOn) },
    { key: 'reading', header: asset.meterUnit === 'kilometres' ? 'Kilometres' : 'Hours', align: 'right', cell: (r) => <span className="tabular-nums">{r.reading.toLocaleString('en-US')}</span> },
    { key: 'by', header: 'By', align: 'right', hideBelow: 'sm', cell: (r) => <span className="text-ink/60">{r.takenBy}</span> },
  ]

  return (
    <Modal
      side
      wide
      title={`${asset.tag} · ${asset.name}`}
      description={`${asset.category} · ${asset.where}`}
      onClose={onClose}
      header={
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={asset.state === 'in service' ? 'good' : 'neutral'} dot>
              {asset.state[0].toUpperCase() + asset.state.slice(1)}
            </Badge>
            <Badge tone={warrantyTone[warranty]}>{WARRANTY_LABEL[warranty]}</Badge>
            {used !== undefined && used > 1 && <Badge tone="warn">Past its expected life</Badge>}
            {open > 0 && <Badge tone="bad">{open} open repair{open === 1 ? '' : 's'}</Badge>}
          </div>
          <Tabs tabs={tabs} value={tab} onChange={setTab} label="Asset" />
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit}>Edit</Button>
        </>
      }
    >
      {tab === 'about' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Line label="Make and model" value={[asset.make, asset.model].filter(Boolean).join(' ') || '—'} />
            <Line label="Serial number" value={asset.serial || '—'} />
            <Line label="Bought" value={asset.boughtOn ? dayMonthYear(asset.boughtOn) : 'Not recorded'} />
            <Line label="Age" value={ageWords(months)} />
            <Line label="Warranty" value={asset.warrantyUntil ? dayMonthYear(asset.warrantyUntil) : 'Not recorded'} />
            <Line label="Supplier" value={asset.supplier || '—'} />
          </div>

          {showCosts && (
            <Card title="What it is worth" icon="money" description="Rule: the cost spread evenly over the years the hotel expects to use it.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Line label="Cost" value={asset.cost === undefined ? 'Not recorded' : ugx(asset.cost)} />
                <Line label="Worth now" value={worth === undefined ? 'Cannot say' : ugx(worth)} />
                <Line label="Years expected" value={`${asset.lifeYears ?? DEFAULT_LIFE_YEARS} years`} />
              </div>
              {used !== undefined && (
                <p className="mt-3 text-sm text-ink/70">
                  {used >= 1
                    ? 'It has passed the years it was bought for. Anything spent on it from here is spent on borrowed time.'
                    : `About ${Math.round(used * 100)}% of its expected life has gone.`}
                </p>
              )}
              {worth === undefined && (
                <p className="mt-3 text-sm text-ink/60">
                  A value needs both what it cost and the day it was bought. Add them and this fills in.
                </p>
              )}
            </Card>
          )}

          {asset.notes && (
            <Card title="Notes" icon="list">
              <p className="text-sm text-ink/70">{asset.notes}</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'meter' && asset.meterUnit && (
        <div className="space-y-4">
          <Card title="Take a reading" icon="clean" description={`The number on the dial, in ${asset.meterUnit}.`}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Reading" error={problem ?? undefined}>
                {(id) => (
                  <Input id={id} type="number" min={0} value={reading} onChange={(e) => setReading(e.target.value)} placeholder={last ? String(last.reading) : '0'} />
                )}
              </Field>
              <Field label="Taken on">
                {(id) => <Input id={id} type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />}
              </Field>
              <Button onClick={addReading} disabled={reading === ''}>
                Record it
              </Button>
            </div>
            {perDay !== undefined && (
              <p className="mt-3 text-sm text-ink/70">
                <Badge tone="brand">Rule</Badge>{' '}
                <span className="ml-1">
                  About {perDay.toFixed(1)} {asset.meterUnit} a day, from the readings on record.
                </span>
              </p>
            )}
          </Card>

          <Card title="Readings" icon="list" count={asset.readings?.length ?? 0} padded={false}>
            <DataTable
              columns={readingColumns}
              rows={[...(asset.readings ?? [])].sort((a, b) => b.takenOn.localeCompare(a.takenOn))}
              rowKey={(r) => `${r.takenOn}-${r.reading}`}
              empty={{ title: 'No readings yet', hint: 'Record what the dial says and the hotel can see how hard it works.' }}
            />
          </Card>
        </div>
      )}

      {tab === 'repairs' && (
        <Card title="Everything that has gone wrong" icon="alert" count={repairs.length} padded={false}>
          {repairs.length === 0 ? (
            <EmptyState
              title="Nothing reported against it"
              hint="A fault lands here when whoever reports it names this machine."
            />
          ) : (
            <DataTable
              columns={repairColumns}
              rows={repairs}
              rowKey={({ room, defect }) => `${room}-${defect.id}`}
            />
          )}
        </Card>
      )}
    </Modal>
  )
}
