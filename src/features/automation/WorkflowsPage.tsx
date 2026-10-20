import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import type { Column, Tone } from '../../components/ui'
import Switch from '../../components/Switch'
import { dateTime, ugx } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { roleById, ROLES } from '../../lib/roles'
import type { RoleId } from '../../lib/roles'
import { automationService } from '../../services'
import type {
  ConditionOp,
  RunStatus,
  StepAction,
  StepKind,
  TriggerType,
  Workflow,
  WorkflowEvent,
  WorkflowInput,
  WorkflowRun,
  WorkflowStep,
} from '../../services/automation/automationTypes'
import { OP_LABEL, TRIGGERS, describeCondition } from '../../services/automation/engines/workflows'
import { useFeatures } from '../platform/featuresContext'
import { ErrorLine, ReasonDialog } from './automationUi'
import { useActor, useAutomationData, useAutomationSnapshot, useRun } from './useAutomation'

type Tab = 'workflows' | 'runs' | 'templates'

const STATUS_TONE: Record<RunStatus, Tone> = { 'awaiting-approval': 'warn', completed: 'good', rejected: 'bad', skipped: 'neutral' }
const STATUS_LABEL: Record<RunStatus, string> = { 'awaiting-approval': 'Waiting for approval', completed: 'Completed', rejected: 'Rejected', skipped: 'Skipped' }
const ACTION_LABEL: Record<StepAction, string> = { 'create-task': 'Create task', 'send-message': 'Send message', 'add-note': 'Add note' }
const HOTEL_ROLES = ROLES.filter((r) => r.id !== 'platform')
const roleName = (r?: RoleId) => (r ? roleById(r)?.label ?? r : '')

function triggerText(w: Pick<Workflow, 'trigger'>) {
  const t = TRIGGERS[w.trigger.type]
  if (w.trigger.type === 'refund-above') return `Refund above ${ugx(w.trigger.threshold ?? 0)}`
  if (w.trigger.type === 'room-out-of-order') return `Room out of order over ${w.trigger.threshold ?? 24} h`
  return t.label
}

function stepText(s: Pick<WorkflowStep, 'kind' | 'role' | 'action'>) {
  if (s.kind === 'approval') return `Approval: ${roleName(s.role)}`
  if (s.kind === 'notification') return `Notify ${roleName(s.role)}`
  return ACTION_LABEL[s.action ?? 'add-note']
}

