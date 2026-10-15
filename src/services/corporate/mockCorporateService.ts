import { sampleAccounts } from '../../data/corporate'
import { ACCOUNT_APPROVAL, canChangePricing, canSetCredit, contactRightsProblem, offersCredit, stampNow, STEP_LABEL } from '../../lib/corporate'
import { ugx } from '../../lib/format'
import { roleCan } from '../../lib/roles'
import type { CorporateService } from './corporateService'
import type { CorporateAccount, CorporateActor } from './corporateTypes'

// In-memory company accounts for the prototype. Not saved and not shared. It applies the same
// permission checks the backend must apply, so the screens can be tested against them.
export function createMockCorporateService(): CorporateService {
  let accounts = sampleAccounts()
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

  const isManager = (actor: CorporateActor) => roleCan(actor.role, 'approveCorporateManager')

  return {
    listAccounts: () => Promise.resolve(accounts.map((a) => ({ ...a }))),

    requestAccount(input, actor) {
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
      const asked = input.requestedCreditLimit
        ? `Asked for ${ugx(input.requestedCreditLimit)} credit, ${input.paymentTerms}. Credit is set separately after approval.`
        : `Asked for ${input.paymentTerms}`
      const created: CorporateAccount = {
        ...input,
        id: `CA-${String(counter).padStart(3, '0')}`,
        name: input.name.trim(),
        tin: input.tin.trim(),
        status: 'pending',
        // No credit until the credit approver sets it. The request is kept for them to decide.
        paymentTerms: 'prepaid',
        creditLimit: 0,
        requestedCreditLimit: input.requestedCreditLimit || undefined,
        outstandingBalance: 0,
        contacts: input.contacts.map((c, i) => ({ ...c, id: `CC-${Date.now()}-${i}` })),
        requiredSteps: [...ACCOUNT_APPROVAL],
        approvals: [],
        createdAt: now,
        createdBy: person(actor),
        history: [{ at: now, by: person(actor), action: 'Account requested', detail: asked }],
      }
      accounts = [created, ...accounts]
      emit()
      return Promise.resolve(created)
    },

    approveAccount(id, note, actor) {
      const a = accounts.find((x) => x.id === id)
      if (!a) return deny('Account not found')
      if (a.status !== 'pending') return deny('This account is not waiting for approval.')
      if (!isManager(actor)) return deny('Only a manager can approve a company account.')
      if (a.createdBy.id === actor.id) return deny('You requested this account, so another manager must approve it.')
      const credit = a.requestedCreditLimit
        ? `Credit of ${ugx(a.requestedCreditLimit)} is not set yet. ${STEP_LABEL.finance} sets it under Credit.`
        : ''
      const detail = [note.trim(), credit].filter(Boolean).join(' ')
      return change(id, actor, 'Approved', detail || undefined, (x) => ({
        ...x,
        status: 'active',
        approvals: [...x.approvals, { step: 'manager', by: person(actor), at: stampNow(), note: note.trim() || undefined }],
      }))
    },

    declineAccount(id, reason, actor) {
      if (!isManager(actor)) return deny('Only a manager can decline an account.')
      if (!reason.trim()) return deny('Give a reason.')
      return change(id, actor, 'Declined', reason, (x) => ({ ...x, status: 'declined', statusReason: reason }))
    },

    setStatus(id, status, reason, actor) {
      if (!isManager(actor)) return deny('Only a manager can change an account status.')
      const a = accounts.find((x) => x.id === id)
      if (!a) return deny('Account not found')
      if (a.status === 'pending' || a.status === 'declined') return deny('Approve the account first.')
      if (status !== 'active' && !reason.trim()) return deny('Give a reason.')
      const label = { active: 'Reactivated', 'on-hold': 'Put on hold', suspended: 'Suspended', closed: 'Closed' }[status]
      return change(id, actor, label, reason || undefined, (x) => ({ ...x, status, statusReason: status === 'active' ? undefined : reason }))
    },

    setCredit(id, creditLimit, paymentTerms, reason, pol, actor) {
      if (!canSetCredit(actor.role, pol)) return deny(`Only ${STEP_LABEL[pol.creditApprover]} can set credit for this hotel.`)
      if (creditLimit < 0) return deny('Credit cannot be negative.')
      if (creditLimit > 0 && !offersCredit(paymentTerms)) return deny('Credit needs invoice terms (15, 30 or 60 days).')
      if (!reason.trim()) return deny('Give a reason for the change.')
      return change(id, actor, 'Credit set', `${ugx(creditLimit)}, ${paymentTerms}. ${reason}`, (x) => ({
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
      if (!canChangePricing(actor.role)) return deny('Only a manager can set company prices.')
      if (!reason.trim()) return deny('Give a reason for the change.')
      if (agreement.validTo < agreement.validFrom) return deny('The agreement ends before it starts.')
      const prior = accounts.find((a) => a.id === id)?.agreement
      return change(id, actor, prior ? 'Prices changed' : 'Agreement added', reason, (x) => ({ ...x, agreement }))
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
