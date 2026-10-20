import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, PageHeader, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import Switch from '../../components/Switch'
import { reportsService } from '../../services'
import { DATASET_DATE, DATASET_LABEL, PERIOD_LABEL } from '../../services/reports/reportCatalog'
import { runReport, toCsv } from '../../services/reports/datasets'
import type { ReportResult } from '../../services/reports/datasets'
import type { DatasetKey, NewReportDefinition, ReportDefinition, ReportExport, ReportSchedule } from '../../services/reports/reportsTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import ReportBuilder from './ReportBuilder'
import ReportViewer from './ReportViewer'
import { downloadFile, frequencyWords, slug, useActor } from './reportsUtils'
import ScheduleDialog from './ScheduleDialog'
import { useReportFacts } from './useReportFacts'
import { useReports } from './useReports'

type View = 'reports' | 'schedules' | 'exports'

const BLANK: NewReportDefinition = { name: '', description: '', dataset: 'reservations', columns: ['id', 'guest', 'status', 'arrival', 'total'], filters: [], groupBy: null, period: '30' }

export default function LibraryPage() {
  const { tenant, features } = useFeatures()
  const { canOpen, user } = useAuth()
  const actor = useActor()
  const facts = useReportFacts()
  const { definitions, schedules, exports, error: loadError } = useReports()
  const [view, setView] = useState<View>('reports')
  const [running, setRunning] = useState<ReportDefinition | null>(null)
  const [building, setBuilding] = useState<{ initial: NewReportDefinition; id?: string; title: string } | null>(null)
  const [scheduling, setScheduling] = useState<{ reportId?: string } | null>(null)
  const [deleting, setDeleting] = useState<ReportDefinition | null>(null)
  const [dropping, setDropping] = useState<ReportSchedule | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  const datasets: DatasetKey[] = (['reservations', 'charges', 'payments', 'posSales', 'stock', 'workOrders', 'debtors', 'dailyKpis'] as DatasetKey[]).filter(
    (d) => d !== 'stock' || features.stockControl,
  )
  const reports = definitions.filter((d) => datasets.includes(d.dataset))
  const canSchedule = features.scheduledReports
  const thisMonth = exports.filter((e) => e.createdAt.slice(0, 7) === facts.today.slice(0, 7)).length

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      setMessage({ tone: 'good', text: done })
    } catch (e) {
      setMessage({ tone: 'bad', text: e instanceof Error ? e.message : 'Something went wrong' })
    }
  }

  async function exportReport(result: ReportResult, def: ReportDefinition, format: 'csv' | 'pdf') {
    await reportsService.recordExport(tenant.id, { reportId: def.id, reportName: def.name, format, rowCount: result.rows.length, trigger: 'download', recipients: [] }, actor)
    if (format === 'csv') downloadFile(`${slug(def.name)}-${facts.today}.csv`, toCsv(result))
  }

  async function saveReport(input: NewReportDefinition) {
    const saved = await reportsService.saveDefinition(tenant.id, input, actor, building?.id)
    setBuilding(null)
    setRunning(saved)
    setMessage({ tone: 'good', text: `Saved "${saved.name}".` })
  }

  const reportCols: Column<ReportDefinition>[] = [
    {
      key: 'name',
      header: 'Report',
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{r.name}</p>
          <p className="truncate text-xs text-ink/55">{r.description || DATASET_LABEL[r.dataset]}</p>
        </div>
      ),
      className: 'whitespace-normal',
    },
    { key: 'list', header: 'Lists', cell: (r) => <span className="text-ink/70">{DATASET_LABEL[r.dataset]}</span>, hideBelow: 'md' },
    { key: 'period', header: 'Period', cell: (r) => <span className="text-ink/70">{DATASET_DATE[r.dataset] ? PERIOD_LABEL[r.period] : 'Now'}</span>, hideBelow: 'lg' },
    { key: 'kind', header: 'Kind', cell: (r) => (r.builtIn ? <Badge tone="neutral">Built-in</Badge> : <Badge tone="brand">Saved</Badge>), hideBelow: 'sm' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => setRunning(r)}>
            Run
          </Button>
          {!r.builtIn && (
            <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ]

  const scheduleCols: Column<ReportSchedule>[] = [
    {
      key: 'report',
      header: 'Report',
      cell: (s) => (
        <div>
          <p className="font-medium text-ink">{s.reportName}</p>
          <p className="text-xs text-ink/55">{frequencyWords(s)}</p>
        </div>
      ),
    },
    { key: 'to', header: 'Send to', cell: (s) => <span className="text-ink/70">{s.recipients.join(', ')}</span>, hideBelow: 'md', className: 'whitespace-normal' },
    { key: 'format', header: 'Format', cell: (s) => <Badge tone="neutral">{s.format === 'pdf' ? 'PDF' : 'CSV'}</Badge>, hideBelow: 'sm' },
    { key: 'next', header: 'Next', cell: (s) => <span className="tabular-nums text-ink/70">{s.active ? s.nextRunAt : 'Paused'}</span>, hideBelow: 'lg' },
    { key: 'last', header: 'Last sent', cell: (s) => <span className="tabular-nums text-ink/70">{s.lastRunAt ?? '—'}</span>, hideBelow: 'xl' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex items-center justify-end gap-2">
          <Switch on={s.active} label={s.active ? 'Pause' : 'Resume'} onChange={(on) => act(() => reportsService.setScheduleActive(s.id, on, actor), on ? 'Schedule resumed.' : 'Schedule paused.')} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const def = definitions.find((d) => d.id === s.reportId)
              const rows = def ? runReport(def, facts).rows.length : 0
              void act(() => reportsService.runScheduleNow(s.id, rows, actor), `Sent "${s.reportName}" to ${s.recipients.length} recipient${s.recipients.length === 1 ? '' : 's'}.`)
            }}
          >
            Send now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDropping(s)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const exportCols: Column<ReportExport>[] = [
    { key: 'at', header: 'When', cell: (e) => <span className="tabular-nums text-ink/70">{e.createdAt}</span> },
    { key: 'name', header: 'Report', cell: (e) => <span className="font-medium text-ink">{e.reportName}</span>, className: 'whitespace-normal' },
    { key: 'format', header: 'Format', cell: (e) => <Badge tone="neutral">{e.format === 'pdf' ? 'PDF' : 'CSV'}</Badge> },
    { key: 'rows', header: 'Rows', align: 'right', cell: (e) => <span className="tabular-nums">{e.rowCount}</span>, hideBelow: 'sm' },
    { key: 'how', header: 'How', cell: (e) => <span className="text-ink/70">{e.trigger === 'schedule' ? `Emailed to ${e.recipients.join(', ')}` : 'Downloaded'}</span>, hideBelow: 'md', className: 'whitespace-normal' },
    { key: 'by', header: 'By', cell: (e) => <span className="text-ink/70">{e.createdBy}</span>, hideBelow: 'lg' },
  ]

  const tabs = [
    { key: 'reports' as View, label: 'Reports', count: reports.length },
    ...(canSchedule ? [{ key: 'schedules' as View, label: 'Schedules', count: schedules.length }] : []),
    { key: 'exports' as View, label: 'Exports', count: exports.length },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Report library"
        description="Run a report, export it to Excel or PDF, or build your own."
        actions={
          <>
            {canSchedule && (
              <Button variant="ghost" onClick={() => setScheduling({})}>
                New schedule
              </Button>
            )}
            <Button onClick={() => setBuilding({ initial: BLANK, title: 'New report' })}>New report</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Built-in reports" value={reports.filter((r) => r.builtIn).length} icon="list" onClick={() => setView('reports')} />
        <StatCard label="Saved by the hotel" value={reports.filter((r) => !r.builtIn).length} icon="check" onClick={() => setView('reports')} />
        {canSchedule && <StatCard label="Active schedules" value={schedules.filter((s) => s.active).length} icon="calendar" onClick={() => setView('schedules')} />}
        <StatCard label="Exports this month" value={thisMonth} icon="arrival" onClick={() => setView('exports')} />
      </div>

      {(message || loadError) && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message?.tone === 'good' ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'}`}>{message?.text ?? loadError}</p>
      )}

      <Tabs<View> label="Library" value={view} onChange={setView} tabs={tabs} />

      {view === 'reports' && (
        <Card padded={false}>
          <DataTable columns={reportCols} rows={reports} rowKey={(r) => r.id} onRowClick={setRunning} empty={{ title: 'No reports yet' }} />
        </Card>
      )}
      {view === 'schedules' && canSchedule && (
        <Card padded={false}>
          <DataTable columns={scheduleCols} rows={schedules} rowKey={(s) => s.id} empty={{ title: 'Nothing scheduled', hint: 'Open a report and choose Schedule.' }} />
        </Card>
      )}
      {view === 'exports' && (
        <Card padded={false}>
          <DataTable columns={exportCols} rows={exports} rowKey={(e) => e.id} empty={{ title: 'Nothing exported yet' }} />
        </Card>
      )}

      {running && (
        <ReportViewer
          report={running}
          facts={facts}
          canOpen={canOpen}
          canSchedule={canSchedule}
          onClose={() => setRunning(null)}
          onExport={exportReport}
          onSchedule={() => {
            setScheduling({ reportId: running.id })
            setRunning(null)
          }}
          onCopy={() => {
            const { name, description, dataset, columns, filters, groupBy, period } = running
            setBuilding(
              running.builtIn
                ? { initial: { name: `${name} (copy)`, description, dataset, columns, filters, groupBy, period }, title: 'Save a copy' }
                : { initial: { name, description, dataset, columns, filters, groupBy, period }, id: running.id, title: 'Edit report' },
            )
            setRunning(null)
          }}
        />
      )}

      {building && <ReportBuilder title={building.title} initial={building.initial} datasets={datasets} facts={facts} onSave={saveReport} onClose={() => setBuilding(null)} />}

      {scheduling && (
        <ScheduleDialog
          reports={reports}
          reportId={scheduling.reportId}
          defaultRecipient={user?.email ?? ''}
          onClose={() => setScheduling(null)}
          onSave={async (input) => {
            const s = await reportsService.saveSchedule(tenant.id, input, actor)
            setScheduling(null)
            setView('schedules')
            setMessage({ tone: 'good', text: `Scheduled "${s.reportName}": ${frequencyWords(s)}.` })
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete report"
          message={`Delete "${deleting.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const d = deleting
            setDeleting(null)
            void act(() => reportsService.deleteDefinition(d.id, actor), `Deleted "${d.name}".`)
          }}
        />
      )}
      {dropping && (
        <ConfirmDialog
          title="Delete schedule"
          message={`Stop sending "${dropping.reportName}" to ${dropping.recipients.join(', ')}?`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDropping(null)}
          onConfirm={() => {
            const s = dropping
            setDropping(null)
            void act(() => reportsService.deleteSchedule(s.id, actor), 'Schedule deleted.')
          }}
        />
      )}
    </div>
  )
}
