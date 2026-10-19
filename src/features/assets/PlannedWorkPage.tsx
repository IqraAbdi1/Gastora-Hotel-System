import { useMemo, useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Pager, Segmented, Select, StatCard, Textarea } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonthYear } from '../../lib/format'
import { daysBetween, latestReading } from '../../lib/assets'
import type { Asset } from '../../lib/assets'
import { DUE_TONE, dueOf, dueWords, everyWords, newPlanId } from '../../lib/preventive'
import type { PlannedJob, ServicePlan } from '../../lib/preventive'
import { technicians } from '../housekeeping/hkModel'
import PlanForm from './PlanForm'
import { useAssets } from './useAssets'
import { usePreventive } from './usePreventive'

const PAGE = 25
type View = 'jobs' | 'plans'

function emptyPlan(assetId: string): ServicePlan {
  return { id: newPlanId(), assetId, name: '', every: { kind: 'months', n: 3 }, leadDays: 7, active: true }
}

export default function PlannedWorkPage() {
  const { assets } = useAssets()
  const { plans, jobs, savePlan, removePlan, setJob, finishJob } = usePreventive()
  const [view, setView] = useState<View>('jobs')
  const [query, setQuery] = useState('')
  const [done, setDone] = useState(false)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<{ plan: ServicePlan; isNew: boolean } | null>(null)
  const [signing, setSigning] = useState<PlannedJob | null>(null)

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  const jobRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter((j) => (done ? j.status === 'Done' : j.status !== 'Done'))
      .filter((j) => {
        if (!q) return true
        const asset = assetById.get(j.assetId)
        return j.name.toLowerCase().includes(q) || (asset ? `${asset.tag} ${asset.name} ${asset.where}`.toLowerCase().includes(q) : false)
      })
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  }, [jobs, query, done, assetById])

  const shown = jobRows.slice(page * PAGE, page * PAGE + PAGE)

  const counts = useMemo(() => {
    const open = jobs.filter((j) => j.status !== 'Done')
    return {
      open: open.length,
      late: open.filter((j) => daysBetween(TODAY, j.dueOn) < 0).length,
      running: open.filter((j) => j.status === 'In progress').length,
      plans: plans.filter((p) => p.active).length,
    }
  }, [jobs, plans])

  function assetLine(asset: Asset | undefined) {
    if (!asset) return <span className="text-ink/50">Machine no longer on the register</span>
    return (
      <>
        <p className="font-semibold text-ink">{asset.tag}</p>
        <p className="text-xs text-ink/60">
          {asset.name} · {asset.where}
        </p>
      </>
    )
  }

  const jobColumns: Column<PlannedJob>[] = [
    { key: 'asset', header: 'Machine', cell: (j) => assetLine(assetById.get(j.assetId)) },
    {
      key: 'work',
      header: 'Work',
      cell: (j) => (
        <>
          <p className="font-medium text-ink">{j.name}</p>
          {j.note && <p className="max-w-xs text-xs text-ink/60">{j.note}</p>}
        </>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      hideBelow: 'sm',
      cell: (j) => {
        const late = daysBetween(TODAY, j.dueOn)
        return (
          <>
            <span className="text-ink/70">{dayMonthYear(j.dueOn)}</span>
            {j.status !== 'Done' && (
              <p className={`text-xs font-medium ${late < 0 ? 'text-bad' : 'text-ink/55'}`}>
                {late < 0 ? `${Math.abs(late)} day${Math.abs(late) === 1 ? '' : 's'} late` : late === 0 ? 'Today' : `In ${late} days`}
              </p>
            )}
          </>
        )
      },
    },
    {
      key: 'who',
      header: 'Technician',
      hideBelow: 'lg',
      cell: (j) =>
        j.status === 'Done' ? (
          <span className="text-ink/60">{j.technician ?? '—'}</span>
        ) : (
          <Select
            value={j.technician ?? 'Unassigned'}
            onChange={(e) => setJob({ ...j, technician: e.target.value })}
            className="w-auto! py-1.5 text-xs"
            aria-label={`Technician for ${j.name}`}
          >
            {technicians.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (j) => (
        <Badge tone={j.status === 'Done' ? 'good' : j.status === 'In progress' ? 'warn' : 'info'}>{j.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (j) =>
        j.status === 'Done' ? (
          <span className="text-xs text-ink/55">{j.doneOn ? dayMonthYear(j.doneOn) : ''}</span>
        ) : (
          <div className="flex justify-end gap-2">
            {j.status === 'Open' && (
              <Button size="sm" variant="secondary" onClick={() => setJob({ ...j, status: 'In progress' })}>
                Start
              </Button>
            )}
            <Button size="sm" onClick={() => setSigning(j)}>
              Sign off
            </Button>
          </div>
        ),
    },
  ]

  const planColumns: Column<ServicePlan>[] = [
    { key: 'asset', header: 'Machine', cell: (p) => assetLine(assetById.get(p.assetId)) },
    {
      key: 'work',
      header: 'Work',
      cell: (p) => (
        <>
          <p className="font-medium text-ink">{p.name}</p>
          <p className="text-xs text-ink/60">{everyWords(p.every, assetById.get(p.assetId)?.meterUnit)}</p>
        </>
      ),
    },
    {
      key: 'last',
      header: 'Last done',
      hideBelow: 'md',
      cell: (p) => <span className="text-ink/70">{p.lastDoneOn ? dayMonthYear(p.lastDoneOn) : 'Not recorded'}</span>,
    },
    {
      key: 'next',
      header: 'Next due',
      cell: (p) => {
        const asset = assetById.get(p.assetId)
        if (!asset) return <span className="text-ink/50">—</span>
        const due = dueOf(p, asset, TODAY)
        return (
          <>
            <Badge tone={DUE_TONE[due.state]}>{due.state[0].toUpperCase() + due.state.slice(1)}</Badge>
            <p className="mt-1 text-xs text-ink/60">
              {due.on ? `${dayMonthYear(due.on)}${due.estimated ? ' (estimate)' : ''}` : dueWords(due, asset.meterUnit)}
            </p>
            {due.atReading !== undefined && (
              <p className="text-xs text-ink/50">
                At {due.atReading.toLocaleString('en-US')} {asset.meterUnit}
              </p>
            )}
          </>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-2">
          {!p.active && <Badge>Off</Badge>}
          <Button size="sm" variant="secondary" onClick={() => setEditing({ plan: p, isNew: false })}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Maintenance"
        title="Planned work"
        description="Servicing a machine before it fails. A repair is work that chose you; this is work you chose."
        actions={
          <Button onClick={() => setEditing({ plan: emptyPlan(assets[0]?.id ?? ''), isNew: true })} disabled={assets.length === 0}>
            New service plan
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jobs on the list" icon="list" value={String(counts.open)} hint="Raised, not signed off" />
        <StatCard
          label="Late"
          icon="alert"
          value={String(counts.late)}
          hint="Past the day it fell due"
          tone={counts.late > 0 ? 'bad' : 'default'}
        />
        <StatCard label="Being done" icon="clean" value={String(counts.running)} hint="A technician has started" />
        <StatCard label="Plans running" icon="calendar" value={String(counts.plans)} hint="Switched on" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="View"
          value={view}
          onChange={(v) => {
            setView(v)
            setPage(0)
          }}
          options={[
            { key: 'jobs', label: 'Work to do' },
            { key: 'plans', label: 'Schedules' },
          ]}
        />
        {view === 'jobs' && (
          <Segmented
            label="Which jobs"
            value={done ? 'done' : 'open'}
            onChange={(v) => {
              setDone(v === 'done')
              setPage(0)
            }}
            options={[
              { key: 'open', label: 'Outstanding' },
              { key: 'done', label: 'Signed off' },
            ]}
          />
        )}
      </div>

      {view === 'jobs' ? (
        <>
          <FilterBar query={query} onQuery={setQuery} placeholder="Search a machine or a job" />
          <Card title={done ? 'Signed off' : 'Work to do'} icon="tasks" count={jobRows.length} padded={false}>
            <DataTable
              columns={jobColumns}
              rows={shown}
              rowKey={(j) => j.id}
              empty={{
                title: done ? 'Nothing signed off yet' : 'Nothing falls due',
                hint: done
                  ? 'A job appears here once a technician signs it off.'
                  : 'Work appears here on its own when a plan comes round.',
              }}
            />
            <Pager page={page} total={jobRows.length} perPage={PAGE} onPage={setPage} noun="jobs" />
          </Card>
        </>
      ) : (
        <Card
          title="Service plans"
          icon="calendar"
          count={plans.length}
          description="Each plan raises its own job when it comes round. A meter plan's date is worked out from how hard the machine works, so it is an estimate."
          padded={false}
        >
          <DataTable
            columns={planColumns}
            rows={plans}
            rowKey={(p) => p.id}
            empty={{ title: 'No service plans yet', hint: 'Add one for the generator, the lift, anything on a contract.' }}
          />
        </Card>
      )}

      {editing && (
        <PlanForm
          plan={editing.plan}
          assets={assets}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(plan) => {
            savePlan(plan)
            setEditing(null)
          }}
        />
      )}

      {signing && (
        <SignOff
          job={signing}
          asset={assetById.get(signing.assetId)}
          meterPlan={planById.get(signing.planId)?.every.kind === 'meter'}
          onClose={() => setSigning(null)}
          onDone={(doneOn, technician, reading, note) => {
            finishJob(signing, doneOn, technician, reading, note)
            setSigning(null)
          }}
          onDelete={() => {
            removePlan(signing.planId)
            setSigning(null)
          }}
        />
      )}
    </div>
  )
}

/** Signing off moves the plan on from the day the work was actually done, not the day it was due. */
function SignOff({
  job,
  asset,
  meterPlan,
  onClose,
  onDone,
}: {
  job: PlannedJob
  asset?: Asset
  meterPlan?: boolean
  onClose: () => void
  onDone: (doneOn: string, technician: string, reading: number | undefined, note: string) => void
  onDelete: () => void
}) {
  const [doneOn, setDoneOn] = useState(TODAY)
  const [technician, setTechnician] = useState(job.technician ?? technicians[1] ?? 'Unassigned')
  const [reading, setReading] = useState(meterPlan ? String(latestReading(asset ?? ({} as Asset))?.reading ?? '') : '')
  const [note, setNote] = useState('')

  return (
    <Modal
      title="Sign off the service"
      description={`${job.name}${asset ? ` · ${asset.tag}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onDone(doneOn, technician, reading === '' ? undefined : Number(reading), note.trim())}>
            Signed off
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Done on">
            {(id) => <Input id={id} type="date" value={doneOn} onChange={(e) => setDoneOn(e.target.value)} />}
          </Field>
          <Field label="By">
            {(id) => (
              <Select id={id} value={technician} onChange={(e) => setTechnician(e.target.value)}>
                {technicians.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {meterPlan && (
          <Field
            label={`Reading when it was done${asset?.meterUnit ? ` (${asset.meterUnit})` : ''}`}
            hint="The next service is counted from this number, so the interval does not drift."
          >
            {(id) => <Input id={id} type="number" min={0} value={reading} onChange={(e) => setReading(e.target.value)} />}
          </Field>
        )}

        <Field label="What was done">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
              placeholder="Parts changed, anything found."
            />
          )}
        </Field>

        <p className="rounded-lg bg-canvas p-3 text-xs text-ink/60">
          The plan moves on from the day above, not from the day it fell due. A service done a week late does
          not push every future one a week late.
        </p>
      </div>
    </Modal>
  )
}
