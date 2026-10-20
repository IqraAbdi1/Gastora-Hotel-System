import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, DataTable, Field, Modal, Select } from '../../components/ui'
import type { Column } from '../../components/ui'
import { DATASET_DATE, DATASET_LABEL, PERIOD_LABEL } from '../../services/reports/reportCatalog'
import { formatCell, runReport } from '../../services/reports/datasets'
import type { DataRow, ReportResult } from '../../services/reports/datasets'
import type { ReportFacts } from '../../services/reports/facts'
import type { ReportDefinition, ReportPeriod } from '../../services/reports/reportsTypes'
import { PrintView, SampleBadge } from './ReportsUi'

/** A report run on today's records, with export, print and schedule. */
export default function ReportViewer({
  report,
  facts,
  canOpen,
  canSchedule,
  onClose,
  onExport,
  onSchedule,
  onCopy,
}: {
  report: ReportDefinition
  facts: ReportFacts
  canOpen: (path: string) => boolean
  canSchedule: boolean
  onClose: () => void
  onExport: (result: ReportResult, def: ReportDefinition, format: 'csv' | 'pdf') => Promise<void>
  onSchedule: () => void
  onCopy: () => void
}) {
  const [period, setPeriod] = useState<ReportPeriod>(report.period)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const def = useMemo(() => ({ ...report, period }), [report, period])
  const result = useMemo(() => runReport(def, facts), [def, facts])
  const hasDate = !!DATASET_DATE[report.dataset]

  const columns: Column<DataRow>[] = result.columns.map((c, i) => ({
    key: c.key,
    header: c.label,
    align: c.type === 'money' || c.type === 'number' || c.type === 'percent' ? 'right' : 'left',
    cell: (r: DataRow) => {
      const text = formatCell(r[c.key], c)
      if (i === 0 && r._to && canOpen(r._to.split('?')[0]))
        return (
          <Link to={r._to} className="font-medium text-brand hover:underline">
            {text}
          </Link>
        )
      return <span className={c.type === 'money' || c.type === 'number' ? 'tabular-nums' : ''}>{text}</span>
    },
  }))

  const totalsLine = result.columns
    .filter((c) => result.totals[c.key] !== undefined && c.type === 'money')
    .map((c) => `${c.label} ${formatCell(result.totals[c.key], c)}`)
    .join(' · ')

  async function exportAs(format: 'csv' | 'pdf') {
    setError(null)
    try {
      await onExport(result, def, format)
      if (format === 'pdf') setPrinting(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export')
    }
  }

  const subtitle = `${facts.propertyName} · ${DATASET_LABEL[report.dataset]} · ${hasDate ? PERIOD_LABEL[period] : 'Now'} · printed ${facts.today}`

  return (
    <Modal
      title={report.name}
      description={report.description || DATASET_LABEL[report.dataset]}
      onClose={onClose}
      side
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onCopy}>
            {report.builtIn ? 'Save a copy' : 'Edit'}
          </Button>
          {canSchedule && (
            <Button variant="ghost" onClick={onSchedule}>
              Schedule
            </Button>
          )}
          <Button variant="secondary" onClick={() => exportAs('pdf')} disabled={result.rows.length === 0}>
            PDF
          </Button>
          <Button onClick={() => exportAs('csv')} disabled={result.rows.length === 0}>
            Excel (CSV)
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="flex flex-wrap items-end justify-between gap-3">
          {hasDate ? (
            <div className="w-48">
              <Field label="Period">
                {(id) => (
                  <Select id={id} value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)}>
                    {(Object.keys(PERIOD_LABEL) as ReportPeriod[]).map((p) => (
                      <option key={p} value={p}>
                        {PERIOD_LABEL[p]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2 text-sm text-ink/60">
            {report.dataset === 'posSales' && facts.salesAreSample && <SampleBadge label="Sample till history" />}
            <span>{result.rows.length} rows</span>
          </div>
        </div>
        <div className="-mx-5 border-y border-ink/10">
          <DataTable columns={columns} rows={result.rows} rowKey={(r) => r._id} empty={{ title: 'No rows', hint: 'Try another period or fewer filters.' }} />
        </div>
        {totalsLine && <p className="text-right text-sm font-semibold tabular-nums text-ink">{totalsLine}</p>}
      </div>

      {printing && (
        <PrintView title={report.name} subtitle={subtitle} onDone={() => setPrinting(false)}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c.key} className={`border-b border-black/40 px-2 py-1 ${c.type === 'text' || c.type === 'date' ? 'text-left' : 'text-right'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r._id}>
                  {result.columns.map((c) => (
                    <td key={c.key} className={`border-b border-black/10 px-2 py-1 ${c.type === 'text' || c.type === 'date' ? 'text-left' : 'text-right'}`}>
                      {formatCell(r[c.key], c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {result.columns.map((c, i) => (
                  <td key={c.key} className={`px-2 py-1 font-bold ${c.type === 'text' || c.type === 'date' ? 'text-left' : 'text-right'}`}>
                    {i === 0 ? 'Total' : result.totals[c.key] !== undefined ? formatCell(result.totals[c.key], c) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </PrintView>
      )}
    </Modal>
  )
}
