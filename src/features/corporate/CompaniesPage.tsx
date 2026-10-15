import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  DataSourceBadge,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
} from '../../components/ui'
import type { Column } from '../../components/ui'
import { creditPosition, missingSteps, STATUS_LABEL, STEP_LABEL, TERMS_LABEL } from '../../lib/corporate'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { AccountStatus, CorporateAccount } from '../../services/corporate/corporateTypes'
import { useAuth } from '../auth/authContext'
import AccountPanel from './AccountPanel'
import { useCorporate } from './corporateContext'
import { creditText, statusTone } from './corporateUi'
import NewAccountDialog from './NewAccountDialog'
import PolicyDialog from './PolicyDialog'

const POLICY_SIZE = { small: 'Small hotel rules', medium: 'Medium hotel rules', large: 'Large hotel rules' }

// Company accounts: who they are, whether they can be billed, their credit and their agreed prices.
export default function CompaniesPage() {
  const { accounts, loading, error, policy, byId } = useCorporate()
  const { reservations } = useHotel()
  const { can } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<AccountStatus | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)

  const counts = useMemo(() => {
    const c = { active: 0, pending: 0, blocked: 0 }
    for (const a of accounts) {
      if (a.status === 'active') c.active += 1
      if (a.status === 'pending') c.pending += 1
      if (a.status === 'on-hold' || a.status === 'suspended') c.blocked += 1
    }
    return c
  }, [accounts])

  const list = useMemo(() => {
    const text = q.trim().toLowerCase()
    return accounts
      .filter((a) => status === 'all' || a.status === status)
      .filter(
        (a) =>
          !text ||
          a.name.toLowerCase().includes(text) ||
          a.tin.includes(text) ||
          a.id.toLowerCase().includes(text) ||
          a.contacts.some((c) => c.name.toLowerCase().includes(text)),
      )
      .sort((x, y) => Number(y.status === 'pending') - Number(x.status === 'pending') || x.name.localeCompare(y.name))
  }, [accounts, q, status])

  const opened = openId ? byId(openId) : undefined

  const columns: Column<CorporateAccount>[] = [
    {
      key: 'name',
      header: 'Company',
      cell: (a) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{a.name}</p>
          <p className="text-xs text-ink/55">
            {a.id} · TIN {a.tin || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => (
        <div>
          <Badge tone={statusTone[a.status]} dot>
            {STATUS_LABEL[a.status]}
          </Badge>
          {a.status === 'pending' && (
            <p className="mt-1 text-xs text-ink/55">Needs {missingSteps(a).map((s) => STEP_LABEL[s].toLowerCase()).join(' and ')}</p>
          )}
        </div>
      ),
    },
    { key: 'terms', header: 'Terms', hideBelow: 'md', cell: (a) => TERMS_LABEL[a.paymentTerms] },
    {
      key: 'credit',
      header: 'Credit available',
      hideBelow: 'sm',
      align: 'right',
      cell: (a) => {
        if (a.creditLimit <= 0) return <span className="text-ink/50">No credit</span>
        const p = creditPosition(a, reservations)
        return (
          <div>
            <p className={`font-medium tabular-nums ${p.available < 0 ? 'text-bad' : ''}`}>{creditText(p.available)}</p>
            <p className="text-xs text-ink/55">of {ugx(a.creditLimit)}</p>
          </div>
        )
      },
    },
    {
      key: 'agreement',
      header: 'Agreement',
      hideBelow: 'lg',
      cell: (a) =>
        a.agreement ? (
          <span>
            {a.agreement.rules.length} price{a.agreement.rules.length === 1 ? '' : 's'}
            <span className="block text-xs text-ink/55">until {dayMonth(a.agreement.validTo)}</span>
          </span>
        ) : (
          <span className="text-ink/50">None</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Companies"
        description="Company accounts, who may book and approve charges, credit and agreed prices."
        meta={<DataSourceBadge />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowPolicy(true)}>
              {POLICY_SIZE[policy.size]}
            </Button>
            {can('requestCorporate') && <Button onClick={() => setAdding(true)}>New company</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active" icon="check" value={counts.active} hint="Can be billed" />
        <StatCard label="Awaiting approval" icon="alert" value={counts.pending} tone={counts.pending ? 'warn' : 'default'} hint="Cannot be billed yet" />
        <StatCard label="On hold or suspended" icon="money" value={counts.blocked} tone={counts.blocked ? 'bad' : 'default'} hint="No new company billing" />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-2 border-b border-ink/10 p-3 sm:flex-row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by company, TIN, account number or contact"
            aria-label="Search companies"
            className="sm:flex-1"
          />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as AccountStatus | 'all')} className="sm:w-56">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        {loading ? (
          <LoadingState label="Loading companies…" />
        ) : error ? (
          <ErrorState title="Companies could not be loaded" hint={error} />
        ) : (
          <DataTable
            columns={columns}
            rows={list}
            rowKey={(a) => a.id}
            onRowClick={(a) => setOpenId(a.id)}
            empty={{
              title: accounts.length ? 'No company matches' : 'No company accounts yet',
              hint: accounts.length ? 'Try another name or status.' : 'Use New company to ask for the first one.',
            }}
          />
        )}
      </Card>

      {opened && <AccountPanel a={opened} onClose={() => setOpenId(null)} />}
      {adding && (
        <NewAccountDialog
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false)
            setOpenId(id)
          }}
        />
      )}
      {showPolicy && <PolicyDialog canEdit={can('changeSettings')} onClose={() => setShowPolicy(false)} />}
    </div>
  )
}