export default function WorkflowsPage() {
  const { tenant } = useFeatures()
  const pid = tenant.id
  const actor = useActor()
  const snapshot = useAutomationSnapshot()
  const { data: workflows } = useAutomationData(() => automationService.listWorkflows(pid), [], [pid])
  const { data: runs } = useAutomationData(() => automationService.listRuns(pid), [], [pid])
  const { data: templates } = useAutomationData(() => automationService.listTemplates(), [], [])
  const { data: pending } = useAutomationData(() => automationService.pendingEvents(snapshot), [], [snapshot])
  const { run, busy, error } = useRun()
  const [tab, setTab] = useState<Tab>('workflows')
  const [editing, setEditing] = useState<WorkflowInput | null>(null)
  const [testing, setTesting] = useState<Workflow | null>(null)
  const [deleting, setDeleting] = useState<Workflow | null>(null)
  const [confirmLive, setConfirmLive] = useState(false)
  const [viewRun, setViewRun] = useState<WorkflowRun | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const now = useNow()
  const waiting = runs.filter((r) => r.status === 'awaiting-approval')
  const week = runs.filter((r) => now - Date.parse(r.startedAt) < 7 * 86400000)
  const shownRuns = filter ? runs.filter((r) => r.workflowId === filter) : runs

  const runColumns: Column<WorkflowRun>[] = [
    {
      key: 'wf',
      header: 'Workflow',
      cell: (r) => (
        <div className="max-w-[16rem] whitespace-normal">
          <p className="font-semibold text-ink">{r.workflowName}</p>
          <p className="text-xs text-ink/55">{r.event.summary}</p>
        </div>
      ),
    },
    { key: 'mode', header: 'Mode', hideBelow: 'sm', cell: (r) => <Badge tone={r.mode === 'live' ? 'brand' : 'neutral'}>{r.mode === 'live' ? 'Live' : 'Test'}</Badge> },
    { key: 'status', header: 'Status', cell: (r) => <Badge tone={STATUS_TONE[r.status]} dot={r.status === 'awaiting-approval'}>{STATUS_LABEL[r.status]}</Badge> },
    { key: 'at', header: 'Started', align: 'right', hideBelow: 'md', cell: (r) => <span className="text-xs text-ink/60">{r.startedBy.name}, {dateTime(r.startedAt)}</span> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Automation"
        title="Workflows"
        description="When something happens: check, ask for approval, act, tell someone, and log it."
        actions={
          <Button onClick={() => setEditing({ name: '', description: '', trigger: { type: 'refund-above', threshold: 300000 }, conditions: [], steps: [], enabled: true })}>
            New workflow
          </Button>
        }
      />
      <ErrorLine error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Workflows" icon="list" value={workflows.length} hint={`${workflows.filter((w) => w.enabled).length} switched on`} onClick={() => setTab('workflows')} active={tab === 'workflows'} />
        <StatCard label="Live events waiting" icon="sparkles" value={pending.length} hint="Matching switched-on workflows" tone={pending.length ? 'warn' : 'default'} />
        <StatCard label="Runs, 7 days" icon="tasks" value={week.length} hint={`${week.filter((r) => r.mode === 'live').length} live`} onClick={() => setTab('runs')} active={tab === 'runs'} />
        <StatCard label="Waiting for approval" icon="alert" value={waiting.length} hint="Runs paused at an approval step" tone={waiting.length ? 'warn' : 'good'} onClick={() => setTab('runs')} />
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/[0.07] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {pending.length} event{pending.length === 1 ? '' : 's'} ready to run
            </p>
            <p className="truncate text-xs text-ink/65">{[...new Set(pending.map((p) => p.event.summary))].slice(0, 3).join(' · ')}</p>
          </div>
          <Button size="sm" disabled={busy} onClick={() => setConfirmLive(true)}>
            Run now
          </Button>
        </div>
      )}

      <Tabs<Tab>
        label="Workflows"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'workflows', label: 'Workflows', count: workflows.length },
          { key: 'runs', label: 'Run log', count: runs.length, alert: waiting.length > 0 },
          { key: 'templates', label: 'Templates', count: templates.length },
        ]}
      />

      {tab === 'workflows' &&
        (workflows.length === 0 ? (
          <Card>
            <EmptyState title="No workflows yet" action={<Button onClick={() => setTab('templates')}>Start from a template</Button>} />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {workflows.map((w) => {
              const mine = runs.filter((r) => r.workflowId === w.id)
              return (
                <Card key={w.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{w.name}</p>
                      <p className="mt-0.5 text-xs text-ink/60">{w.description}</p>
                    </div>
                    <Switch on={w.enabled} label={`${w.name} switched on`} disabled={busy} onChange={(v) => actor && run(() => automationService.setEnabled(w.id, v, actor))} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge tone="brand">When: {triggerText(w)}</Badge>
                    {w.conditions.map((c) => (
                      <Badge key={c.id} tone="info">
                        If {describeCondition(c)}
                      </Badge>
                    ))}
                    {w.steps.map((s) => (
                      <span key={s.id} className="flex items-center gap-1.5">
                        <span className="text-ink/35" aria-hidden="true">
                          →
                        </span>
                        <Badge tone={s.kind === 'approval' ? 'warn' : s.kind === 'notification' ? 'accent' : 'neutral'}>{stepText(s)}</Badge>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-ink/50">
                      {mine.length} run{mine.length === 1 ? '' : 's'} · changed by {w.updatedBy.name}, {dateTime(w.updatedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setTesting(w)}>
                        Test run
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...w })}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFilter(w.id)
                          setTab('runs')
                        }}
                      >
                        Run log
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(w)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ))}

      {tab === 'runs' && (
        <Card
          title="Run log"
          icon="tasks"
          count={shownRuns.length}
          padded={false}
          actions={
            filter ? (
              <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
                Show all workflows
              </Button>
            ) : undefined
          }
        >
          <DataTable columns={runColumns} rows={shownRuns} rowKey={(r) => r.id} onRowClick={setViewRun} empty={{ title: 'No runs yet', hint: 'Test a workflow to see its log here.' }} />
        </Card>
      )}

      {tab === 'templates' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <p className="font-semibold text-ink">{t.name}</p>
              <p className="mt-1 text-xs text-ink/60">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="brand">{triggerText(t)}</Badge>
                {t.steps.map((s, i) => (
                  <Badge key={i} tone={s.kind === 'approval' ? 'warn' : s.kind === 'notification' ? 'accent' : 'neutral'}>
                    {stepText(s)}
                  </Badge>
                ))}
              </div>
              <div className="mt-3">
                <Button size="sm" disabled={busy} onClick={() => actor && run(() => automationService.createFromTemplate(pid, t.id, actor), () => setTab('workflows'))}>
                  Use template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <Builder input={editing} onClose={() => setEditing(null)} />}
      {testing && (
        <TestRun
          workflow={testing}
          onClose={() => setTesting(null)}
          onDone={(r) => {
            setTesting(null)
            setViewRun(r)
          }}
        />
      )}
      {viewRun && <RunDetail run={runs.find((r) => r.id === viewRun.id) ?? viewRun} onClose={() => setViewRun(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete workflow"
          message={`Delete "${deleting.name}"? Its run log is kept.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setDeleting(null)
            if (actor) void run(() => automationService.deleteWorkflow(deleting.id, actor))
          }}
        />
      )}
      {confirmLive && (
        <ConfirmDialog
          title="Run workflows on live events"
          message={`${pending.length} run${pending.length === 1 ? '' : 's'} will start. Tasks and notifications are real; approvals wait for the right person.`}
          confirmLabel="Run now"
          onCancel={() => setConfirmLive(false)}
          onConfirm={() => {
            setConfirmLive(false)
            if (actor) void run(() => automationService.runLive(snapshot, actor), () => setTab('runs'))
          }}
        />
      )}
    </div>
  )
}

let localId = 0
const tempId = () => `new-${++localId}`

function Builder({ input, onClose }: { input: WorkflowInput; onClose: () => void }) {
  const { tenant } = useFeatures()
  const actor = useActor()
  const { run, busy, error } = useRun()
  const [w, setW] = useState<WorkflowInput>({ ...input, steps: input.steps.map((s) => ({ ...s })), conditions: input.conditions.map((c) => ({ ...c })) })
  const trig = TRIGGERS[w.trigger.type]
  const set = (patch: Partial<WorkflowInput>) => setW({ ...w, ...patch })
  const setStep = (i: number, patch: Partial<WorkflowInput['steps'][number]>) => set({ steps: w.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const move = (i: number, by: number) => {
    const list = [...w.steps]
    const [x] = list.splice(i, 1)
    list.splice(i + by, 0, x)
    set({ steps: list })
  }
  const addStep = (kind: StepKind) =>
    set({
      steps: [
        ...w.steps,
        {
          id: '',
          kind,
          role: kind === 'action' ? undefined : kind === 'approval' ? 'gm' : 'frontdesk',
          action: kind === 'action' ? 'create-task' : undefined,
          text: '',
        },
      ],
    })

  return (
    <Modal
      side
      wide
      title={input.id ? 'Edit workflow' : 'New workflow'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => actor && run(() => automationService.saveWorkflow(tenant.id, w, actor), onClose)}>
            Save workflow
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorLine error={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            {(id) => <Input id={id} value={w.name} onChange={(e) => set({ name: e.target.value })} />}
          </Field>
          <Field label="Description">
            {(id) => <Input id={id} value={w.description} onChange={(e) => set({ description: e.target.value })} />}
          </Field>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-ink">1. Trigger</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="When">
              {(id) => (
                <Select
                  id={id}
                  value={w.trigger.type}
                  onChange={(e) => {
                    const type = e.target.value as TriggerType
                    set({ trigger: { type, threshold: type === 'refund-above' ? 300000 : type === 'room-out-of-order' ? 24 : undefined }, conditions: [] })
                  }}
                >
                  {(Object.keys(TRIGGERS) as TriggerType[]).map((t) => (
                    <option key={t} value={t}>
                      {TRIGGERS[t].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {trig.threshold && (
              <Field label={trig.threshold} required>
                {(id) => <Input id={id} type="number" min={1} value={w.trigger.threshold ?? ''} onChange={(e) => set({ trigger: { ...w.trigger, threshold: Number(e.target.value) } })} />}
              </Field>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">2. Conditions</h3>
          <ul className="mt-2 space-y-2">
            {w.conditions.map((c, i) => (
              <li key={c.id} className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Select aria-label="Field" value={c.field} onChange={(e) => set({ conditions: w.conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })}>
                  {trig.fields.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </Select>
                <Select aria-label="Test" value={c.op} onChange={(e) => set({ conditions: w.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionOp } : x)) })}>
                  {(Object.keys(OP_LABEL) as ConditionOp[]).map((o) => (
                    <option key={o} value={o}>
                      {OP_LABEL[o]}
                    </option>
                  ))}
                </Select>
                <Input aria-label="Value" value={c.value} onChange={(e) => set({ conditions: w.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                <Button size="sm" variant="ghost" onClick={() => set({ conditions: w.conditions.filter((_, j) => j !== i) })}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => set({ conditions: [...w.conditions, { id: tempId(), field: trig.fields[0], op: 'eq', value: '' }] })}>
            Add condition
          </Button>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">3. Steps</h3>
          <p className="text-xs text-ink/55">Use {trig.fields.map((f) => `{${f}}`).join(' ')} in the text.</p>
          <ol className="mt-2 space-y-2">
            {w.steps.map((s, i) => (
              <li key={i} className="rounded-xl border border-ink/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{i + 1}</span>
                  <Badge tone={s.kind === 'approval' ? 'warn' : s.kind === 'notification' ? 'accent' : 'neutral'}>{s.kind === 'approval' ? 'Approval' : s.kind === 'notification' ? 'Notification' : 'Action'}</Badge>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                      ↑
                    </Button>
                    <Button size="sm" variant="ghost" disabled={i === w.steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                      ↓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => set({ steps: w.steps.filter((_, j) => j !== i) })}>
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[12rem_1fr]">
                  {s.kind === 'action' ? (
                    <Select aria-label="Action" value={s.action} onChange={(e) => setStep(i, { action: e.target.value as StepAction })}>
                      {(Object.keys(ACTION_LABEL) as StepAction[]).map((a) => (
                        <option key={a} value={a}>
                          {ACTION_LABEL[a]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Select aria-label={s.kind === 'approval' ? 'Approved by' : 'Tell'} value={s.role} onChange={(e) => setStep(i, { role: e.target.value as RoleId })}>
                      {HOTEL_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Input aria-label="Text" value={s.text} placeholder={s.kind === 'approval' ? 'Approve {reference} for {amount}' : 'Text'} onChange={(e) => setStep(i, { text: e.target.value })} />
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => addStep('approval')}>
              Add approval
            </Button>
            <Button size="sm" variant="ghost" onClick={() => addStep('action')}>
              Add action
            </Button>
            <Button size="sm" variant="ghost" onClick={() => addStep('notification')}>
              Add notification
            </Button>
          </div>
        </section>

        <label className="flex items-center gap-3 text-sm text-ink/80">
          <Switch on={w.enabled} label="Switched on" onChange={(v) => set({ enabled: v })} />
          Switched on
        </label>
      </div>
    </Modal>
  )
}

function TestRun({ workflow, onClose, onDone }: { workflow: Workflow; onClose: () => void; onDone: (r: WorkflowRun) => void }) {
  const actor = useActor()
  const { run, busy, error } = useRun()
  const sample = TRIGGERS[workflow.trigger.type].sample
  const [data, setData] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(sample.data).map(([k, v]) => [k, String(v)])))
  const [summary, setSummary] = useState(sample.summary)

  function go() {
    if (!actor) return
    const typed: WorkflowEvent['data'] = {}
    for (const [k, v] of Object.entries(data)) typed[k] = typeof sample.data[k] === 'number' ? Number(v) : v
    void run(() => automationService.testRun(workflow.id, { key: 'test', type: workflow.trigger.type, summary, data: typed }, actor), onDone)
  }

  return (
    <Modal
      title={`Test: ${workflow.name}`}
      description="A sample event. Approvals still wait; nothing is created or sent."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={go}>
            Run test
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorLine error={error} />
        <Field label="Event">{(id) => <Input id={id} value={summary} onChange={(e) => setSummary(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.keys(data).map((k) => (
            <Field key={k} label={k}>
              {(id) => <Input id={id} type={typeof sample.data[k] === 'number' ? 'number' : 'text'} value={data[k]} onChange={(e) => setData({ ...data, [k]: e.target.value })} />}
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function RunDetail({ run: r, onClose }: { run: WorkflowRun; onClose: () => void }) {
  const actor = useActor()
  const { data: events } = useAutomationData(() => automationService.listRunEvents(r.id), [], [r.id])
  const { run, busy, error, setError } = useRun()
  const [rejecting, setRejecting] = useState(false)
  return (
    <Modal side title={r.workflowName} description={`${r.mode === 'live' ? 'Live' : 'Test'} run · ${r.event.summary}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[r.status]} dot={r.status === 'awaiting-approval'}>
            {STATUS_LABEL[r.status]}
          </Badge>
          <span className="text-xs text-ink/55">
            Started by {r.startedBy.name}, {dateTime(r.startedAt)}
            {r.finishedAt ? ` · finished ${dateTime(r.finishedAt)}` : ''}
          </span>
        </div>
        <ErrorLine error={rejecting ? null : error} />
        {r.status === 'awaiting-approval' && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-warn/30 bg-warn/[0.07] p-3">
            <p className="w-full text-sm text-ink/80">{events.filter((e) => e.kind === 'approval-requested').slice(-1)[0]?.detail}</p>
            <Button size="sm" disabled={busy} onClick={() => actor && run(() => automationService.decideApproval(r.id, true, '', actor))}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </div>
        )}
        <ol className="relative space-y-3 border-l border-ink/10 pl-4">
          {events.map((e) => (
            <li key={e.id}>
              <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${e.ok ? 'bg-good' : 'bg-bad'}`} aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                {e.kind.replaceAll('-', ' ')} · {dateTime(e.at)}
                {e.by ? ` · ${e.by.name}` : ''}
              </p>
              <p className={`text-sm ${e.ok ? 'text-ink/80' : 'text-bad'}`}>{e.detail}</p>
            </li>
          ))}
        </ol>
      </div>
      {rejecting && (
        <ReasonDialog
          title="Reject"
          label="Why?"
          confirm="Reject"
          error={error}
          onCancel={() => {
            setRejecting(false)
            setError(null)
          }}
          onConfirm={(note) => actor && run(() => automationService.decideApproval(r.id, false, note, actor), () => setRejecting(false))}
        />
      )}
    </Modal>
  )
}
