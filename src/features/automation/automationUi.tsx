import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Button, Field, Modal, Textarea } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { dateTime } from '../../lib/format'
import type { Decision, Driver, Severity } from '../../services/automation/automationTypes'

const BASIS_TONE: Record<Driver['basis'], Tone> = { Rule: 'neutral', Estimate: 'info', 'Your input': 'accent' }

/** The "why" behind a suggestion, one line per driver. */
export function Drivers({ drivers, compact = false }: { drivers: Driver[]; compact?: boolean }) {
  if (drivers.length === 0) return null
  return (
    <ul className={`space-y-1 ${compact ? '' : 'mt-2'}`}>
      {drivers.map((d, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-ink/70">
          <span className="mt-px shrink-0">
            <Badge tone={BASIS_TONE[d.basis]}>{d.basis}</Badge>
          </span>
          <span className="min-w-0">{d.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** Reasons that are plain strings, such as a priority score's. */
export function Reasons({ reasons }: { reasons: string[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {reasons.map((r) => (
        <li key={r} className="rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-xs text-ink/70">
          {r}
        </li>
      ))}
    </ul>
  )
}

const SEVERITY_TONE: Record<Severity, Tone> = { high: 'bad', medium: 'warn', low: 'neutral' }

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} dot>
      {severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low'}
    </Badge>
  )
}

/** Who decided and when. */
export function DecisionStamp({ item }: { item: Decision }) {
  if (item.status === 'open') return null
  return (
    <p className="text-xs text-ink/55">
      <Badge tone={item.status === 'accepted' ? 'good' : 'neutral'}>{item.status === 'accepted' ? 'Accepted' : 'Dismissed'}</Badge>{' '}
      by {item.decidedBy?.name ?? 'someone'}
      {item.decidedAt ? `, ${dateTime(item.decidedAt)}` : ''}
      {item.decisionNote ? ` · “${item.decisionNote}”` : ''}
      {item.resultRef ? ` · ${item.resultRef}` : ''}
    </p>
  )
}

/** Accept or dismiss. Dismissing asks for a reason. */
export function DecisionButtons({
  item,
  onAccept,
  onDismiss,
  acceptLabel = 'Accept',
  busy = false,
  extra,
}: {
  item: Decision
  onAccept: () => void
  onDismiss: (reason: string) => unknown
  acceptLabel?: string
  busy?: boolean
  extra?: ReactNode
}) {
  const [asking, setAsking] = useState(false)
  if (item.status !== 'open') return <DecisionStamp item={item} />
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onAccept} disabled={busy}>
        {acceptLabel}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(true)} disabled={busy}>
        Dismiss
      </Button>
      {extra}
      {asking && (
        <ReasonDialog
          title="Dismiss suggestion"
          label="Why is it not right?"
          confirm="Dismiss"
          onCancel={() => setAsking(false)}
          onConfirm={async (r) => {
            await onDismiss(r)
            setAsking(false)
          }}
        />
      )}
    </div>
  )
}

export function ReasonDialog({
  title,
  label,
  confirm,
  optional = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string
  label: string
  confirm: string
  optional?: boolean
  error?: string | null
  onConfirm: (reason: string) => unknown
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const ok = optional || reason.trim().length >= 3
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!ok} onClick={() => void onConfirm(reason.trim())}>
            {confirm}
          </Button>
        </>
      }
    >
      <Field label={label} required={!optional} error={error ?? undefined}>
        {(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
      </Field>
    </Modal>
  )
}

export function ErrorLine({ error }: { error?: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg bg-bad/[0.08] px-3 py-2 text-sm font-medium text-bad">
      {error}
    </p>
  )
}

