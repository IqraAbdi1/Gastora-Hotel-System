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
    { to: '/manager', label: 'Manager' },
  ]),
  module('frontdesk', 'Front desk', 'frontdesk', [
    { to: '/desk', label: 'Today', end: true },
    { to: '/desk/reservations', label: 'Reservations' },
    { to: '/desk/rooms', label: 'Rooms' },
    { to: '/desk/folios', label: 'Folios' },
  ]),
  module('housekeeping', 'Housekeeping', 'housekeeping', [
    { to: '/housekeeping', label: 'Rooms', end: true, badge: 'toClean' },
    { to: '/housekeeping/tasks', label: 'Tasks', badge: 'openTasks' },
    { to: '/housekeeping/my-rooms', label: 'My rooms' },
    { to: '/housekeeping/inspections', label: 'Inspections', badge: 'toInspect', feature: 'inspections' },
    { to: '/housekeeping/issues', label: 'Issues', badge: 'issues' },
    { to: '/housekeeping/supplies', label: 'Supplies', feature: 'requests' },
  ]),
  module('maintenance', 'Maintenance', 'maintenance', [
    { to: '/maintenance', label: 'Work orders', end: true, badge: 'workOrders' },
    { to: '/maintenance/out-of-order', label: 'Rooms out of order', feature: 'maintenanceFull' },
    { to: '/maintenance/supplies', label: 'Supplies', feature: 'requests' },
  ]),
  module('pos', 'POS', 'pos', [
    { to: '/pos', label: 'Tables', end: true },
    { to: '/pos/orders', label: 'Orders' },
    { to: '/pos/menu', label: 'Menu management' },
    { to: '/pos/recipes', label: 'Recipe & inventory mapping' },
  ]),
  module('inventory', 'Inventory', 'inventory', [
    { to: '/inventory/requests', label: 'Store requests', feature: 'supplyChain', badge: 'storeRequests', icon: 'procurement' },
    { to: '/inventory', label: 'Stock', end: true, feature: 'stockControl' },
    { to: '/inventory/receipts', label: 'Receipts', feature: 'stockControl' },
    { to: '/inventory/counts', label: 'Stock counts', feature: 'stockControl' },
    { to: '/inventory/losses', label: 'Damaged & lost', feature: 'lossReports', badge: 'losses' },
    { to: '/inventory/movements', label: 'Movements', feature: 'stockControl' },
  ]),
  module('procurement', 'Procurement', 'procurement', [
    { to: '/procurement/requests', label: 'Requests', feature: 'requests', badge: 'requests' },
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
    { to: '/admin/staff', label: 'Staff and roles' },
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
): NavModule[] {
  return modules
    .map((m) => ({
      ...m,
      pages: m.pages.filter((p) => (!p.feature || features[p.feature]) && canOpen(p.to)),
    }))
    .filter((m) => m.pages.length > 0)
    .map((m) => ({ ...m, to: m.pages[0].to }))
}

// The module a page belongs to, so its group opens by itself.
export function moduleOf(pathname: string) {
  return modules.find((m) => m.pages.some((p) => pathname === p.to || pathname.startsWith(`${p.to}/`)))
}