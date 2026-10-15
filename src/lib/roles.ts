export type RoleId =
  | 'owner'
  | 'admin'
  | 'gm'
  | 'finance'
  | 'frontdesk'
  | 'reservations'
  | 'hkhead'
  | 'attendant'
  | 'maintenance'
  | 'storekeeper'
  | 'pos'
  | 'procurement'
  | 'sales'
  | 'platform'

// Actions that are more than "can open the page".
export type Action =
  | 'changeSettings'
  | 'raiseRequest'
  | 'endorseRequest'
  | 'approveRequest'
  | 'approveOverBudget'
  | 'markBought'
  | 'storeKeep'
  | 'purchase'
  | 'manageStock'
  | 'countStock'
  /** A department head sends unused stock back to the store. */
  | 'returnStock'

export interface Role {
  id: RoleId
  label: string
  blurb: string
  /** Where this role lands after signing in. */
  landing: string
  /** Page paths this role can open. A path also allows everything under it. */
  allow: string[]
  actions: Action[]
  /** Hotel admin and owner can preview the app as another role. */
  canViewAs?: boolean
}

const ALL_HOTEL = [
  '/dashboard',
  '/manager',
  '/desk',
  '/housekeeping',
  '/maintenance',
  '/pos',
  '/inventory',
  '/procurement',
  '/hr',
  '/finance',
]

