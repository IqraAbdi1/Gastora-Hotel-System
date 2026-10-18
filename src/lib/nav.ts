import type { BadgeKind } from '../components/NavBadge'
import type { IconName } from '../components/NavIcon'
import type { FeatureKey, FeatureMap } from './features'

export type NavPage = {
  to: string
  label: string
  end?: boolean
  badge?: BadgeKind
  /** Page only shows when the hotel has this feature. */
  feature?: FeatureKey
  /** Page the hotel itself can switch off in its settings. */
  option?: 'nightAudit'
  /** Optional small icon in front of the page name. */
  icon?: IconName
}
export type NavModule = { id: string; label: string; icon: IconName; to: string; pages: NavPage[] }

function module(id: string, label: string, icon: IconName, pages: NavPage[]): NavModule {
  return { id, label, icon, to: pages[0].to, pages }
}

export const modules: NavModule[] = [
  module('overview', 'Overview', 'overview', [
    { to: '/dashboard', label: 'Dashboard', end: true },
    { to: '/waiting', label: 'Waiting for me', badge: 'waiting' },
  ]),
  module('frontdesk', 'Front desk', 'frontdesk', [
    { to: '/desk', label: 'Today', end: true },
    { to: '/desk/reservations', label: 'Reservations' },
    { to: '/desk/rooms', label: 'Rooms' },
    { to: '/desk/folios', label: 'Folios' },
    { to: '/desk/groups', label: 'Groups', feature: 'groups' },
    { to: '/desk/sister-properties', label: 'Sister properties', feature: 'crossProperty' },
    { to: '/desk/companies', label: 'Companies', badge: 'companies' },
    { to: '/desk/messages', label: 'Guest messages', feature: 'guestMessages' },
    { to: '/desk/waiting-list', label: 'Waiting list', feature: 'waitlist' },
    { to: '/desk/documents', label: 'Guest documents' },
    { to: '/desk/lost-found', label: 'Lost and found' },
    { to: '/desk/night-audit', label: 'Night audit', option: 'nightAudit' },
  ]),
  module('housekeeping', 'Housekeeping', 'housekeeping', [
    { to: '/housekeeping', label: 'Rooms', end: true, badge: 'toClean' },
    { to: '/housekeeping/tasks', label: 'Tasks', badge: 'openTasks' },
    { to: '/housekeeping/my-tasks', label: 'My tasks' },
    { to: '/housekeeping/roster', label: 'Roster and record' },
    { to: '/housekeeping/inspections', label: 'Inspections', badge: 'toInspect', feature: 'inspections' },
    { to: '/housekeeping/issues', label: 'Issues', badge: 'issues' },
    { to: '/housekeeping/lost-found', label: 'Lost and found' },
    { to: '/housekeeping/supplies', label: 'Supplies', feature: 'requests' },
  ]),
  module('maintenance', 'Maintenance', 'maintenance', [
    { to: '/maintenance', label: 'Work orders', end: true, badge: 'workOrders' },
    { to: '/maintenance/out-of-order', label: 'Rooms out of order', feature: 'maintenanceFull' },
    { to: '/maintenance/supplies', label: 'Supplies', feature: 'requests' },
  ]),
  module('pos', 'POS', 'pos', [
    { to: '/pos', label: 'Menus', end: true },
    { to: '/pos/orders', label: 'Orders' },
    { to: '/kitchen', label: 'Kitchen display' },
    { to: '/pos/menu', label: 'Menu management' },
    { to: '/pos/recipes', label: 'Recipe & inventory mapping' },
  ]),
  module('inventory', 'Inventory', 'inventory', [
    { to: '/inventory/requests', label: 'Store requests', feature: 'supplyChain', badge: 'storeRequests', icon: 'procurement' },
    { to: '/procurement/requests', label: 'Supply requests', feature: 'requests', badge: 'requests' },
    { to: '/inventory', label: 'Stock', end: true, feature: 'stockControl' },
    { to: '/inventory/receipts', label: 'Receipts', feature: 'stockControl' },
    { to: '/inventory/counts', label: 'Stock counts', feature: 'stockControl' },
    { to: '/inventory/losses', label: 'Damaged & lost', feature: 'lossReports', badge: 'losses' },
    { to: '/inventory/movements', label: 'Movements', feature: 'stockControl' },
  ]),
  module('procurement', 'Procurement', 'procurement', [
    { to: '/procurement', label: 'Purchase orders', end: true, feature: 'supplyChain' },
    { to: '/procurement/audit', label: 'Audit log', feature: 'supplyChain' },
    { to: '/procurement/suppliers', label: 'Suppliers', feature: 'supplyChain' },
  ]),
  module('hr', 'HR & Accounting', 'hr', [
    { to: '/hr', label: 'Staff', end: true },
    { to: '/hr/payroll', label: 'Payroll' },
    { to: '/hr/ledger', label: 'Ledger' },
    { to: '/finance', label: 'Finance approvals', feature: 'budgetApproval', badge: 'financeRequests' },
  ]),
  module('admin', 'Admin', 'admin', [
    { to: '/admin', label: 'Hotel settings', end: true },
    { to: '/admin/taxes', label: 'Taxes and EFRIS', feature: 'taxLines' },
    { to: '/admin/approvals', label: 'Approvals to review' },
    { to: '/admin/policies', label: 'Rates and policies' },
  ]),
]

// Separate apps, not hotel modules.
export const otherApps = [
  { to: '/guest', label: 'Guest portal' },
  { to: '/platform', label: 'Platform admin' },
]

// The modules and pages this hotel has paid for AND this role may open.
export function visibleModules(
  features: FeatureMap,
  canOpen: (pathname: string) => boolean = () => true,
  options?: { nightAudit: boolean },
): NavModule[] {
  return modules
    .map((m) => ({
      ...m,
      pages: m.pages.filter(
        (p) =>
          (!p.feature || features[p.feature]) &&
          (!p.option || !options || options[p.option]) &&
          canOpen(p.to),
      ),
    }))
    .filter((m) => m.pages.length > 0)
    .map((m) => ({ ...m, to: m.pages[0].to }))
}

// The module a page belongs to, so its group opens by itself.
export function moduleOf(pathname: string) {
  return modules.find((m) => m.pages.some((p) => pathname === p.to || pathname.startsWith(`${p.to}/`)))
}