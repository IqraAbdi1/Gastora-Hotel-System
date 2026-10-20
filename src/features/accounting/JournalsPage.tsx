import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, ErrorState, LoadingState, Modal, PageHeader, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dayMonth, ugx } from '../../lib/format'
import { applyRules } from '../../services/accounting/posting'
import type { JournalBatch, JournalLine, OutboxMessage } from '../../services/accounting/accountingTypes'
import { ErrorNote, JournalBadge, Notice } from './accountingUi'
import { stampOf, useRun } from './accountingHelpers'
import { useAccounting } from './useAccounting'
import type { AccountingValue } from './useAccounting'
import { useDay } from './useDay'

type Tab = 'batches' | 'errors' | 'today' | 'outbox'

const OUTBOX_LABEL: Record<OutboxMessage['kind'], string> = {
  journal_batch: 'Journal',
  journal_reversal: 'Reversal',
  ar_invoice: 'AR invoice',
  ap_commission: 'AP commission',
}

// The daily journal batches and their journey to Trademate.
export default function JournalsPage() {
  const acc = useAccounting()
  const [tab, setTab] = useState<Tab>('batches')
  const [open, setOpen] = useState<JournalBatch | null>(null)
  const [confirm, setConfirm] = useState<{ batch: JournalBatch; retry: boolean } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const act = useRun()
  const day = useDay(acc.businessDate, acc.transfers)

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  const batches = [...acc.batches].sort((a, b) => b.businessDate.localeCompare(a.businessDate) || b.revision - a.revision)
  const by = (s: JournalBatch['status']) => batches.filter((b) => b.status === s)
  const rejected = by('rejected')
  const failedOutbox = acc.outbox.filter((o) => o.status === 'failed')
  const preview = applyRules(day.source, acc.codes, acc.rules, acc.chart)
  const current = open ? acc.batches.find((b) => b.id === open.id) ?? open : null

  async function go(batch: JournalBatch, retry: boolean) {
    let result: JournalBatch | null = null
    await act.run(async () => {
      result = retry ? await acc.service.retryJournal(acc.propertyId, batch.id, acc.need()) : await acc.service.sendJournal(acc.propertyId, batch.id, acc.need())
    })
    setConfirm(null)
    const r = result as JournalBatch | null
    if (r) setMsg(r.status === 'rejected' ? null : `${batch.reference} sent to Trademate.`)
    if (r?.status === 'rejected') act.setError(`${batch.reference} rejected. ${r.lastError ?? ''}`)
  }

  const cols: Column<JournalBatch>[] = [
    { key: 'date', header: 'Business date', cell: (b) => <span className="font-medium">{dayMonth(b.businessDate)}</span> },
    { key: 'ref', header: 'Reference', hideBelow: 'md', cell: (b) => <span className="font-mono text-xs">{b.reference}</span> },
    { key: 'lines', header: 'Lines', align: 'right', hideBelow: 'sm', cell: (b) => b.lines.length },
    { key: 'dr', header: 'Debits', align: 'right', cell: (b) => <span className="tabular-nums">{ugx(b.totalDebit)}</span> },
    {
      key: 'st',
      header: 'Status',
      cell: (b) => (
        <div className="flex flex-col items-start gap-0.5">
          <JournalBadge status={b.status} />
          {b.trademateRef && <span className="font-mono text-[11px] text-ink/50">{b.trademateRef}</span>}
        </div>
      ),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (b) =>
        b.status === 'draft' && b.businessDate !== acc.businessDate ? (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setConfirm({ batch: b, retry: false }) }}>
            Send
          </Button>
        ) : b.status === 'rejected' ? (
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setConfirm({ batch: b, retry: true }) }}>
            Retry
          </Button>
        ) : null,
    },
  ]

  const outboxCols: Column<OutboxMessage>[] = [
    { key: 'kind', header: 'Type', cell: (o) => <Badge>{OUTBOX_LABEL[o.kind]}</Badge> },
    { key: 'what', header: 'Message', cell: (o) => <span className="text-ink/80">{o.description}</span> },
    { key: 'when', header: 'Created', hideBelow: 'md', cell: (o) => stampOf(o.createdAt) },
    { key: 'tries', header: 'Tries', align: 'right', hideBelow: 'sm', cell: (o) => o.attempts },
    {
      key: 'st',
      header: 'Status',
      cell: (o) => <Badge tone={o.status === 'delivered' ? 'good' : o.status === 'failed' ? 'bad' : 'info'}>{o.status === 'delivered' ? 'Delivered' : o.status === 'failed' ? 'Failed' : 'Sending'}</Badge>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Accounting" title="Journals" description="One balanced batch per business day, sent to Trademate." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Drafts" icon="list" value={by('draft').length} hint="Ready to send" onClick={() => setTab('batches')} />
        <StatCard label="Sent" icon="departure" value={by('sent').length} hint="Waiting for Trademate" />
        <StatCard label="Accepted" icon="check" value={by('accepted').length} hint="Posted in Trademate" tone="good" />
        <StatCard label="Rejected" icon="alert" value={rejected.length} hint={rejected[0]?.lastError?.replace('Trademate: ', '') ?? 'None'} tone={rejected.length ? 'bad' : 'default'} onClick={() => setTab('errors')} />
      </div>

      <Tabs<Tab>
        label="Journals"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'batches', label: 'Batches', count: batches.length },
          { key: 'errors', label: 'Error queue', count: rejected.length + failedOutbox.filter((o) => o.kind !== 'journal_batch').length, alert: rejected.length > 0 },
          { key: 'today', label: `Today so far` },
          { key: 'outbox', label: 'Outbox', count: acc.outbox.length },
        ]}
      />

      {msg && <Notice>{msg}</Notice>}
      <ErrorNote>{act.error}</ErrorNote>

      {tab === 'batches' && (
        <Card title="Batches" icon="list" padded={false}>
          <DataTable columns={cols} rows={batches} rowKey={(b) => b.id} onRowClick={setOpen} empty={{ title: 'No journals yet' }} />
        </Card>
      )}

      {tab === 'errors' && (
        <Card title="Error queue" icon="alert" padded={false}>
          {rejected.length === 0 ? (
            <p className="p-4 text-sm text-ink/55">Nothing rejected.</p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {rejected.map((b) => (
                <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {dayMonth(b.businessDate)} <span className="font-mono text-xs text-ink/50">{b.reference}</span>
                    </p>
                    <p className="text-sm text-bad">{b.lastError}</p>
                    <p className="text-xs text-ink/55">
                      {b.attempts} attempt{b.attempts === 1 ? '' : 's'}. Fix the posting rule, then retry; the lines are rebuilt.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(b)}>
                      Lines
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirm({ batch: b, retry: true })}>
                      Retry
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'today' && (
        <Card
          title={`${dayMonth(acc.businessDate)} so far`}
          icon="calendar"
          padded={false}
          description="Live from folios and POS. Built and sent after the night audit."
        >
          {preview.errors.length > 0 && (
            <div className="space-y-1 p-3">
              {preview.errors.map((e) => (
                <ErrorNote key={e}>{e}</ErrorNote>
              ))}
            </div>
          )}
          <Lines lines={preview.lines} acc={acc} />
          <Totals debit={preview.totalDebit} credit={preview.totalCredit} />
        </Card>
      )}

      {tab === 'outbox' && (
        <Card title="Outbox" icon="departure" padded={false}>
          <DataTable columns={outboxCols} rows={acc.outbox} rowKey={(o) => o.id} empty={{ title: 'Nothing sent yet' }} />
        </Card>
      )}

      {current && (
        <Modal title={`Journal ${dayMonth(current.businessDate)}`} description={current.reference} onClose={() => setOpen(null)} side wide>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <JournalBadge status={current.status} />
              {current.revision > 1 && <Badge tone="warn">Revision {current.revision}</Badge>}
              {current.trademateRef && <span className="font-mono text-xs text-ink/60">{current.trademateRef}</span>}
            </div>
            {current.lastError && <ErrorNote>{current.lastError}</ErrorNote>}
            <div className="-mx-5 border-y border-ink/10">
              <Lines lines={current.lines} acc={acc} />
              <Totals debit={current.totalDebit} credit={current.totalCredit} />
            </div>
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">History</h3>
              <ul className="space-y-2 text-sm">
                {current.history.map((h, i) => (
                  <li key={i}>
                    <p className="font-medium">{h.action}</p>
                    <p className="text-xs text-ink/55">
                      {h.by.name}, {stampOf(h.at)}
                      {h.detail ? ` · ${h.detail}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.retry ? 'Rebuild and send again?' : 'Send to Trademate?'}
          message={
            confirm.retry
              ? `${confirm.batch.reference} is rebuilt with today's posting rules and sent again.`
              : `${confirm.batch.reference}: ${confirm.batch.lines.length} lines, ${ugx(confirm.batch.totalDebit)} each side. Once Trademate accepts it, changes need a reopen.`
          }
          confirmLabel={act.busy ? 'Sending…' : 'Send'}
          onConfirm={() => go(confirm.batch, confirm.retry)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function Lines({ lines, acc }: { lines: Pick<JournalLine, 'lineNo' | 'accountCode' | 'accountName' | 'profitCentreId' | 'transactionCode' | 'debit' | 'credit'>[]; acc: AccountingValue }) {
  const centre = (id: string) => acc.centres.find((c) => c.id === id)?.name ?? ''
  return (
    <DataTable
      columns={[
        { key: 'acc', header: 'Account', cell: (l) => <span className={l.accountName === 'Not in Trademate chart' ? 'text-bad' : ''}><span className="font-mono text-xs">{l.accountCode}</span> {l.accountName}</span> },
        { key: 'code', header: 'Code', hideBelow: 'md', cell: (l) => <span className="font-mono text-xs text-ink/55">{l.transactionCode}</span> },
        { key: 'pc', header: 'Centre', hideBelow: 'lg', cell: (l) => centre(l.profitCentreId) },
        { key: 'dr', header: 'Debit', align: 'right', cell: (l) => (l.debit ? <span className="tabular-nums">{ugx(l.debit)}</span> : '') },
        { key: 'cr', header: 'Credit', align: 'right', cell: (l) => (l.credit ? <span className="tabular-nums">{ugx(l.credit)}</span> : '') },
      ]}
      rows={lines}
      rowKey={(l) => String(l.lineNo)}
      empty={{ title: 'No transactions yet' }}
    />
  )
}

function Totals({ debit, credit }: { debit: number; credit: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-2.5 text-sm">
      <Badge tone={debit === credit ? 'good' : 'bad'}>{debit === credit ? 'Balanced' : 'Out of balance'}</Badge>
      <span className="tabular-nums">
        Dr {ugx(debit)} · Cr {ugx(credit)}
      </span>
    </div>
  )
}
