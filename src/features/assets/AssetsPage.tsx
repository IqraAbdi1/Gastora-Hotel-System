import { useMemo, useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, DataTable, Field, PageHeader, Pager, Select, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import {
  ASSET_CATEGORIES,
  WARRANTY_LABEL,
  ageMonths,
  ageWords,
  bookValue,
  emptyAsset,
  lifeUsed,
  searchAssets,
  sortAssets,
  warrantyOf,
} from '../../lib/assets'
import type { Asset } from '../../lib/assets'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import AssetForm from './AssetForm'
import AssetPanel from './AssetPanel'
import { useAssets } from './useAssets'

const PAGE = 25
const ALL_KINDS = 'Every kind'
const warrantyTone = { none: 'neutral', 'in warranty': 'good', 'ending soon': 'warn', expired: 'neutral' } as const

export default function AssetsPage() {
  const { assets, save, addReading } = useAssets()
  const { features } = useFeatures()
  const hk = useHousekeeping()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(ALL_KINDS)
  const [only, setOnly] = useState<'all' | 'in service' | 'warranty' | 'old' | 'faulty'>('all')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const showCosts = features.assetCosts

  // Machines with a repair still open against them. Counted from the work orders, not kept on the asset,
  // so it can never say "in repair" after the repair was closed.
  const faulty = useMemo(() => {
    const ids = new Set<string>()
    for (const { defect } of hk.allDefects) {
      if (defect.assetId && defect.status !== 'Resolved') ids.add(defect.assetId)
    }
    return ids
  }, [hk.allDefects])

  const rows = useMemo(() => {
    let list = sortAssets(searchAssets(assets, query))
    if (kind !== ALL_KINDS) list = list.filter((a) => a.category === kind)
    if (only === 'in service') list = list.filter((a) => a.state === 'in service')
    if (only === 'warranty') list = list.filter((a) => warrantyOf(a, TODAY) === 'in warranty' || warrantyOf(a, TODAY) === 'ending soon')
    if (only === 'old') list = list.filter((a) => (lifeUsed(a, TODAY) ?? 0) > 1 && a.state === 'in service')
    if (only === 'faulty') list = list.filter((a) => faulty.has(a.id))
    return list
  }, [assets, query, kind, only, faulty])

  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)

  const counts = useMemo(() => {
    const live = assets.filter((a) => a.state === 'in service')
    return {
      live: live.length,
      warranty: live.filter((a) => warrantyOf(a, TODAY) === 'in warranty' || warrantyOf(a, TODAY) === 'ending soon').length,
      old: live.filter((a) => (lifeUsed(a, TODAY) ?? 0) > 1).length,
      faulty: live.filter((a) => faulty.has(a.id)).length,
      cost: live.reduce((sum, a) => sum + (a.cost ?? 0), 0),
      worth: live.reduce((sum, a) => sum + (bookValue(a, TODAY) ?? 0), 0),
    }
  }, [assets, faulty])

  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(0)
  }

  const columns: Column<Asset>[] = [
    {
      key: 'tag',
      header: 'Number',
      cell: (a) => (
        <>
          <span className="font-semibold text-ink">{a.tag}</span>
          {a.state !== 'in service' && (
            <p className="text-xs text-ink/55">{a.state[0].toUpperCase() + a.state.slice(1)}</p>
          )}
        </>
      ),
    },
    {
      key: 'name',
      header: 'What it is',
      cell: (a) => (
        <>
          <p className="font-medium text-ink">{a.name}</p>
          <p className="text-xs text-ink/60">{[a.make, a.model].filter(Boolean).join(' ') || a.category}</p>
        </>
      ),
    },
    { key: 'where', header: 'Where', cell: (a) => <span className="text-ink/70">{a.where}</span> },
    {
      key: 'age',
      header: 'Age',
      hideBelow: 'md',
      cell: (a) => {
        const used = lifeUsed(a, TODAY)
        return (
          <>
            <span className="text-ink/70">{ageWords(ageMonths(a, TODAY))}</span>
            {used !== undefined && used > 1 && a.state === 'in service' && (
              <p className="text-xs font-medium text-warn">Past its years</p>
            )}
          </>
        )
      },
    },
    {
      key: 'warranty',
      header: 'Warranty',
      hideBelow: 'lg',
      cell: (a) => {
        const w = warrantyOf(a, TODAY)
        return <Badge tone={warrantyTone[w]}>{WARRANTY_LABEL[w]}</Badge>
      },
    },
    ...(showCosts
      ? ([
          {
            key: 'worth',
            header: 'Worth now',
            align: 'right',
            hideBelow: 'xl',
            cell: (a: Asset) => {
              const worth = bookValue(a, TODAY)
              return <span className="tabular-nums text-ink/70">{worth === undefined ? '—' : ugx(worth)}</span>
            },
          },
        ] as Column<Asset>[])
      : []),
    {
      key: 'state',
      header: '',
      align: 'right',
      cell: (a) => (faulty.has(a.id) ? <Badge tone="bad">Being repaired</Badge> : null),
    },
  ]

  const activeFilters = [kind !== ALL_KINDS, only !== 'all'].filter(Boolean).length
  const current = open ? assets.find((a) => a.id === open) : null

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Maintenance"
        title="Asset register"
        description="Everything the hotel owns that can break: where it is, what it cost, and what has gone wrong with it."
        actions={<Button onClick={() => setEditing(emptyAsset())}>Add equipment</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="In service"
          icon="check"
          value={String(counts.live)}
          hint="Working equipment"
          active={only === 'in service'}
          onClick={() => set(setOnly)(only === 'in service' ? 'all' : 'in service')}
        />
        <StatCard
          label="Under warranty"
          icon="sparkles"
          value={String(counts.warranty)}
          hint="A repair should be claimed"
          tone={counts.warranty > 0 ? 'good' : 'default'}
          active={only === 'warranty'}
          onClick={() => set(setOnly)(only === 'warranty' ? 'all' : 'warranty')}
        />
        <StatCard
          label="Past its years"
          icon="alert"
          value={String(counts.old)}
          hint="Working on borrowed time"
          tone={counts.old > 0 ? 'warn' : 'default'}
          active={only === 'old'}
          onClick={() => set(setOnly)(only === 'old' ? 'all' : 'old')}
        />
        {showCosts ? (
          <StatCard label="Worth now" icon="money" value={ugx(counts.worth)} hint={`Cost ${ugx(counts.cost)}`} />
        ) : (
          <StatCard
            label="Being repaired"
            icon="alert"
            value={String(counts.faulty)}
            hint="A repair is open"
            tone={counts.faulty > 0 ? 'bad' : 'default'}
            active={only === 'faulty'}
            onClick={() => set(setOnly)(only === 'faulty' ? 'all' : 'faulty')}
          />
        )}
      </div>

      <FilterBar
        query={query}
        onQuery={set(setQuery)}
        placeholder="Search a number, a machine, a make or a place"
        active={activeFilters}
      >
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => set(setKind)(e.target.value)}>
              <option>{ALL_KINDS}</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Show">
          {(id) => (
            <Select id={id} value={only} onChange={(e) => set(setOnly)(e.target.value as typeof only)}>
              <option value="all">Everything on record</option>
              <option value="in service">In service</option>
              <option value="warranty">Still under warranty</option>
              <option value="old">Past its expected years</option>
              <option value="faulty">Waiting for a repair</option>
            </Select>
          )}
        </Field>
      </FilterBar>

      <Card title="Equipment" icon="list" count={rows.length} padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(a) => a.id}
          onRowClick={(a) => setOpen(a.id)}
          empty={{
            title: query || activeFilters ? 'Nothing matches' : 'Nothing on the register yet',
            hint:
              query || activeFilters
                ? 'Try a different search, or clear the filters.'
                : 'Add the generator, the lift, the boiler — whatever the hotel would miss if it stopped.',
          }}
        />
        <Pager page={page} total={rows.length} perPage={PAGE} onPage={setPage} noun="assets" />
      </Card>

      {current && (
        <AssetPanel
          asset={current}
          showCosts={showCosts}
          onClose={() => setOpen(null)}
          onEdit={() => {
            setEditing(current)
            setOpen(null)
          }}
          onReading={(reading) => addReading(current.id, reading)}
        />
      )}

      {editing && (
        <AssetForm
          asset={editing}
          all={assets}
          showCosts={showCosts}
          onClose={() => setEditing(null)}
          onSave={(asset) => {
            save(asset)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
