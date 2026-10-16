import type { PlanId } from './features'
import type { RoleId, User } from './roles'

// Who may approve money being taken off a folio, and up to how much. Rules, not AI.
// A real hotel uses an approval ladder: the bigger the amount, the more senior the person.
// The PIN says who approved; the photo says who was standing there; the daily review means someone looks.

export type ApprovalLevel = 'manager' | 'finance' | 'executive'

export interface ApprovalLimits {
  /** Up to this, a manager may approve: a minibar item, a laundry charge, a small fee. */
  manager: number
  /** Up to this, finance may approve: a room night or two, a billing error. */
  finance: number
  /** Above the finance limit, two people must sign: the owner and finance. */
  coSignAbove: number
  /** Whether the approver's photo must be taken. Always true on the Large plan. */
  photoRequired: boolean
}

// Sample amounts in shillings, for a hotel whose rooms are UGX 150,000 to 350,000 a night.
// Each hotel sets its own in Hotel settings.
export const DEFAULT_LIMITS: ApprovalLimits = {
  manager: 200000,
  finance: 2000000,
  coSignAbove: 10000000,
  photoRequired: false,
}

/**
 * How senior each role is. A limit is a ceiling, not an exact band: anyone senior enough may approve a
 * smaller amount, so finance can still clear a minibar dispute. Gastora has no duty manager, so the
 * general manager holds the first band.
 */
export const SENIORITY: Partial<Record<RoleId, number>> = {
  gm: 1,
  admin: 1,
  finance: 2,
  owner: 3,
}

export const LEVEL_RANK: Record<ApprovalLevel, number> = { manager: 1, finance: 2, executive: 2 }

/** Roles that may approve at each level, from the seniority above. */
export const APPROVER_ROLES: Record<ApprovalLevel, RoleId[]> = {
  manager: ['gm', 'admin', 'finance', 'owner'],
  finance: ['finance', 'owner'],
  executive: ['finance', 'owner'],
}

export const LEVEL_LABEL: Record<ApprovalLevel, string> = {
  manager: 'General manager',
  finance: 'Finance',
  executive: 'Owner and Finance together',
}

export interface ApprovalNeed {
  level: ApprovalLevel
  /** Two different people must approve. */
  coSign: boolean
  roles: RoleId[]
  label: string
  /** Why this level, in words the front desk can read out. */
  because: string
}

/**
 * Which approval an amount needs. A small hotel has fewer steps than a large one:
 * Starter has one band (the owner), Standard two, Large the full ladder with a co-signature.
 */
export function approvalFor(amount: number, limits: ApprovalLimits, plan: PlanId): ApprovalNeed {
  const money = (n: number) => `UGX ${n.toLocaleString('en-US')}`

  if (plan === 'starter') {
    const level: ApprovalLevel = amount <= limits.manager ? 'manager' : 'finance'
    return {
      level,
      coSign: false,
      roles: level === 'manager' ? APPROVER_ROLES.manager : ['owner'],
      label: level === 'manager' ? 'Manager' : 'Owner',
      because:
        level === 'manager'
          ? `Up to ${money(limits.manager)} a manager may approve.`
          : `Above ${money(limits.manager)} the owner must approve.`,
    }
  }

  if (amount <= limits.manager) {
    return {
      level: 'manager',
      coSign: false,
      roles: APPROVER_ROLES.manager,
      label: LEVEL_LABEL.manager,
      because: `Up to ${money(limits.manager)} a manager may approve.`,
    }
  }

  if (plan === 'standard' || amount <= limits.finance) {
    return {
      level: 'finance',
      coSign: false,
      roles: APPROVER_ROLES.finance,
      label: LEVEL_LABEL.finance,
      because: `Above ${money(limits.manager)} finance must approve.`,
    }
  }

  if (amount <= limits.coSignAbove) {
    return {
      level: 'finance',
      coSign: false,
      roles: APPROVER_ROLES.finance,
      label: LEVEL_LABEL.finance,
      because: `Above ${money(limits.manager)} finance must approve.`,
    }
  }

  return {
    level: 'executive',
    coSign: true,
    roles: APPROVER_ROLES.executive,
    label: LEVEL_LABEL.executive,
    because: `Above ${money(limits.coSignAbove)} two people must approve: the owner and finance.`,
  }
}

/** Sample PINs. In the real system each person sets their own and it is never stored in the browser. */
export const SAMPLE_PINS: Record<string, string> = {
  'u-owner': '1111',
  'u-admin': '2222',
  'u-gm': '3333',
  'u-finance': '4444',
}

export type PinResult = { ok: true; user: User } | { ok: false; why: string }

/** Checks a PIN against the people allowed to approve at this level. */
export function checkPin(pin: string, need: ApprovalNeed, users: User[], alreadyUsed: string[] = []): PinResult {
  const clean = pin.trim()
  if (clean.length < 4) return { ok: false, why: 'A PIN is four digits.' }
  const match = users.find((u) => SAMPLE_PINS[u.id] === clean)
  if (!match) return { ok: false, why: 'That PIN is not recognised.' }
  if (alreadyUsed.includes(match.id)) return { ok: false, why: `${match.name} has already signed. The second approval must be someone else.` }
  const rank = SENIORITY[match.role] ?? 0
  if (rank < LEVEL_RANK[need.level])
    return { ok: false, why: `${match.name} cannot approve this amount. ${need.because}` }
  return { ok: true, user: match }
}

/** One approval, kept so the manager can review the day's reversals and releases. */
export interface ApprovalRecord {
  id: string
  at: string
  /** What was approved. */
  kind: 'charge-reversal' | 'valuable-release'
  what: string
  amount?: number
  /** Who asked for it. */
  requestedBy: string
  reason: string
  /** Who approved, from the PIN. */
  approvers: { name: string; role: RoleId; photo?: string }[]
  level: ApprovalLevel
  /** Set when the hotel allows skipping the photo and no camera was available. */
  photoSkipped?: boolean
  reservationId?: string
}