// One table for who sees what. The real backend enforces the same table; the screens only hide things.
export const ROLES: Role[] = [
  {
    id: 'owner',
    label: 'Owner',
    blurb: 'Everything, including approvals.',
    landing: '/dashboard',
    allow: [...ALL_HOTEL, '/admin', '/guest'],
    actions: ['changeSettings', 'raiseRequest', 'approveRequest', 'approveOverBudget', 'manageStock', 'countStock'],
    canViewAs: true,
  },
  {
    id: 'admin',
    label: 'Hotel admin',
    blurb: 'Runs the system: settings, staff and roles.',
    landing: '/admin',
    allow: [...ALL_HOTEL, '/admin', '/guest'],
    actions: ['changeSettings', 'raiseRequest', 'manageStock'],
    canViewAs: true,
  },
  {
    id: 'gm',
    label: 'General manager',
    blurb: 'Runs operations and approves requisitions.',
    landing: '/manager',
    allow: ALL_HOTEL,
    actions: ['raiseRequest', 'endorseRequest', 'approveRequest', 'markBought', 'manageStock', 'countStock'],
  },
  {
    id: 'finance',
    label: 'Finance',
    blurb: 'Money, budgets and over-budget approvals.',
    landing: '/finance',
    allow: ['/dashboard', '/hr', '/finance', '/procurement/audit'],
    actions: ['raiseRequest', 'approveOverBudget'],
  },
  {
    id: 'frontdesk',
    label: 'Front desk',
    blurb: 'Arrivals, departures, rooms and folios.',
    landing: '/desk',
    allow: ['/desk'],
    actions: [],
  },
  {
    id: 'reservations',
    label: 'Reservations agent',
    blurb: 'Bookings and availability only.',
    landing: '/desk/reservations',
    allow: ['/desk/reservations', '/desk/rooms', '/desk/new-reservation'],
    actions: [],
  },
  {
    id: 'hkhead',
    label: 'Housekeeping head',
    blurb: 'Runs housekeeping, inspects rooms, endorses supply requests, sends unused stock back.',
    landing: '/housekeeping',
    allow: ['/housekeeping', '/maintenance'],
    actions: ['raiseRequest', 'endorseRequest', 'returnStock'],
  },
  {
    id: 'attendant',
    label: 'Room attendant',
    blurb: 'Cleans rooms, reports problems and asks for supplies.',
    landing: '/housekeeping/my-rooms',
    allow: ['/housekeeping/my-rooms', '/housekeeping/supplies'],
    actions: ['raiseRequest'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    blurb: 'Fixes reported problems, endorses its own supply requests and sends unused stock back.',
    landing: '/maintenance',
    allow: ['/maintenance', '/housekeeping/issues'],
    actions: ['raiseRequest', 'endorseRequest', 'returnStock'],
  },
  {
    id: 'storekeeper',
    label: 'Storekeeper',
    blurb: 'Checks the store, issues items, receives goods and returns, and counts stock.',
    landing: '/inventory/requests',
    allow: ['/inventory'],
    actions: ['storeKeep', 'manageStock'],
  },
  {
    id: 'procurement',
    label: 'Procurement officer',
    blurb: 'Raises purchase orders and buys what management approves.',
    landing: '/procurement/requests',
    allow: ['/procurement'],
    actions: ['raiseRequest', 'markBought', 'purchase'],
  },
  {
    id: 'pos',
    label: 'POS / F&B staff',
    blurb: 'Restaurant and bar. Module not built yet.',
    landing: '/pos',
    allow: ['/pos'],
    actions: [],
  },
  {
    id: 'sales',
    label: 'Sales / events',
    blurb: 'Banqueting. Module not built yet.',
    landing: '/dashboard',
    allow: ['/dashboard'],
    actions: [],
  },
  {
    id: 'platform',
    label: 'Platform admin',
    blurb: 'Gastora staff. Manages hotels and their plans.',
    landing: '/platform',
    allow: ['/platform'],
    actions: [],
  },
]

export const roleById = (id: RoleId): Role => ROLES.find((r) => r.id === id) as Role

export function pathAllowed(role: Role, pathname: string): boolean {
  return role.allow.some((a) => pathname === a || pathname.startsWith(`${a}/`))
}

export interface User {
  id: string
  name: string
  email: string
  role: RoleId
  /** The name used in housekeeping and maintenance lists, where it matches sample staff. */
  staffName?: string
  /** Shown on the demo sign-in page. */
  demo: boolean
}

// Sample accounts. Real ones come from the backend. Any password works in this prototype.
export const USERS: User[] = [
  { id: 'u-owner', name: 'Patricia Owor', email: 'owner@lakeview.demo', role: 'owner', demo: true },
  { id: 'u-admin', name: 'Daniel Kato', email: 'admin@lakeview.demo', role: 'admin', demo: true },
  { id: 'u-gm', name: 'Esther Nambi', email: 'gm@lakeview.demo', role: 'gm', demo: true },
  { id: 'u-finance', name: 'Brian Ssemakula', email: 'finance@lakeview.demo', role: 'finance', demo: true },
  { id: 'u-desk', name: 'Rita Auma', email: 'frontdesk@lakeview.demo', role: 'frontdesk', demo: true },
  { id: 'u-res', name: 'Vivian Achan', email: 'reservations@lakeview.demo', role: 'reservations', demo: true },
  { id: 'u-hk', name: 'Mary Nabirye', email: 'housekeeping@lakeview.demo', role: 'hkhead', staffName: 'Mary', demo: true },
  { id: 'u-att', name: 'Sarah Nanteza', email: 'attendant@lakeview.demo', role: 'attendant', staffName: 'Sarah', demo: true },
  { id: 'u-maint', name: 'Joseph Okia', email: 'maintenance@lakeview.demo', role: 'maintenance', staffName: 'Joseph', demo: true },
  { id: 'u-store', name: 'Peter Mugisha', email: 'storekeeper@lakeview.demo', role: 'storekeeper', demo: true },
  { id: 'u-proc', name: 'Grace Namatovu', email: 'procurement@lakeview.demo', role: 'procurement', demo: true },
  { id: 'u-pos', name: 'Kevin Ocen', email: 'pos@lakeview.demo', role: 'pos', demo: false },
  { id: 'u-sales', name: 'Lydia Akello', email: 'sales@lakeview.demo', role: 'sales', demo: false },
  { id: 'u-platform', name: 'Platform admin', email: 'platform@gastora.com', role: 'platform', demo: true },
]