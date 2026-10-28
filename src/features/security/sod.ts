import { USERS } from '../../lib/roles'
import type { User } from '../../lib/roles'
import type { ApprovalRecord } from '../../lib/approvals'
import { effectiveGrant } from '../../services/security/catalog'
import type { RolePermission, SodRule, UserRole } from '../../services/security/securityTypes'

export interface SodConflict {
  rule: SodRule
  user: User
  userRole: UserRole
}

/** Every person whose role, after the hotel's changes, holds both halves of an enabled rule. */
export function sodConflicts(rules: SodRule[], userRoles: UserRole[], overrides: RolePermission[]): SodConflict[] {
  const out: SodConflict[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    for (const ur of userRoles) {
      const user = USERS.find((u) => u.id === ur.userId)
      if (!user) continue
      if (effectiveGrant(ur.roleId, rule.permissionA, overrides) && effectiveGrant(ur.roleId, rule.permissionB, overrides)) out.push({ rule, user, userRole: ur })
    }
  }
  return out
}

/** Approvals in the record where the person who asked is also the person who signed. */
export function selfApprovals(records: ApprovalRecord[]): ApprovalRecord[] {
  return records.filter((r) => r.approvers.some((a) => a.name.trim().toLowerCase() === r.requestedBy.trim().toLowerCase()))
}
