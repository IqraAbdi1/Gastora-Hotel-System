import { sampleAccounts } from '../../data/corporate'
import {
  canChangePricing,
  canSetCredit,
  canSignStep,
  contactRightsProblem,
  missingSteps,
  offersCredit,
  STEP_LABEL,
  stampNow,
} from '../../lib/corporate'
import { ugx } from '../../lib/format'
import { roleCan } from '../../lib/roles'
import type { CorporateService } from './corporateService'
import type { CorporateAccount, CorporateActor, CorporatePolicy } from './corporateTypes'

// In-memory company accounts for the prototype. Not saved and not shared. It applies the same
// permission checks the backend must apply, so the screens can be tested against them.
export function createMockCorporateService(): CorporateService {
  let accounts = sampleAccounts()
  let policy: CorporatePolicy | null = null
  let counter = accounts.length
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const deny = (why: string) => Promise.reject(new Error(why))
  const person = (a: CorporateActor) => ({ id: a.id, name: a.name })

  function change(id: string, actor: CorporateActor, action: string, detail: string | undefined, edit: (a: CorporateAccount) => CorporateAccount) {
    const found = accounts.find((a) => a.id === id)
    if (!found) return deny(`Account ${id} not found`)
    const next = edit(found)
    next.history = [...found.history, { at: stampNow(), by: person(actor), action, detail }]
    accounts = accounts.map((a) => (a.id === id ? next : a))
    emit()
    return Promise.resolve(next)
  }

  return {
    listAccounts: () => Promise.resolve(accounts.map((a) => ({ ...a }))),

    requestAccount(input, pol, actor) {
      if (!roleCan(actor.role, 'requestCorporate')) return deny('You cannot request company accounts.')
      if (!input.name.trim()) return deny('A company needs a name.')
      if (accounts.some((a) => a.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
        return deny('A company with this name already exists.')
      }
      if (input.tin && accounts.some((a) => a.tin === input.tin.trim())) return deny('A company with this TIN already exists.')
      for (const c of input.contacts) {
        const problem = contactRightsProblem(c)
        if (problem) return deny(`${c.name}: ${problem}`)
      }
      const names = input.contacts.map((c) => c.name.trim().toLowerCase())
      if (new Set(names).size !== names.length) return deny('The booker and the charge approver must be different people.')
      counter += 1
      const now = stampNow()
      const created: CorporateAccount = {
        ...input,
        id: `CA-${String(counter).padStart(3, '0')}`,
        name: input.name.trim(),
        tin: input.tin.trim(),
        status: 'pending',
        // Asked-for terms are kept as a request. Nobody gets credit until an approver grants it.
        paymentTerms: 'prepaid',
        creditLimit: 0,
        requestedCreditLimit: input.requestedCreditLimit || undefined,
        outstandingBalance: 0,
        contacts: input.contacts.map((c, i) => ({ ...c, id: `CC-${Date.now()}-${i}` })),
        requiredSteps: [...pol.accountApproval],
        approvals: [],
        createdAt: now,
        createdBy: person(actor),
        history: [
          {
            at: now,
            by: person(actor),
            action: 'Account requested',
            detail: input.requestedCreditLimit
              ? `Asked for ${ugx(input.requestedCreditLimit)} credit, ${input.paymentTerms}`
              : `Asked for ${input.paymentTerms}`,
          },
        ],
      }
      accounts = [created, ...accounts]
      emit()
      return Promise.resolve(created)
    },

    approveAccount(id, step, grant, pol, actor) {
      const a = accounts.find((x) => x.id === id)
      if (!a) return deny('Account not found')
      if (a.status !== 'pending') return deny('This account is not waiting for approval.')
      if (!a.requiredSteps.includes(step)) return deny('This account does not need that approval.')
      if (a.approvals.some((x) => x.step === step)) return deny(`${STEP_LABEL[step]} has already approved.`)
      if (!canSignStep(actor.role, step)) return deny(`Only ${STEP_LABEL[step].toLowerCase()} can give this approval.`)
      if (a.approvals.some((x) => x.by.id === actor.id)) return deny('The same person cannot give two approvals on one account.')
      if (grant.creditLimit !== undefined && !canSetCredit(actor.role, pol)) return deny('You cannot set credit limits.')
      if (grant.creditLimit && grant.paymentTerms && !offersCredit(grant.paymentTerms)) {
        return deny('Credit needs invoice terms (15, 30 or 60 days).')
      }

      const approvals = [...a.approvals, { step, by: person(actor), at: stampNow(), note: grant.note }]
      const done = missingSteps({ ...a, approvals }).length === 0
      const credit = grant.creditLimit !== undefined ? `, credit ${ugx(grant.creditLimit)}` : ''
      return change(id, actor, `${STEP_LABEL[step]} approved`, `${grant.note ?? ''}${credit}`.replace(/^, /, '') || undefined, (x) => ({
        ...x,
        approvals,
        status: done ? 'active' : 'pending',
        creditLimit: grant.creditLimit ?? x.creditLimit,
        paymentTerms: grant.paymentTerms ?? x.paymentTerms,
      }))
    },

    declineAccount(id, reason, actor) {
      if (!roleCan(actor.role, 'approveCorporateManager') && !roleCan(actor.role, 'approveCorporateFinance')) {
        return deny('Only an approver can decline an account.')
      }
      if (!reason.trim()) return deny('Give a reason.')
      return change(id, actor, 'Declined', reason, (x) => ({ ...x, status: 'declined', statusReason: reason }))
    },

    setStatus(id, status, reason, actor) {
      if (!roleCan(actor.role, 'approveCorporateManager') && !roleCan(actor.role, 'approveCorporateFinance')) {
        return deny('Only a manager or finance can change an account status.')
      }
      const a = accounts.find((x) => x.id === id)
      if (!a) return deny('Account not found')
      if (a.status === 'pending' || a.status === 'declined') return deny('Approve the account first.')
      if (status !== 'active' && !reason.trim()) return deny('Give a reason.')
      const label = { active: 'Reactivated', 'on-hold': 'Put on hold', suspended: 'Suspended', closed: 'Closed' }[status]
      return change(id, actor, label, reason || undefined, (x) => ({ ...x, status, statusReason: status === 'active' ? undefined : reason }))
    },

    setCredit(id, creditLimit, paymentTerms, reason, pol, actor) {
      if (!canSetCredit(actor.role, pol)) return deny(`Only ${STEP_LABEL[pol.creditApprover].toLowerCase()} can change credit.`)
      if (creditLimit < 0) return deny('Credit cannot be negative.')
      if (creditLimit > 0 && !offersCredit(paymentTerms)) return deny('Credit needs invoice terms (15, 30 or 60 days).')
      if (!reason.trim()) return deny('Give a reason for the change.')
      return change(id, actor, 'Credit changed', `${ugx(creditLimit)}, ${paymentTerms}. ${reason}`, (x) => ({
        ...x,
        creditLimit,
        paymentTerms,
        requestedCreditLimit: undefined,
      }))
    },

    updateBilling(id, billing, actor) {
      if (!roleCan(actor.role, 'manageCorporate')) return deny('You cannot edit billing instructions.')
      return change(id, actor, 'Billing instructions changed', undefined, (x) => ({ ...x, billing }))
    },

    saveContact(id, contact, actor) {
      if (!roleCan(actor.role, 'manageCorporate')) return deny('You cannot edit company contacts.')
      if (!contact.name.trim()) return deny('A contact needs a name.')
      const problem = contactRightsProblem(contact)
      if (problem) return deny(problem)
      const account = accounts.find((a) => a.id === id)
      const clash = account?.contacts.find(
        (c) => c.id !== contact.id && c.active && c.name.trim().toLowerCase() === contact.name.trim().toLowerCase(),
      )
      if (clash && contact.active) {
        return deny(`${clash.name} is already a contact. One person holds one role: booker or charge approver.`)
      }
      const isNew = !contact.id
      const saved = { ...contact, id: contact.id ?? `CC-${Date.now()}` }
      const rights = [saved.canBook && 'can book', saved.canApproveCharges && 'can approve charges'].filter(Boolean).join(', ')
      return change(id, actor, isNew ? 'Contact added' : 'Contact changed', `${saved.name}${rights ? ` (${rights})` : ''}`, (x) => ({
        ...x,
        contacts: isNew ? [...x.contacts, saved] : x.contacts.map((c) => (c.id === saved.id ? saved : c)),
      }))
    },

    saveAgreement(id, agreement, reason, actor) {
      if (!canChangePricing(actor.role)) return deny('Only a manager can change a company agreement.')
      if (!reason.trim()) return deny('Give a reason for the change.')
      if (agreement.validTo < agreement.validFrom) return deny('The agreement ends before it starts.')
      return change(id, actor, 'Agreement changed', reason, (x) => ({ ...x, agreement }))
    },

    getPolicy: () => Promise.resolve(policy),

    setPolicy(next, actor) {
      if (!roleCan(actor.role, 'changeSettings')) return deny('Only the owner or hotel admin can change this.')
      if (next.accountApproval.length === 0) return deny('At least one approval is needed to open an account.')
      policy = next
      emit()
      return Promise.resolve()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
