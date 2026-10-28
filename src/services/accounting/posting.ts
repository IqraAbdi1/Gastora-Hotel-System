import type { GlAccount, JournalLine, PostingRule, SourceTransaction, TransactionCode } from './accountingTypes'

// The posting engine: hotel transactions in, balanced journal lines out. Pure rules, no storage,
// so the screens can preview a posting with exactly the arithmetic the service uses.

export interface PostingResult {
  lines: Omit<JournalLine, 'id' | 'batchId'>[]
  totalDebit: number
  totalCredit: number
  errors: string[]
}

export function applyRules(
  source: SourceTransaction[],
  codes: TransactionCode[],
  rules: PostingRule[],
  chart: GlAccount[],
): PostingResult {
  const errors: string[] = []
  const nameOf = (code: string) => chart.find((a) => a.trademateCode === code)?.trademateName
  // Summarised: one line per account, centre, code and side, which is what the books want.
  const sums = new Map<string, Omit<JournalLine, 'id' | 'batchId' | 'lineNo'>>()

  const add = (account: string, centre: string, code: string, description: string, debit: number, credit: number) => {
    const key = `${account}|${centre}|${code}|${debit > 0 ? 'D' : 'C'}`
    const prev = sums.get(key)
    if (prev) {
      prev.debit += debit
      prev.credit += credit
    } else
      sums.set(key, {
        accountCode: account,
        accountName: nameOf(account) ?? 'Not in Trademate chart',
        profitCentreId: centre,
        transactionCode: code,
        description,
        debit,
        credit,
      })
  }

  for (const t of source) {
    if (!t.amount) continue
    const code = codes.find((c) => c.code === t.transactionCode)
    if (!code) {
      errors.push(`Unknown transaction code ${t.transactionCode}`)
      continue
    }
    const rule = rules.find((r) => r.transactionCodeId === code.id)
    if (!rule || !rule.active) {
      errors.push(`No active posting rule for ${code.code} ${code.name}`)
      continue
    }
    for (const acc of [rule.debitAccount, rule.creditAccount])
      if (!nameOf(acc)) errors.push(`Account ${acc} (${code.code}) is not in the Trademate chart`)
    const amt = Math.round(Math.abs(t.amount))
    // A negative amount (a reversal) posts the other way round.
    const [dr, cr] = t.amount > 0 ? [rule.debitAccount, rule.creditAccount] : [rule.creditAccount, rule.debitAccount]
    add(dr, rule.profitCentreId, code.code, code.name, amt, 0)
    add(cr, rule.profitCentreId, code.code, code.name, 0, amt)
  }

  const lines = [...sums.values()]
    .sort((a, b) => (a.debit > 0 === b.debit > 0 ? a.accountCode.localeCompare(b.accountCode) : a.debit > 0 ? -1 : 1))
    .map((l, i) => ({ ...l, lineNo: i + 1 }))
  const totalDebit = lines.reduce((n, l) => n + l.debit, 0)
  const totalCredit = lines.reduce((n, l) => n + l.credit, 0)
  if (totalDebit !== totalCredit) errors.push('Debits and credits do not balance')
  return { lines, totalDebit, totalCredit, errors: [...new Set(errors)] }
}
