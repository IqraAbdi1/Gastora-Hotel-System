import { useMemo, useState } from 'react'
import { Button, Chip, Field, Input, Modal, Select } from '../../components/ui'
import { DATASET_COLUMNS, DATASET_DATE, DATASET_LABEL, PERIOD_LABEL } from '../../services/reports/reportCatalog'
import { runReport } from '../../services/reports/datasets'
import type { ReportFacts } from '../../services/reports/facts'
import type { DatasetKey, FilterOp, NewReportDefinition, ReportFilter, ReportPeriod } from '../../services/reports/reportsTypes'

const OPS: { key: FilterOp; label: string }[] = [
  { key: 'eq', label: 'is' },
  { key: 'neq', label: 'is not' },
  { key: 'contains', label: 'contains' },
  { key: 'in', label: 'is one of' },
  { key: 'gte', label: 'at least' },
  { key: 'lte', label: 'at most' },
]

/** Pick a list, its columns, filters and a total-by column; then save it as a report. */
export default function ReportBuilder({
  initial,
  datasets,
  facts,
  title,
  onSave,
  onClose,
}: {
  initial: NewReportDefinition
  datasets: DatasetKey[]
  facts: ReportFacts
  title: string
  onSave: (input: NewReportDefinition) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<NewReportDefinition>(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cols = DATASET_COLUMNS[draft.dataset]
  const hasDate = !!DATASET_DATE[draft.dataset]

  const preview = useMemo(() => {
    try {
      const valid = { ...draft, filters: draft.filters.filter((f) => f.value.trim()) }
      return draft.columns.length ? runReport(valid, facts).rows.length : 0
    } catch {
      return 0
    }
  }, [draft, facts])

  function set<K extends keyof NewReportDefinition>(key: K, value: NewReportDefinition[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setError(null)
  }

  function changeDataset(dataset: DatasetKey) {
    const first = DATASET_COLUMNS[dataset].slice(0, 5).map((c) => c.key)
    setDraft((d) => ({ ...d, dataset, columns: first, filters: [], groupBy: null, period: DATASET_DATE[dataset] ? d.period : 'all' }))
    setError(null)
  }

  function toggleColumn(key: string) {
    set('columns', draft.columns.includes(key) ? draft.columns.filter((c) => c !== key) : cols.filter((c) => c.key === key || draft.columns.includes(c.key)).map((c) => c.key))
  }

  function setFilter(i: number, patch: Partial<ReportFilter>) {
    set(
      'filters',
      draft.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    )
  }

  async function save() {
    setBusy(true)
    try {
      await onSave(draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      side
      wide
      footer={
        <>
          <span className="mr-auto self-center text-sm text-ink/60">{preview} rows now</span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <Field label="Name" required>
          {(id) => <Input id={id} value={draft.name} maxLength={80} onChange={(e) => set('name', e.target.value)} placeholder="Weekend arrivals" />}
        </Field>
        <Field label="Description">
          {(id) => <Input id={id} value={draft.description} maxLength={120} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lists">
            {(id) => (
              <Select id={id} value={draft.dataset} onChange={(e) => changeDataset(e.target.value as DatasetKey)}>
                {datasets.map((d) => (
                  <option key={d} value={d}>
                    {DATASET_LABEL[d]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Period" hint={hasDate ? undefined : 'This list has no date.'}>
            {(id) => (
              <Select id={id} value={draft.period} disabled={!hasDate} onChange={(e) => set('period', e.target.value as ReportPeriod)}>
                {(Object.keys(PERIOD_LABEL) as ReportPeriod[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink/80">Columns</p>
          <div className="flex flex-wrap gap-2">
            {cols.map((c) => (
              <Chip key={c.key} active={draft.columns.includes(c.key)} onClick={() => toggleColumn(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink/80">Filters</p>
            <Button size="sm" variant="ghost" onClick={() => set('filters', [...draft.filters, { column: cols[0].key, op: 'eq', value: '' }])}>
              Add filter
            </Button>
          </div>
          {draft.filters.length === 0 ? (
            <p className="text-sm text-ink/50">No filters.</p>
          ) : (
            <ul className="space-y-2">
              {draft.filters.map((f, i) => (
                <li key={i} className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
                  <Select aria-label="Column" value={f.column} onChange={(e) => setFilter(i, { column: e.target.value })}>
                    {cols.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <Select aria-label="Condition" value={f.op} onChange={(e) => setFilter(i, { op: e.target.value as FilterOp })}>
                    {OPS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Value" value={f.value} placeholder={f.op === 'in' ? 'a, b, c' : 'Value'} onChange={(e) => setFilter(i, { value: e.target.value })} />
                  <Button size="sm" variant="ghost" onClick={() => set('filters', draft.filters.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="Total by" hint="Adds up the money and number columns for each value.">
          {(id) => (
            <Select id={id} value={draft.groupBy ?? ''} onChange={(e) => set('groupBy', e.target.value || null)}>
              <option value="">No grouping</option>
              {cols
                .filter((c) => c.type === 'text' || c.type === 'date')
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
