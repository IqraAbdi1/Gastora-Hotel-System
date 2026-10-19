import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import {
  PART_PROBLEM_TEXT,
  issuedParts,
  mergeParts,
  newPartId,
  partProblem,
  partsTotal,
  waitingParts,
} from '../../lib/parts'
import type { UsedPart } from '../../lib/parts'
import { useAuth } from '../auth/authContext'
import { useRequests } from '../procurement/requestsContext'

/**
 * Parts on a job.
 *
 * A technician fits the part; the storekeeper issues it. So whoever can issue stock takes it off the
 * shelf here and now, and whoever cannot leaves a request that the store confirms at the counter.
 * Either way the stock that leaves the shelf and the cost on this job are the same event.
 */
export default function PartsDialog({
  title,
  reference,
  parts,
  onSave,
  onClose,
}: {
  title: string
  /** What the store issue note will say this was for. */
  reference: string
  parts: UsedPart[]
  onSave: (parts: UsedPart[]) => void
  onClose: () => void
}) {
  const { stock, stockOf, issueStock } = useRequests()
  const { user, can } = useAuth()
  const [list, setList] = useState<UsedPart[]>(parts)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mayIssue = can('manageStock')
  const me = user?.staffName || user?.name || 'Staff'

  // Engineering spares first: it is what a technician is nearly always after.
  const choices = useMemo(
    () =>
      [...stock].sort(
        (a, b) =>
          Number(b.store === 'engineering') - Number(a.store === 'engineering') || a.name.localeCompare(b.name),
      ),
    [stock],
  )

  const item = stock.find((s) => s.name === name)
  const onHand = name ? stockOf(name) : 0
  const problem = partProblem(name, Number(qty), onHand, !!item, mayIssue)

  function add() {
    setTouched(true)
    setError(null)
    if (problem) return
    const part: UsedPart = {
      id: newPartId(),
      name,
      qty: Number(qty),
      issued: false,
      by: me,
    }

    if (!mayIssue) {
      setList((current) => mergeParts(current, part))
      setName('')
      setQty('1')
      return
    }

    // Taking it off the shelf is the store's own action, with the store's own refusals.
    const result = issueStock({
      department: 'Maintenance',
      note: reference,
      lines: [{ name, qty: Number(qty), unitCost: item?.unitCost ?? 0 }],
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    const line = result.value.lines[0]
    setList((current) =>
      mergeParts(current, {
        ...part,
        issued: true,
        issuedOn: TODAY,
        issuedBy: me,
        unitCost: line?.unitCost ?? item?.unitCost ?? 0,
        receiptId: result.value.id,
      }),
    )
    setName('')
    setQty('1')
  }

  /** The store confirming at the counter what a technician asked for earlier. */
  function issueWaiting(part: UsedPart) {
    setError(null)
    const result = issueStock({
      department: 'Maintenance',
      note: reference,
      lines: [{ name: part.name, qty: part.qty, unitCost: stock.find((s) => s.name === part.name)?.unitCost ?? 0 }],
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    const line = result.value.lines[0]
    setList((current) =>
      current.map((p) =>
        p.id === part.id
          ? { ...p, issued: true, issuedOn: TODAY, issuedBy: me, unitCost: line?.unitCost ?? 0, receiptId: result.value.id }
          : p,
      ),
    )
  }

  const columns: Column<UsedPart>[] = [
    {
      key: 'part',
      header: 'Part',
      cell: (p) => (
        <>
          <p className="font-medium text-ink">{p.name}</p>
          <p className="text-xs text-ink/55">{p.issued ? `Issued by ${p.issuedBy ?? p.by}` : `Asked for by ${p.by}`}</p>
        </>
      ),
    },
    { key: 'qty', header: 'How many', align: 'right', cell: (p) => <span className="tabular-nums">{p.qty}</span> },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      cell: (p) => (
        <span className="tabular-nums text-ink/70">{p.issued ? ugx(p.qty * (p.unitCost ?? 0)) : '—'}</span>
      ),
    },
    {
      key: 'state',
      header: '',
      align: 'right',
      cell: (p) =>
        p.issued ? (
          <Badge tone="good">Used</Badge>
        ) : mayIssue ? (
          <Button size="sm" onClick={() => issueWaiting(p)}>
            Issue it
          </Button>
        ) : (
          <Badge tone="warn">Waiting for the store</Badge>
        ),
    },
  ]

  return (
    <Modal
      wide
      title="Parts"
      description={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(list)}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card title="Add a part" icon="list">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Part" error={touched && (problem === 'no item' || problem === 'unknown item') ? PART_PROBLEM_TEXT[problem] : undefined}>
              {(id) => (
                <Select id={id} value={name} onChange={(e) => setName(e.target.value)}>
                  <option value="">Choose a part</option>
                  {choices.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} · {stockOf(s.name)} {s.unit} on hand
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="How many"
              error={touched && (problem === 'no quantity' || problem === 'not enough') ? PART_PROBLEM_TEXT[problem] : undefined}
            >
              {(id) => <Input id={id} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="w-28!" />}
            </Field>
            <Button onClick={add}>{mayIssue ? 'Take it from the store' : 'Ask the store for it'}</Button>
          </div>
          {name && item && (
            <p className="mt-2 text-xs text-ink/60">
              {onHand} {item.unit} on hand · about {ugx(item.unitCost)} each
            </p>
          )}
          {error && <p className="mt-2 text-sm font-medium text-bad">{error}</p>}
          {!mayIssue && (
            <p className="mt-2 text-xs text-ink/60">
              You cannot take stock off the shelf, so this is recorded as a request. The store issues it at the
              counter and the cost lands on this job then.
            </p>
          )}
        </Card>

        <Card
          title="On this job"
          icon="money"
          count={list.length}
          description={`Parts used so far: ${ugx(partsTotal(list))}. A part still with the store has cost nothing yet.`}
          padded={false}
        >
          {list.length === 0 ? (
            <EmptyState title="Nothing used yet" hint="Add what the repair consumed, so the machine's record is true." />
          ) : (
            <DataTable columns={columns} rows={list} rowKey={(p) => p.id} />
          )}
        </Card>

        {waitingParts(list).length > 0 && issuedParts(list).length > 0 && (
          <p className="text-xs text-ink/60">
            Only what the store has issued is counted as spend.
          </p>
        )}
      </div>
    </Modal>
  )
}
