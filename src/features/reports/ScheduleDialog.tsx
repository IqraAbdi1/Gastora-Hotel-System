import { useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import type { NewReportSchedule, ReportDefinition, ScheduleFrequency } from '../../services/reports/reportsTypes'
import { WEEKDAYS } from './reportsUtils'

/** Send a report by email every day, week or month. */
export default function ScheduleDialog({
  reports,
  reportId,
  defaultRecipient,
  onSave,
  onClose,
}: {
  reports: ReportDefinition[]
  reportId?: string
  defaultRecipient: string
  onSave: (input: NewReportSchedule) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<NewReportSchedule>({
    reportId: reportId ?? reports[0]?.id ?? '',
    frequency: 'daily',
    weekday: 1,
    monthDay: 1,
    sendAt: '07:00',
    recipients: [],
    format: 'pdf',
  })
  const [recipients, setRecipients] = useState(defaultRecipient)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof NewReportSchedule>(k: K, v: NewReportSchedule[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setError(null)
  }

  async function save() {
    setBusy(true)
    try {
      await onSave({ ...draft, recipients: recipients.split(/[,;\n]/).map((r) => r.trim()).filter(Boolean) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Schedule a report"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <Field label="Report" required>
          {(id) => (
            <Select id={id} value={draft.reportId} onChange={(e) => set('reportId', e.target.value)}>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="How often">
            {(id) => (
              <Select id={id} value={draft.frequency} onChange={(e) => set('frequency', e.target.value as ScheduleFrequency)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            )}
          </Field>
          {draft.frequency === 'weekly' && (
            <Field label="On">
              {(id) => (
                <Select id={id} value={draft.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {draft.frequency === 'monthly' && (
            <Field label="Day of month">
              {(id) => <Input id={id} type="number" min={1} max={28} value={draft.monthDay} onChange={(e) => set('monthDay', Number(e.target.value))} />}
            </Field>
          )}
          <Field label="At">
            {(id) => <Input id={id} type="time" value={draft.sendAt} onChange={(e) => set('sendAt', e.target.value)} />}
          </Field>
        </div>
        <Field label="Send to" required hint="Email addresses, separated by commas.">
          {(id) => <Textarea id={id} rows={2} value={recipients} onChange={(e) => setRecipients(e.target.value)} />}
        </Field>
        <Field label="Format">
          {(id) => (
            <Select id={id} value={draft.format} onChange={(e) => set('format', e.target.value as 'csv' | 'pdf')}>
              <option value="pdf">PDF</option>
              <option value="csv">Excel (CSV)</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
