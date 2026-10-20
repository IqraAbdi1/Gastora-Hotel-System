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
  /** Used less often: folded under "More" in the menu until it is the page you are on. */
  more?: boolean
}
export type NavModule = { id: string; label: string; icon: IconName; to: string; pages: NavPage[] }

// The menu reads in three parts, the way a hotel is run: the guest side, the back of house, and the
// business. Nothing is hidden by this; it only puts headings between the modules.
export const SECTIONS: { label: string | null; modules: string[] }[] = [
  { label: null, modules: ['overview'] },
  // Area G: 'events' after frontdesk
  { label: 'Guests', modules: ['frontdesk', 'events'] },
  { label: 'Operations', modules: ['housekeeping', 'maintenance', 'pos', 'inventory', 'procurement'] },
  // Area K adds 'reports', Area H 'accounting', Area L 'automation'
  { label: 'Business', modules: ['reports', 'accounting', 'hr', 'automation', 'admin'] },
]

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
    { to: '/desk/groups', label: 'Groups', feature: 'groups', more: true },
    { to: '/desk/sister-properties', label: 'Sister properties', feature: 'crossProperty', more: true },
    { to: '/desk/guests', label: 'Guest profiles' },
    { to: '/desk/feedback', label: 'Guest feedback', more: true },
    { to: '/desk/companies', label: 'Corporate accounts', badge: 'companies' },
    { to: '/desk/agents', label: 'Travel agents', feature: 'travelAgents', more: true },
    { to: '/desk/messages', label: 'Guest messages', feature: 'guestMessages', more: true },
    { to: '/desk/waiting-list', label: 'Waitlist', feature: 'waitlist', more: true },
    { to: '/desk/documents', label: 'Guest documents', more: true },
    { to: '/desk/lost-found', label: 'Lost and found', more: true },
    { to: '/desk/night-audit', label: 'Night audit', option: 'nightAudit', more: true },
  ]),
  // Area G: events, banqueting and sales
  module('events', 'Events and sales', 'events', [
    { to: '/events', label: 'Pipeline', end: true, feature: 'eventsSales' },
    { to: '/events/diary', label: 'Function diary', feature: 'eventsBasic' },
    { to: '/events/bookings', label: 'Events and BEOs', feature: 'eventsBasic' },
    { to: '/events/quotes', label: 'Quotes and contracts', feature: 'eventsSales' },
    { to: '/events/billing', label: 'Billing and profit', feature: 'eventsBasic' },
    { to: '/events/setup', label: 'Spaces and packages', feature: 'eventsBasic', more: true },
  ]),
  module('housekeeping', 'Housekeeping', 'housekeeping', [
    { to: '/housekeeping', label: 'Room status', end: true, badge: 'toClean' },
    { to: '/housekeeping/tasks', label: 'Tasks', badge: 'openTasks' },
    { to: '/housekeeping/my-tasks', label: 'My tasks' },
    { to: '/housekeeping/roster', label: 'Attendant roster' },
    { to: '/housekeeping/inspections', label: 'Inspections', badge: 'toInspect', feature: 'inspections' },
    { to: '/housekeeping/issues', label: 'Issues', badge: 'issues' },
    { to: '/housekeeping/room-check', label: 'Room check', feature: 'roomCheck', more: true },
    { to: '/housekeeping/lost-found', label: 'Lost and found', more: true },
    { to: '/housekeeping/supplies', label: 'Supplies', feature: 'requests', more: true },
  ]),
  module('maintenance', 'Maintenance', 'maintenance', [
    { to: '/maintenance', label: 'Work orders', end: true, badge: 'workOrders' },
    { to: '/maintenance/out-of-order', label: 'Rooms out of order', feature: 'maintenanceFull' },
    { to: '/maintenance/assets', label: 'Asset register', feature: 'assetRegister' },
    { to: '/maintenance/planned', label: 'Planned work', feature: 'preventiveMaintenance' },
    { to: '/maintenance/engineering', label: 'Engineering', feature: 'engineeringDashboard' },
    { to: '/maintenance/supplies', label: 'Supplies', feature: 'requests' },
  ]),
  module('pos', 'POS', 'pos', [
    { to: '/pos', label: 'Menus', end: true },
    { to: '/pos/orders', label: 'Orders' },
    { to: '/kitchen', label: 'Kitchen display' },
    { to: '/pos/menu', label: 'Menu management' },
    { to: '/pos/recipes', label: 'Recipes and stock' },
    // Area F: POS, F&B and kitchen
    { to: '/pos/floor', label: 'Floor plan', feature: 'posFloorPlan' },
    { to: '/pos/food-cost', label: 'Food cost', feature: 'foodCost' },
    { to: '/pos/payments', label: 'Payments', more: true },
    { to: '/pos/outlets', label: 'Outlets and add-ons', more: true },
  ]),
  module('inventory', 'Inventory', 'inventory', [
    { to: '/inventory/requests', label: 'Store requests', feature: 'supplyChain', badge: 'storeRequests', icon: 'procurement' },
    { to: '/procurement/requests', label: 'Supply requests', feature: 'requests', badge: 'requests' },
    { to: '/inventory', label: 'Stock', end: true, feature: 'stockControl' },
    { to: '/inventory/receipts', label: 'Goods received', feature: 'stockControl' },
    { to: '/inventory/counts', label: 'Stock counts', feature: 'stockControl' },
    { to: '/inventory/losses', label: 'Damage and loss', feature: 'lossReports', badge: 'losses' },
    { to: '/inventory/movements', label: 'Stock movements', feature: 'stockControl' },
    // Area I
    { to: '/inventory/transfers', label: 'Store transfers', feature: 'storeTransfers' },
    { to: '/inventory/analytics', label: 'Cost control', feature: 'costAnalytics' },
  ]),
  module('procurement', 'Procurement', 'procurement', [
    { to: '/procurement', label: 'Purchase orders', end: true, feature: 'supplyChain' },
    { to: '/procurement/audit', label: 'Audit log', feature: 'supplyChain' },
    { to: '/procurement/suppliers', label: 'Suppliers', feature: 'supplyChain' },
    // Area I
    { to: '/procurement/rfqs', label: 'Quotations', feature: 'rfq' },
    { to: '/procurement/invoices', label: 'Supplier invoices', feature: 'invoiceMatching' },
    { to: '/procurement/contracts', label: 'Supplier contracts', feature: 'supplierContracts' },
  ]),
  // Area K: management reports
  module('reports', 'Reports', 'reports', [
    { to: '/reports', label: 'Executive', end: true, feature: 'reportsBasic' },
    { to: '/reports/departments', label: 'Departments', feature: 'departmentDashboards' },
    { to: '/reports/library', label: 'Report library', feature: 'reportsBasic' },
    { to: '/reports/portfolio', label: 'Compare', feature: 'reportsBasic' },
    { to: '/reports/ask', label: 'Ask', feature: 'analyticsAssistant' },
  ]),
  // J. Workforce and service management: the people pages
  module('hr', 'People', 'hr', [
    { to: '/hr', label: 'Staff', end: true, feature: 'staffRoster' },
    { to: '/hr/rosters', label: 'Shifts and rosters', feature: 'staffRoster' },
    { to: '/hr/attendance', label: 'Attendance', feature: 'attendance' },
    { to: '/hr/tasks', label: 'Tasks', feature: 'taskSla' },
    { to: '/hr/cases', label: 'Service cases', feature: 'staffRoster' },
    { to: '/hr/payroll', label: 'Payroll handoff', feature: 'payrollHandoff' },
  ]),
  // Area H: Finance and hotel accounting (Trademate link)
  module('accounting', 'Accounting', 'accounting', [
    { to: '/accounting', label: 'Overview', end: true, feature: 'accountingLink' },
    { to: '/accounting/night-audit', label: 'Night audit', feature: 'accountingLink' },
    { to: '/accounting/posting-rules', label: 'Posting rules', feature: 'accountingLink' },
    { to: '/accounting/journals', label: 'Journals', feature: 'accountingLink' },
    { to: '/accounting/city-ledger', label: 'City ledger', feature: 'accountingLink' },
    { to: '/accounting/currencies', label: 'Currencies', feature: 'multiCurrency' },
    { to: '/accounting/budgets', label: 'Budgets and centres', feature: 'budgetsCentres' },
    { to: '/finance', label: 'Finance approvals', feature: 'budgetApproval', badge: 'financeRequests' },
  ]),
  module('admin', 'Admin', 'admin', [
    { to: '/admin', label: 'Hotel settings', end: true },
    { to: '/admin/taxes', label: 'Taxes and EFRIS', feature: 'taxLines' },
    { to: '/admin/approvals', label: 'Approvals' },
    { to: '/admin/policies', label: 'Rates and policies' },
    { to: '/admin/revenue', label: 'Revenue management', feature: 'revenue' },
    { to: '/admin/channels', label: 'Channel manager', feature: 'channels' },
    // Area M: compliance, security and controls
    { to: '/admin/security/roles', label: 'Roles and permissions', feature: 'securityBasic' },
    { to: '/admin/security/sign-in', label: 'Sign-in and devices', feature: 'securityBasic', more: true },
    { to: '/admin/security/audit', label: 'Audit trail', feature: 'securityBasic' },
    { to: '/admin/security/payments', label: 'Payment security', feature: 'securityBasic', more: true },
    { to: '/admin/security/privacy', label: 'Privacy', feature: 'securityBasic', more: true },
    { to: '/admin/security/fiscal', label: 'Fiscal connectors', feature: 'securityBasic', more: true },
  ]),
  // Area L: AI and automation layer.
  module('automation', 'Automation', 'automation', [
    { to: '/automation/insights', label: 'Insights', feature: 'anomalyDetection' },
    { to: '/automation/concierge', label: 'Concierge', feature: 'aiConcierge' },
    { to: '/automation/guests', label: 'Guest insights', feature: 'guestSegments' },
    { to: '/automation/operations', label: 'Operations', feature: 'opsPrioritization' },
    { to: '/automation/workflows', label: 'Workflows', feature: 'workflowAutomation' },
  ]),
]

// Separate apps, not hotel modules.
export const otherApps = [
  // The hotel's own booking page, as a guest meets it. The wider guest portal is not built yet, so this
  // points at what exists rather than at a placeholder saying the words.
  { to: '/book', label: 'Booking page', feature: 'bookingEngine' },
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
// The page a path belongs to, for the breadcrumb in the top bar. The longest match wins, so
// /desk/guests/g1 names Guest profiles rather than Today.
// Screens reached from a button rather than the menu, so the top bar can still name them.
const offMenu: NavPage[] = [{ to: '/desk/new-reservation', label: 'New reservation' }]

export function pageOf(pathname: string): NavPage | undefined {
  let best: NavPage | undefined
  for (const p of [...modules.flatMap((m) => m.pages), ...offMenu])
    if ((pathname === p.to || (!p.end && pathname.startsWith(`${p.to}/`))) && (!best || p.to.length > best.to.length)) best = p
  return best
}
