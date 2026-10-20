import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Chip, DataTable, Field, Input, Modal, PageHeader, Pager, Select, StatCard } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useApprovals } from '../approvals/approvalsContext'
import { useRequests } from '../procurement/requestsContext'
import type { SecurityService } from '../../services/security/securityService'
import type { AuditCategory, AuditLogEntry, ChainVerification } from '../../services/security/securityTypes'
import { fromApprovals, fromReservations, fromStock } from './auditSources'
import { CATEGORY_LABEL, CATEGORY_TONE, fullDate, shortHash } from './labels'
import { ErrorBanner, Mono } from './parts'
import { downloadFile, useAction, useSecurityActor, useSecurityData } from './useSecurity'

const PER_PAGE = 20
const CATEGORIES: AuditCategory[] = ['rates', 'reservations', 'folios', 'refunds', 'voids', 'discounts', 'stock', 'accounting', 'security', 'privacy', 'fiscal']
const OP_LABEL = { I: 'Added', U: 'Changed', D: 'Removed' } as const

const load = (s: SecurityService, p: string) => s.listAudit(p)

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function AuditTrailPage() {
  const { reservations } = useHotel()
  const { records } = useApprovals()
  const { requests, movements, itemLog, losses, orders } = useRequests()
  const { actor, propertyId, service } = useSecurityActor()
  const { data, error: loadError } = useSecurityData(load)
  const { run, error, clear, busy } = useAction()

  const [cat, setCat] = useState<AuditCategory | 'all'>('all')
  const [q, setQ] = useState('')
  const [who, setWho] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<AuditLogEntry | null>(null)
  const [check, setCheck] = useState<ChainVerification | null>(null)

  // Seal what the rest of the app has recorded into this property's log. Already-sealed records are skipped.
  const sources = useMemo(
    () => [...fromReservations(reservations), ...fromApprovals(records), ...fromStock({ requests, movements, itemLog, losses, orders })],
    [reservations, records, requests, movements, itemLog, losses, orders],
  )
  useEffect(() => {
    void service.ingestAudit(propertyId, sources)
  }, [service, propertyId, sources])

  const entries = useMemo(() => [...(data ?? [])].sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq), [data])
  const people = useMemo(() => [...new Set(entries.map((e) => e.actorName))].sort(), [entries])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter(
      (e) =>
        (cat === 'all' || e.category === cat) &&
        (!who || e.actorName === who) &&
        (!from || e.at.slice(0, 10) >= from) &&
        (!to || e.at.slice(0, 10) <= to) &&
        (!needle || [e.summary, e.rowKey, e.actorName, e.before, e.after].some((x) => x?.toLowerCase().includes(needle))),
    )
  }, [entries, cat, who, from, to, q])

  if (!data) return <div className="space-y-5"><PageHeader title="Audit trail" /><ErrorBanner message={loadError} /></div>

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, entries.filter((e) => e.category === c).length])) as Record<AuditCategory, number>
  const today = entries.filter((e) => e.at.slice(0, 10) === TODAY).length
  const moneyOff = entries.filter((e) => ['refunds', 'voids', 'discounts'].includes(e.category)).reduce((n, e) => n + (e.amount ?? 0), 0)
  const rows = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const resetPage = () => setPage(0)

  const exportCsv = () => {
    const head = ['seq', 'at', 'who', 'category', 'table', 'op', 'record', 'what', 'before', 'after', 'amount_ugx', 'prev_hash', 'hash']
    const lines = filtered.map((e) => [e.seq, e.at, e.actorName, e.category, e.tableName, e.op, e.rowKey, e.summary, e.before, e.after, e.amount, e.prevHash, e.hash].map(csvCell).join(','))
    downloadFile(`audit-trail-${propertyId}-${TODAY}.csv`, [head.join(','), ...lines].join('\n'), 'text/csv')
    if (actor) void service.recordExport(propertyId, `Audit trail CSV, ${filtered.length} entries`, actor)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Audit trail"
        description="One sealed, append-only record of money, stock and control changes."
        actions={
          <>
            <Button variant="ghost" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const v = await run(() => service.verifyChain(propertyId))
                if (v) setCheck(v)
              }}
            >
              {busy ? 'Checking…' : 'Verify chain'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Entries" icon="list" value={entries.length.toLocaleString('en-US')} hint="Never edited or deleted" />
        <StatCard label="Today" icon="calendar" value={today} hint={TODAY} />
        <StatCard label="Refunds, voids, discounts" icon="money" value={ugx(moneyOff)} hint={`${counts.refunds + counts.voids + counts.discounts} entries`} tone={moneyOff ? 'warn' : 'default'} />
        <StatCard
          label="Hash chain"
          icon="check"
          value={check ? (check.ok ? 'Intact' : 'Broken') : 'Not checked'}
          hint={check ? `${check.checked} checked, ${new Date(check.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Press Verify chain'}
          tone={check ? (check.ok ? 'good' : 'bad') : 'default'}
        />
      </div>

      <ErrorBanner message={error} onClose={clear} />
      {check && (
        <div role="status" className={`rounded-lg px-3 py-2 text-sm ${check.ok ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'}`}>
          {check.ok ? (
            <>
              Chain intact: {check.checked} entries, each linked to the one before. Head <Mono>{shortHash(check.headHash)}</Mono>
            </>
          ) : (
            <>Chain broken at entry {check.brokenAt}. Report this to Gastora.</>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip active={cat === 'all'} onClick={() => (setCat('all'), resetPage())} count={entries.length}>
          All
        </Chip>
        {CATEGORIES.filter((c) => counts[c] > 0).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => (setCat(c), resetPage())} count={counts[c]}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      <Card padded={false}>
        <div className="grid gap-3 border-b border-ink/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">{(id) => <Input id={id} value={q} placeholder="Record, guest, item…" onChange={(e) => (setQ(e.target.value), resetPage())} />}</Field>
          <Field label="Who">
            {(id) => (
              <Select id={id} value={who} onChange={(e) => (setWho(e.target.value), resetPage())}>
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => (setFrom(e.target.value), resetPage())} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => (setTo(e.target.value), resetPage())} />}</Field>
        </div>
        <DataTable
          rows={rows}
          rowKey={(e) => e.id}
          onRowClick={setOpen}
          empty={{ title: 'No entries match' }}
          columns={[
            { key: 'at', header: 'When', cell: (e) => <span className="text-ink/75">{fullDate(e.at)}</span> },
            { key: 'who', header: 'Who', cell: (e) => <span className="font-medium text-ink">{e.actorName}</span> },
            { key: 'cat', header: 'Area', hideBelow: 'sm', cell: (e) => <Badge tone={CATEGORY_TONE[e.category]}>{CATEGORY_LABEL[e.category]}</Badge> },
            { key: 'rec', header: 'Record', hideBelow: 'lg', cell: (e) => e.rowKey },
            { key: 'what', header: 'What', className: 'max-w-[22rem] truncate', cell: (e) => e.summary },
            {
              key: 'change',
              header: 'Before → after',
              hideBelow: 'md',
              className: 'max-w-[18rem] truncate',
              cell: (e) =>
                e.before || e.after ? (
                  <span className="text-ink/70">
                    {e.before ? <span className="line-through decoration-ink/30">{e.before}</span> : null}
                    {e.before && e.after ? ' → ' : ''}
                    {e.after}
                  </span>
                ) : (
                  '-'
                ),
            },
          ]}
        />
        <Pager page={page} total={filtered.length} perPage={PER_PAGE} onPage={setPage} noun="entries" />
      </Card>

      {open && (
        <Modal title={open.summary} description={`${CATEGORY_LABEL[open.category]} · entry ${open.seq}`} side onClose={() => setOpen(null)}>
          <dl className="space-y-3 text-sm">
            {(
              [
                ['When', fullDate(open.at)],
                ['Who', open.actorName],
                ['Record', open.rowKey],
                ['Action', `${OP_LABEL[open.op]} in ${open.tableName}`],
                ['Before', open.before ?? '-'],
                ['After', open.after ?? '-'],
                ['Amount', open.amount !== undefined ? ugx(open.amount) : '-'],
                ['Sealed', fullDate(open.recordedAt)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2">
                <dt className="text-ink/55">{k}</dt>
                <dd className="break-words text-ink">{v}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="text-ink/55">Previous hash</dt>
              <dd className="break-all font-mono text-xs text-ink/70">{open.prevHash}</dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="text-ink/55">Hash</dt>
              <dd className="break-all font-mono text-xs text-ink/70">{open.hash}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  )
}
