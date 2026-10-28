import { APPROVER_ROLES } from '../../lib/approvals'
import { pathAllowed, roleById } from '../../lib/roles'
import type { Action, RoleId } from '../../lib/roles'
import type { Permission, PermissionVerb, RolePermission, SensitiveField } from './securityTypes'

// The functions the role matrix lists, and what the built-in roles table (src/lib/roles.ts) gives
// each role by default. A tenant's overrides sit on top of this; the roles table itself never changes.

export const PERMISSIONS: Permission[] = [
  { id: 'reservations', module: 'Front desk', label: 'Reservations', path: '/desk/reservations', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'folios', module: 'Front desk', label: 'Folios and charges', path: '/desk/folios', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'refunds', module: 'Front desk', label: 'Refunds and reversals', path: '/desk/folios', verbs: ['view', 'create', 'approve'] },
  { id: 'discounts', module: 'Front desk', label: 'Discounts and rate overrides', path: '/desk/reservations', verbs: ['view', 'create', 'approve'] },
  { id: 'guests', module: 'Front desk', label: 'Guest profiles', path: '/desk/guests', verbs: ['view', 'create', 'edit'] },
  { id: 'housekeeping', module: 'Housekeeping', label: 'Rooms and tasks', path: '/housekeeping', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'maintenance', module: 'Maintenance', label: 'Work orders', path: '/maintenance', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'pos', module: 'POS', label: 'Orders and voids', path: '/pos', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'stock', module: 'Inventory', label: 'Stock and adjustments', path: '/inventory', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'suppliers', module: 'Procurement', label: 'Suppliers', path: '/procurement/suppliers', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'invoices', module: 'Procurement', label: 'Purchase orders and invoices', path: '/procurement', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'payroll', module: 'HR and accounting', label: 'Payroll', path: '/hr/payroll', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'ledger', module: 'HR and accounting', label: 'Journal entries', path: '/hr/ledger', verbs: ['view', 'create', 'edit', 'approve'] },
  { id: 'rates', module: 'Admin', label: 'Rates and policies', path: '/admin/policies', verbs: ['view', 'edit', 'approve'] },
  { id: 'settings', module: 'Admin', label: 'Hotel settings', path: '/admin', verbs: ['view', 'edit'] },
  { id: 'security', module: 'Admin', label: 'Security and roles', path: '/admin/security', verbs: ['view', 'edit', 'approve'] },
]

export const VERB_LABEL: Record<PermissionVerb, string> = { view: 'View', create: 'Create', edit: 'Edit', approve: 'Approve' }

export const permissionKey = (id: string, verb: PermissionVerb) => `${id}.${verb}`

export function permissionLabel(key: string): string {
  const [id, verb] = key.split('.') as [string, PermissionVerb]
  const p = PERMISSIONS.find((x) => x.id === id)
  return p ? `${p.label}: ${VERB_LABEL[verb]?.toLowerCase() ?? verb}` : key
}

export const ALL_PERMISSION_KEYS = PERMISSIONS.flatMap((p) => p.verbs.map((v) => permissionKey(p.id, v)))

const approvers = new Set<RoleId>(APPROVER_ROLES.manager)

/** What the built-in roles table gives a role, before any tenant override. */
export function defaultGrant(roleId: RoleId, id: string, verb: PermissionVerb): boolean {
  const role = roleById(roleId)
  if (!role || roleId === 'platform') return false
  const p = PERMISSIONS.find((x) => x.id === id)
  if (!p || !p.verbs.includes(verb)) return false
  const can = (a: Action) => role.actions.includes(a)
  const open = pathAllowed(role, p.path)
  const by = (list: RoleId[]) => list.includes(roleId)
  let create = open
  let edit = open
  let approve = false
  switch (id) {
    case 'reservations':
    case 'folios':
    case 'discounts':
      approve = approvers.has(roleId)
      break
    case 'refunds':
      approve = approvers.has(roleId)
      edit = false
      break
    case 'guests':
      break
    case 'housekeeping':
    case 'maintenance':
      approve = open && can('endorseRequest')
      break
    case 'pos':
      approve = open && by(['owner', 'admin', 'gm'])
      break
    case 'stock':
      create = open && (can('manageStock') || can('storeKeep'))
      edit = create
      approve = can('approveRequest')
      break
    case 'suppliers':
      create = open && (can('purchase') || can('changeSettings') || can('manageStock'))
      edit = create
      approve = can('approveRequest')
      break
    case 'invoices':
      create = open && (can('purchase') || can('markBought'))
      edit = create
      approve = can('approveRequest') || can('approveOverBudget')
      break
    case 'payroll':
      create = open && by(['owner', 'admin', 'finance'])
      edit = create
      approve = by(['owner', 'finance'])
      break
    case 'ledger':
      create = open && by(['owner', 'finance'])
      edit = create
      approve = by(['owner', 'finance'])
      break
    case 'rates':
      edit = open && (can('changeSettings') || by(['gm']))
      approve = by(['owner', 'gm'])
      break
    case 'settings':
      edit = open && can('changeSettings')
      break
    case 'security':
      edit = open && can('changeSettings')
      approve = by(['owner'])
      break
  }
  const map: Record<PermissionVerb, boolean> = { view: open || approve, create, edit, approve }
  return map[verb]
}

/** The role's permission after the tenant's overrides. */
export function effectiveGrant(roleId: RoleId, key: string, overrides: RolePermission[]): boolean {
  const o = overrides.find((x) => x.roleId === roleId && x.permissionKey === key)
  if (o) return o.granted
  const [id, verb] = key.split('.') as [string, PermissionVerb]
  return defaultGrant(roleId, id, verb)
}

export const SENSITIVE_FIELDS: { field: SensitiveField; label: string; sample: string }[] = [
  { field: 'guestIdNumber', label: 'Guest ID number', sample: 'CM92014105XKLA' },
  { field: 'lifetimeSpend', label: 'Lifetime spend', sample: 'UGX 4,530,000' },
  { field: 'cardLast4', label: 'Card last 4', sample: '•••• 4242' },
  { field: 'salary', label: 'Salary', sample: 'UGX 1,850,000' },
]

/** Who sees each sensitive field before the hotel changes it. */
export function defaultVisible(field: SensitiveField, roleId: RoleId): boolean {
  const role = roleById(roleId)
  if (!role) return false
  switch (field) {
    case 'guestIdNumber':
      return role.actions.includes('seeGuestRecord') || roleId === 'frontdesk'
    case 'lifetimeSpend':
      return role.actions.includes('seeGuestRecord')
    case 'cardLast4':
      return ['owner', 'admin', 'gm', 'finance', 'frontdesk'].includes(roleId)
    case 'salary':
      return ['owner', 'admin', 'finance'].includes(roleId)
  }
}

/** How a sensitive value reads to someone who may not see it. */
export function maskValue(field: SensitiveField, value: string): string {
  if (field === 'lifetimeSpend' || field === 'salary') return 'UGX •••••••'
  if (field === 'cardLast4') return '•••• ••••'
  const v = value.replace(/\s/g, '')
  return v.length <= 4 ? '••••' : `${v.slice(0, 2)}${'•'.repeat(Math.max(4, v.length - 4))}${v.slice(-2)}`
}
