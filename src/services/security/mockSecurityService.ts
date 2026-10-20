import { roleCan, ROLES, USERS } from '../../lib/roles'
import type { RoleId } from '../../lib/roles'
import { redactCardNumbers } from './cardScan'
import { ALL_PERMISSION_KEYS, permissionLabel, SENSITIVE_FIELDS } from './catalog'
import type { SecurityService } from './securityService'
import { sha256 } from './sha256'
import type {
  AuditInput,
  AuditLogEntry,
  AuthPolicy,
  CardToken,
  Consent,
  DataSubjectRequest,
  DataType,
  Device,
  DsrStatus,
  EncryptionCheck,
  FiscalConnector,
  FiscalDevice,
  FiscalSubmission,
  FreeTextRecord,
  Jurisdiction,
  MaskedColumn,
  MfaMode,
  PaymentMethodSecurity,
  RetentionPolicy,
  RolePermission,
  SecurityActor,
  SecurityEvent,
  Session,
  SodRule,
  UserRole,
} from './securityTypes'

// In-memory security data for the prototype, one set per property. Lasts until the page reloads.
// It applies the same rights checks the backend must apply, and writes every change it makes to the
// property's audit log, which is a hash chain: each entry carries the hash of the one before.

const MIN = 60000
const DAY = 24 * 60 * MIN
const started = Date.now()
const ago = (mins: number) => new Date(started - mins * MIN).toISOString()
const ahead = (mins: number) => new Date(started + mins * MIN).toISOString()
const nowIso = () => new Date().toISOString()

/** Days a data-subject request may take, by law. */
export const DSR_DAYS: Record<Jurisdiction, number> = { 'UG-DPPA-2019': 30, 'EU-GDPR': 30 }

const GROUP_OF: Record<string, string[]> = { t1: ['t1', 't3'], t3: ['t1', 't3'] }

/** Which demo staff work at each sample property. Other properties get the hotel admin and owner. */
const STAFF_OF: Record<string, string[]> = {
  t1: USERS.filter((u) => u.role !== 'platform').map((u) => u.id),
  t2: ['u-owner', 'u-desk', 'u-hk', 'u-att', 'u-store', 'u-pos'],
  t3: ['u-owner', 'u-admin', 'u-gm', 'u-finance', 'u-desk', 'u-res', 'u-hk', 'u-att', 'u-maint', 'u-store', 'u-proc'],
}

const ADMIN_ROLES: RoleId[] = ['owner', 'admin']
const PRIVACY_ROLES: RoleId[] = ['owner', 'admin', 'gm']
const MONEY_ROLES: RoleId[] = ['owner', 'admin', 'finance']

interface Store {
  overrides: RolePermission[]
  userRoles: UserRole[]
  masked: MaskedColumn[]
  sod: SodRule[]
  policy: AuthPolicy
  sessions: Session[]
  devices: Device[]
  events: SecurityEvent[]
  audit: AuditLogEntry[]
  methods: PaymentMethodSecurity[]
  tokens: CardToken[]
  freeText: FreeTextRecord[]
  consents: Consent[]
  jurisdiction: Jurisdiction
  retention: RetentionPolicy[]
  dsrs: DataSubjectRequest[]
  connectors: FiscalConnector[]
  fiscalDevices: FiscalDevice[]
  submissions: FiscalSubmission[]
  keyRotatedAt: string
}

const GENESIS = '0'.repeat(64)

function entryHash(e: Omit<AuditLogEntry, 'hash' | 'id' | 'recordedAt'>): string {
  return sha256(
    JSON.stringify([e.seq, e.prevHash, e.propertyId, e.sourceRef, e.at, e.actorName, e.category, e.tableName, e.op, e.rowKey, e.summary, e.before ?? null, e.after ?? null, e.amount ?? null]),
  )
}

function appendTo(store: Store, propertyId: string, input: AuditInput) {
  const last = store.audit[store.audit.length - 1]
  const seq = (last?.seq ?? 0) + 1
  const base = { ...input, propertyId, seq, prevHash: last?.hash ?? GENESIS }
  const entry: AuditLogEntry = { ...base, id: `AL-${propertyId}-${String(seq).padStart(5, '0')}`, hash: entryHash(base), recordedAt: nowIso() }
  // Frozen: nothing may change an entry once it is written.
  store.audit.push(Object.freeze(entry))
}

const RETENTION: Record<Jurisdiction, [DataType, number, RetentionPolicy['action'], string][]> = {
  'UG-DPPA-2019': [
    ['guestProfile', 24, 'anonymise', 'DPPA 2019 s.18: kept no longer than needed'],
    ['idDocuments', 12, 'delete', 'Guest register duty, then DPPA s.18'],
    ['folios', 60, 'archive', 'Tax Procedures Code Act: 5 years'],
    ['cardTokens', 18, 'delete', 'Processor agreement, PCI DSS'],
    ['cctv', 1, 'delete', 'Security purpose only'],
    ['marketing', 24, 'delete', 'Consent, DPPA s.7'],
    ['auditLog', 84, 'archive', 'Internal control, 7 years'],
    ['staffRecords', 84, 'archive', 'Employment Act and NSSF'],
  ],
  'EU-GDPR': [
    ['guestProfile', 36, 'anonymise', 'GDPR Art. 5(1)(e) storage limitation'],
    ['idDocuments', 12, 'delete', 'Local registration law, then Art. 17'],
    ['folios', 120, 'archive', 'Member state tax law, up to 10 years'],
    ['cardTokens', 18, 'delete', 'PCI DSS, processor agreement'],
    ['cctv', 1, 'delete', 'Art. 6(1)(f) legitimate interest'],
    ['marketing', 24, 'delete', 'Art. 6(1)(a) consent'],
    ['auditLog', 84, 'archive', 'Art. 5(2) accountability'],
    ['staffRecords', 60, 'archive', 'Member state employment law'],
  ],
}

const SAMPLE_GUESTS: [string, string][] = [
  ['G-1', 'Amina Nakato'],
  ['G-2', 'Grace Namukasa'],
  ['G-3', 'Moses Kato'],
  ['G-4', 'David Okello'],
  ['G-6', 'Sarah Achieng'],
  ['G-7', 'John Ssemwogerere'],
  ['G-9', 'Brian Kigozi'],
  ['G-11', 'Daniel Wasswa'],
  ['G-12', 'Faith Tumusiime'],
]

function seed(propertyId: string): Store {
  const staff = (STAFF_OF[propertyId] ?? ['u-owner', 'u-admin']).map((id) => USERS.find((u) => u.id === id)!).filter(Boolean)
  const large = propertyId === 't1'
  const small = propertyId === 't2'
  const group = GROUP_OF[propertyId]
  const name = (id: string) => USERS.find((u) => u.id === id)?.name ?? id

  const userRoles: UserRole[] = staff.map((u, i) => ({
    id: `UR-${propertyId}-${i + 1}`,
    propertyId,
    userId: u.id,
    roleId: u.role,
    scope: group && ['owner', 'finance'].includes(u.role) ? 'all' : 'listed',
    propertyIds: group && u.role === 'admin' ? [...group] : [propertyId],
    grantedAt: ago(200 * 24 * 60 - i * 1440),
    grantedBy: 'Patricia Owor',
  }))

  const mfa = Object.fromEntries(ROLES.map((r) => [r.id, (large && ['owner', 'admin', 'finance'].includes(r.id) ? 'required' : ['owner', 'admin'].includes(r.id) ? 'optional' : 'off') as MfaMode])) as Record<RoleId, MfaMode>

  const policy: AuthPolicy = {
    propertyId,
    mfa,
    password: { minLength: large ? 12 : 10, requireNumber: true, requireSymbol: large, expiryDays: large ? 90 : 0, lockAfter: 5 },
    sessionTimeoutMins: large ? 15 : 30,
    maxSessions: 3,
    sso: large
      ? { protocol: 'oidc', issuerUrl: 'https://login.microsoftonline.com/lakeview-hotels/v2.0', clientId: 'gastora-pms-lakeview', secretRef: 'vault://gastora/t1/sso/client-secret', domain: 'lakeviewhotels.co.ug' }
      : { protocol: 'none', issuerUrl: '', clientId: '', secretRef: '', domain: '' },
    updatedAt: ago(30 * 24 * 60),
    updatedBy: 'Daniel Kato',
  }

  const sessionUsers = staff.slice(0, small ? 4 : 8)
  const sessions: Session[] = sessionUsers.map((u, i) => ({
    id: `SS-${propertyId}-${i + 1}`,
    propertyId,
    userId: u.id,
    userName: u.name,
    roleId: u.role,
    kind: 'user',
    deviceLabel: ['Chrome on Windows', 'Safari on iPhone', 'Chrome on Android', 'Edge on Windows', 'Front desk tablet', 'Chrome on macOS'][i % 6],
    ip: `41.210.${140 + i}.${20 + i * 7}`,
    createdAt: ago(20 + i * 47),
    lastSeenAt: ago(1 + i * 6),
    expiresAt: ahead(8 * 60 - i * 30),
    mfa: policy.mfa[u.role] !== 'off',
  }))
  sessions.push({
    id: `SS-${propertyId}-pos`,
    propertyId,
    userId: 'device',
    userName: small ? 'POS-01' : 'POS-Restaurant-01',
    roleId: 'pos',
    kind: 'device',
    deviceLabel: 'POS terminal',
    ip: '192.168.1.21',
    createdAt: ago(9 * 60),
    lastSeenAt: ago(2),
    expiresAt: ahead(15 * 60),
    mfa: false,
  })
  if (!small)
    sessions.push({
      id: `SS-${propertyId}-svc`,
      propertyId,
      userId: 'service',
      userName: 'Night audit job',
      roleId: 'admin',
      kind: 'service',
      deviceLabel: 'Scheduler',
      ip: '10.0.0.4',
      createdAt: ago(5 * 60),
      lastSeenAt: ago(5 * 60 - 3),
      expiresAt: ahead(60),
      mfa: false,
    })

  const dev = (i: number, d: Omit<Device, 'id' | 'propertyId' | 'registeredAt'> & { days: number }): Device => {
    const { days, ...rest } = d
    return { ...rest, id: `DV-${propertyId}-${i}`, propertyId, registeredAt: ago(days * 1440) }
  }
  const devices: Device[] = small
    ? [
        dev(1, { name: 'POS-01', kind: 'pos', serial: 'SUNMI-T2-55102', location: 'Bar', status: 'approved', lastSeenAt: ago(2), decidedBy: 'Patricia Owor', days: 120 }),
        dev(2, { name: 'Front desk tablet', kind: 'tablet', serial: 'SM-T505-88231', location: 'Reception', status: 'approved', lastSeenAt: ago(4), decidedBy: 'Patricia Owor', days: 120 }),
        dev(3, { name: 'Unknown Android tablet', kind: 'tablet', serial: 'TECNO-P10-0091', location: 'Not set', status: 'pending', days: 1 }),
      ]
    : [
        dev(1, { name: 'POS-Restaurant-01', kind: 'pos', serial: 'SUNMI-T2-40021', location: 'Lake restaurant', status: 'approved', lastSeenAt: ago(2), decidedBy: 'Daniel Kato', days: 300 }),
        dev(2, { name: 'POS-Bar-01', kind: 'pos', serial: 'SUNMI-T2-40022', location: 'Pool bar', status: 'approved', lastSeenAt: ago(11), decidedBy: 'Daniel Kato', days: 300 }),
        dev(3, { name: 'Front desk tablet 1', kind: 'tablet', serial: 'SM-T505-11873', location: 'Reception', status: 'approved', lastSeenAt: ago(1), decidedBy: 'Daniel Kato', days: 240 }),
        dev(4, { name: 'Housekeeping tablet 2', kind: 'tablet', serial: 'SM-T225-55120', location: 'Linen room', status: 'pending', days: 2 }),
        ...(large
          ? [
              dev(5, { name: 'Edge server', kind: 'edge' as const, serial: 'NUC12-EDGE-0007', location: 'Server room', status: 'approved' as const, lastSeenAt: ago(1), decidedBy: 'Daniel Kato', days: 360 }),
              dev(6, { name: 'EFRIS fiscal printer', kind: 'fiscal' as const, serial: 'TCS-0042', location: 'Reception', status: 'approved' as const, lastSeenAt: ago(30), decidedBy: 'Patricia Owor', days: 360 }),
              dev(7, { name: 'Old POS terminal', kind: 'pos' as const, serial: 'PAX-S80-1189', location: 'Store', status: 'blocked' as const, decidedBy: 'Daniel Kato', days: 700 }),
            ]
          : []),
      ]

  const ev = (i: number, mins: number, userName: string, kind: SecurityEvent['kind'], detail: string): SecurityEvent => ({
    id: `SE-${propertyId}-${i}`,
    propertyId,
    at: ago(mins),
    userName,
    kind,
    detail,
  })
  const events: SecurityEvent[] = [
    ev(1, 3, staff[0]?.name ?? 'Owner', 'login', 'Password and authenticator code'),
    ev(2, 48, 'Unknown', 'login_failed', 'Wrong password for frontdesk@ - 41.210.151.9'),
    ev(3, 49, 'Unknown', 'login_failed', 'Wrong password for frontdesk@ - 41.210.151.9'),
    ev(4, 300, name('u-desk'), 'logout', 'Signed out'),
    ev(5, 1440, name('u-admin'), 'device_activated', 'Front desk tablet approved'),
  ]

  const methods: PaymentMethodSecurity[] = [
    { id: 'pm-cash', propertyId, label: 'Cash', channel: 'Front desk, POS', handling: 'noCardData', processor: '-' },
    { id: 'pm-momo', propertyId, label: 'MTN MoMo and Airtel Money', channel: 'Front desk, booking page, guest page', handling: 'noCardData', processor: 'MTN / Airtel API' },
    { id: 'pm-card-terminal', propertyId, label: 'Card on terminal', channel: 'Front desk, POS', handling: 'tokenized', processor: 'DPO Pay (P2PE terminal)' },
    { id: 'pm-card-online', propertyId, label: 'Card online', channel: 'Booking page, guest page', handling: 'tokenized', processor: 'DPO Pay hosted fields' },
    { id: 'pm-card-guarantee', propertyId, label: 'Card guarantee', channel: 'Reservations', handling: 'tokenized', processor: 'DPO Pay vault' },
    { id: 'pm-card-phone', propertyId, label: 'Card by phone', channel: 'Reservations', handling: small ? 'notTokenized' : 'tokenized', processor: small ? 'Typed by staff' : 'DPO pay link' },
    { id: 'pm-bank', propertyId, label: 'Bank transfer', channel: 'Corporate accounts', handling: 'noCardData', processor: '-' },
  ]

  const brands: CardToken['brand'][] = ['Visa', 'Mastercard', 'Visa', 'Amex', 'Mastercard', 'Visa']
  const tokens: CardToken[] = SAMPLE_GUESTS.slice(0, small ? 3 : 6).map(([gid, gname], i) => ({
    id: `CT-${propertyId}-${i + 1}`,
    propertyId,
    token: `tok_${sha256(propertyId + gid).slice(0, 20)}`,
    brand: brands[i],
    last4: ['4242', '5454', '1881', '0005', '4444', '9424'][i],
    expiry: ['09/27', '03/28', '11/26', '06/29', '01/27', '12/28'][i],
    guestId: gid,
    guestName: gname,
    processor: 'DPO Pay',
    createdAt: ago((i + 1) * 9 * 1440),
  }))

  const freeText: FreeTextRecord[] = [
    { id: `FT-${propertyId}-1`, source: 'Booking.com remarks', ref: 'BDC-4471920', text: 'Late arrival around 23:00. Please charge card 4111 1111 1111 1111 exp 09/27 for the deposit.', at: ago(3 * 1440), by: 'Channel import' },
    { id: `FT-${propertyId}-2`, source: 'POS order note', ref: small ? 'POS-01 #2291' : 'POS-Bar-01 #8812', text: 'Guest paid by card 5500-0000-0000-0004, terminal offline', at: ago(2 * 1440), by: small ? 'Kevin Ocen' : 'Kevin Ocen' },
    { id: `FT-${propertyId}-3`, source: 'Booking.com remarks', ref: 'BDC-4472388', text: 'Airport pickup needed. Contact 256772100204 on arrival. NIN on file.', at: ago(1440), by: 'Channel import' },
    { id: `FT-${propertyId}-4`, source: 'Email request', ref: 'EM-2210', text: 'Company ref 25677210020412 for invoicing. Please send the pro-forma.', at: ago(600), by: 'Vivian Achan' },
  ]

  const purposes: Consent['purpose'][] = ['marketing', 'loyalty', 'sensitive', 'idCopy']
  const consents: Consent[] = []
  SAMPLE_GUESTS.slice(0, small ? 4 : 9).forEach(([gid, gname], i) => {
    purposes.forEach((purpose, j) => {
      if ((i + j) % 4 === 3) return
      consents.push({
        id: `CN-${propertyId}-${i}-${j}`,
        propertyId,
        guestId: gid,
        guestName: gname,
        purpose,
        granted: purpose === 'idCopy' ? true : (i + j) % 3 !== 0,
        source: (['check-in form', 'booking page', 'guest portal', 'staff'] as const)[(i + j) % 4],
        at: ago((i * 13 + j * 3 + 2) * 1440),
        by: (i + j) % 4 === 3 ? 'Rita Auma' : 'Guest',
      })
    })
  })
  // A withdrawal, so the history shows a change.
  consents.push({ id: `CN-${propertyId}-w`, propertyId, guestId: 'G-1', guestName: 'Amina Nakato', purpose: 'marketing', granted: false, source: 'email', at: ago(3 * 1440), by: 'Rita Auma' })

  const retention: RetentionPolicy[] = (Object.keys(RETENTION) as Jurisdiction[]).flatMap((j) =>
    RETENTION[j].map(([dataType, keepMonths, action, legalBasis]) => ({ id: `RP-${propertyId}-${j}-${dataType}`, propertyId, jurisdiction: j, dataType, keepMonths, action, legalBasis })),
  )

  const dsr = (i: number, gid: string, gname: string, kind: DataSubjectRequest['kind'], status: DsrStatus, daysAgo: number, details: string, channel: DataSubjectRequest['channel']): DataSubjectRequest => ({
    id: `DSR-${propertyId}-${String(i).padStart(3, '0')}`,
    propertyId,
    guestId: gid,
    guestName: gname,
    kind,
    status,
    channel,
    details,
    receivedAt: ago(daysAgo * 1440),
    dueAt: ago((daysAgo - DSR_DAYS['UG-DPPA-2019']) * 1440),
    jurisdiction: 'UG-DPPA-2019',
    history: [{ at: ago(daysAgo * 1440), by: 'Rita Auma', text: 'Request logged' }],
    closedAt: status === 'completed' ? ago((daysAgo - 5) * 1440) : undefined,
  })
  const dsrs: DataSubjectRequest[] = [
    dsr(1, 'G-4', 'David Okello', 'access', 'in-progress', 26, 'Wants a copy of everything held about him.', 'email'),
    dsr(2, 'G-9', 'Brian Kigozi', 'correction', 'received', 3, 'Date of birth on profile is wrong.', 'in person'),
    ...(small ? [] : [dsr(3, 'G-7', 'John Ssemwogerere', 'deletion', 'completed', 40, 'Asked to be forgotten after his last stay.', 'email')]),
  ]

  const efrisActive = propertyId === 't1'
  const connectors: FiscalConnector[] = [
    {
      id: `FC-${propertyId}-efris`,
      propertyId,
      code: 'URA_EFRIS',
      name: 'URA EFRIS',
      country: 'Uganda',
      status: efrisActive ? 'active' : 'configured',
      mode: efrisActive ? 'production' : 'sandbox',
      endpoint: efrisActive ? 'https://efrisws.ura.go.ug/ws/taapp/getInformation' : 'https://efristest.ura.go.ug/efrisws/ws/taapp/getInformation',
      credentials: [
        { label: 'Private key', ref: `vault://gastora/${propertyId}/efris/private-key` },
        { label: 'Device AES key', ref: `vault://gastora/${propertyId}/efris/aes-key` },
      ],
      lastTestAt: efrisActive ? ago(180) : undefined,
      lastTestOk: efrisActive ? true : undefined,
      lastTestMessage: efrisActive ? 'T101 handshake OK. Server time in sync.' : undefined,
    },
    ...(
      [
        ['KRA_ETIMS', 'KRA eTIMS', 'Kenya', 'https://etims-api-sbx.kra.go.ke/etims-api'],
        ['TRA_VFD', 'TRA VFD', 'Tanzania', 'https://vfd.tra.go.tz/api'],
        ['RRA_EBM', 'RRA EBM', 'Rwanda', 'https://ebm.rra.gov.rw/api'],
        ['ZRA_SMART', 'ZRA Smart Invoice', 'Zambia', 'https://vsdc.zra.org.zm/api'],
      ] as const
    ).map(([code, n, country, endpoint]) => ({
      id: `FC-${propertyId}-${code.toLowerCase()}`,
      propertyId,
      code,
      name: n,
      country,
      status: 'template' as const,
      mode: 'sandbox' as const,
      endpoint,
      credentials: [
        { label: 'API key', ref: '' },
        { label: 'Signing certificate', ref: '' },
      ],
    })),
  ]

  const fiscalDevices: FiscalDevice[] = [
    { id: `FD-${propertyId}-1`, propertyId, connectorId: `FC-${propertyId}-efris`, deviceNo: efrisActive ? 'TCS-0042' : '', branchCode: efrisActive ? 'LGH-MAIN' : '', tin: efrisActive ? '1000123456' : '', label: 'Main building', active: efrisActive },
    ...(large ? [{ id: `FD-${propertyId}-2`, propertyId, connectorId: `FC-${propertyId}-efris`, deviceNo: 'TCS-0043', branchCode: 'LGH-POOL', tin: '1000123456', label: 'Pool bar outlet', active: true }] : []),
  ]

  const sub = (i: number, invoiceNo: string, guestName: string, amount: number, status: FiscalSubmission['status'], mins: number, error?: string): FiscalSubmission => ({
    id: `FS-${propertyId}-${i}`,
    propertyId,
    connectorId: `FC-${propertyId}-efris`,
    invoiceNo,
    guestName,
    amount,
    status,
    attempts: status === 'failed' ? 3 : 1,
    submittedAt: ago(mins),
    fiscalCode: status === 'accepted' ? `3218${String(70000000 + i * 1373).slice(0, 8)}` : undefined,
    error,
  })
  const submissions: FiscalSubmission[] = efrisActive
    ? [
        sub(1, 'INV-0880', 'Amina Nakato', 540000, 'accepted', 27 * 1440),
        sub(2, 'INV-0881', 'Moses Kato', 750000, 'accepted', 20 * 1440),
        sub(3, 'INV-0882', 'Kampala Pharma Ltd', 1960000, 'failed', 2 * 1440, 'Timeout from URA after 30 s'),
        sub(4, 'INV-0883', 'Faith Tumusiime', 380000, 'pending', 45),
      ]
    : []

  const store: Store = {
    overrides: [],
    userRoles,
    masked: [],
    sod: [
      ['Raise and approve the same refund', 'refunds.create', 'refunds.approve', 'high', true],
      ['Create a supplier and approve its invoice', 'suppliers.create', 'invoices.approve', 'high', true],
      ['Post and approve a journal entry', 'ledger.create', 'ledger.approve', 'high', true],
      ['Change pay and approve payroll', 'payroll.edit', 'payroll.approve', 'high', true],
      ['Adjust stock and approve the adjustment', 'stock.edit', 'stock.approve', 'medium', true],
      ['Set rates and approve discounts', 'rates.edit', 'discounts.approve', 'medium', false],
    ].map(([n, a, b, severity, enabled], i) => ({
      id: `SOD-${propertyId}-${i + 1}`,
      propertyId,
      name: n as string,
      permissionA: a as string,
      permissionB: b as string,
      severity: severity as SodRule['severity'],
      enabled: enabled as boolean,
      createdAt: ago(180 * 1440),
      createdBy: 'Daniel Kato',
    })),
    policy,
    sessions,
    devices,
    events,
    audit: [],
    methods,
    tokens,
    freeText,
    consents,
    jurisdiction: 'UG-DPPA-2019',
    retention,
    dsrs,
    connectors,
    fiscalDevices,
    submissions,
    keyRotatedAt: ago((large ? 41 : 118) * 1440),
  }

  // Entries the back office writes that this prototype has no screen for yet: rate changes, journal
  // entries and POS voids. The rest is sealed in from the hotel's own records by the audit page.
  const seedAudit: AuditInput[] = [
    { sourceRef: 'seed:rate-1', at: ago(9 * 1440), actorName: 'Esther Nambi', category: 'rates', tableName: 'gst_rates.rate_plans', op: 'U', rowKey: 'BAR Deluxe', summary: 'Best available rate changed', before: 'UGX 180,000', after: 'UGX 195,000' },
    { sourceRef: 'seed:rate-2', at: ago(6 * 1440), actorName: 'Esther Nambi', category: 'rates', tableName: 'gst_rates.rate_plans', op: 'U', rowKey: 'Corporate Standard', summary: 'Corporate rate changed', before: 'UGX 140,000', after: 'UGX 135,000' },
    { sourceRef: 'seed:void-1', at: ago(4 * 1440), actorName: 'Kevin Ocen', category: 'voids', tableName: 'gst_pos.order_lines', op: 'U', rowKey: small ? 'POS-01 #2280' : 'POS-Bar-01 #8790', summary: 'Line voided: 2 x Nile Special', before: 'UGX 16,000', after: 'Void (approved by Esther Nambi)', amount: 16000 },
    { sourceRef: 'seed:je-1', at: ago(3 * 1440), actorName: 'Brian Ssemakula', category: 'accounting', tableName: 'gst_ledger.journal_entries', op: 'I', rowKey: 'JE-2041', summary: 'Night audit revenue posted', after: 'Dr Guest ledger / Cr Room revenue UGX 3,420,000', amount: 3420000 },
    { sourceRef: 'seed:je-2', at: ago(2 * 1440), actorName: 'Brian Ssemakula', category: 'accounting', tableName: 'gst_ledger.journal_entries', op: 'I', rowKey: 'JE-2042', summary: 'Supplier invoice accrued', after: 'Dr Housekeeping supplies / Cr Accounts payable UGX 412,000', amount: 412000 },
    { sourceRef: 'seed:disc-1', at: ago(1440), actorName: 'Rita Auma', category: 'discounts', tableName: 'gst_desk.reservations', op: 'U', rowKey: 'R-1007', summary: 'Manager discount 10%', before: 'UGX 600,000', after: 'UGX 540,000', amount: 60000 },
  ]
  if (small) seedAudit.splice(4, 1)
  for (const s of seedAudit) appendTo(store, propertyId, s)
  return store
}

export function createMockSecurityService(): SecurityService {
  const stores = new Map<string, Store>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const deny = (why: string) => Promise.reject(new Error(why))
  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${String(++counter).padStart(4, '0')}`

  const get = (propertyId: string) => {
    let s = stores.get(propertyId)
    if (!s) {
      s = seed(propertyId)
      stores.set(propertyId, s)
    }
    return s
  }
  const copy = <T>(list: T[]) => list.map((x) => ({ ...x }))
  const isAdmin = (a: SecurityActor) => ADMIN_ROLES.includes(a.role)
  const log = (s: Store, propertyId: string, actor: SecurityActor, input: Omit<AuditInput, 'sourceRef' | 'at' | 'actorName'>) =>
    appendTo(s, propertyId, { ...input, sourceRef: nextId('sec'), at: nowIso(), actorName: actor.name })
  const event = (s: Store, propertyId: string, actor: SecurityActor, kind: SecurityEvent['kind'], detail: string) =>
    s.events.unshift({ id: nextId('SE'), propertyId, at: nowIso(), userName: actor.name, kind, detail })
  const done = <T>(value: T) => {
    emit()
    return Promise.resolve(value)
  }
  const needAdmin = (a: SecurityActor) => (isAdmin(a) ? null : 'Only the owner or hotel admin can change security settings.')

  return {
    // ---- Roles ----
    listRolePermissions: (p) => Promise.resolve(copy(get(p).overrides)),

    setRolePermission(p, roleId, key, granted, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      if (!ALL_PERMISSION_KEYS.includes(key)) return deny(`Unknown permission ${key}.`)
      if (roleId === 'platform') return deny('The platform role is managed by Gastora.')
      if (key.startsWith('security.') && roleId === actor.role && !granted) return deny('You cannot remove your own access to security settings.')
      const s = get(p)
      const existing = s.overrides.find((o) => o.roleId === roleId && o.permissionKey === key)
      const label = ROLES.find((r) => r.id === roleId)?.label ?? roleId
      const rec: RolePermission = existing
        ? { ...existing, granted, updatedAt: nowIso(), updatedBy: actor.name }
        : { id: nextId('RPM'), propertyId: p, roleId, permissionKey: key, granted, updatedAt: nowIso(), updatedBy: actor.name }
      s.overrides = existing ? s.overrides.map((o) => (o.id === existing.id ? rec : o)) : [...s.overrides, rec]
      log(s, p, actor, { category: 'security', tableName: 'gst_core.role_permissions', op: existing ? 'U' : 'I', rowKey: label, summary: permissionLabel(key), before: granted ? 'Denied' : 'Allowed', after: granted ? 'Allowed' : 'Denied' })
      return done({ ...rec })
    },

    resetRole(p, roleId, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const n = s.overrides.filter((o) => o.roleId === roleId).length
      if (!n) return Promise.resolve()
      s.overrides = s.overrides.filter((o) => o.roleId !== roleId)
      log(s, p, actor, { category: 'security', tableName: 'gst_core.role_permissions', op: 'D', rowKey: ROLES.find((r) => r.id === roleId)?.label ?? roleId, summary: 'Role reset to the standard table', before: `${n} change${n === 1 ? '' : 's'}`, after: 'Standard' })
      return done(undefined)
    },

    listUserRoles: (p) => Promise.resolve(get(p).userRoles.map((u) => ({ ...u, propertyIds: [...u.propertyIds] }))),

    setUserScope(p, id, scope, propertyIds, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const ur = s.userRoles.find((u) => u.id === id)
      if (!ur) return deny('Role assignment not found.')
      if (scope === 'listed' && propertyIds.length === 0) return deny('Pick at least one property.')
      const describe = (u: Pick<UserRole, 'scope' | 'propertyIds'>) => (u.scope === 'all' ? 'All properties' : u.propertyIds.join(', '))
      const next: UserRole = { ...ur, scope, propertyIds: scope === 'all' ? [] : [...propertyIds] }
      s.userRoles = s.userRoles.map((u) => (u.id === id ? next : u))
      log(s, p, actor, { category: 'security', tableName: 'gst_core.user_roles', op: 'U', rowKey: USERS.find((u) => u.id === ur.userId)?.name ?? ur.userId, summary: 'Property scope changed', before: describe(ur), after: describe(next) })
      return done({ ...next })
    },

    listMaskedColumns: (p) => Promise.resolve(copy(get(p).masked)),

    setFieldVisible(p, field, roleId, visible, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      if (!SENSITIVE_FIELDS.some((f) => f.field === field)) return deny('Unknown field.')
      const s = get(p)
      const existing = s.masked.find((m) => m.field === field && m.roleId === roleId)
      const rec: MaskedColumn = existing ? { ...existing, visible } : { id: nextId('MC'), propertyId: p, field, roleId, visible }
      s.masked = existing ? s.masked.map((m) => (m.id === existing.id ? rec : m)) : [...s.masked, rec]
      const label = SENSITIVE_FIELDS.find((f) => f.field === field)!.label
      log(s, p, actor, { category: 'security', tableName: 'gst_audit.masked_columns', op: 'U', rowKey: `${label} / ${ROLES.find((r) => r.id === roleId)?.label}`, summary: 'Sensitive field visibility', before: visible ? 'Masked' : 'Visible', after: visible ? 'Visible' : 'Masked' })
      return done({ ...rec })
    },

    listSodRules: (p) => Promise.resolve(copy(get(p).sod)),

    addSodRule(p, input, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const name = input.name.trim()
      if (!name) return deny('Give the rule a name.')
      if (!ALL_PERMISSION_KEYS.includes(input.permissionA) || !ALL_PERMISSION_KEYS.includes(input.permissionB)) return deny('Pick two permissions.')
      if (input.permissionA === input.permissionB) return deny('The two permissions must be different.')
      const s = get(p)
      const pair = [input.permissionA, input.permissionB].sort().join('|')
      if (s.sod.some((r) => [r.permissionA, r.permissionB].sort().join('|') === pair)) return deny('A rule for these two permissions already exists.')
      const rule: SodRule = { ...input, name, id: nextId('SOD'), propertyId: p, enabled: true, createdAt: nowIso(), createdBy: actor.name }
      s.sod = [...s.sod, rule]
      log(s, p, actor, { category: 'security', tableName: 'gst_core.sod_rules', op: 'I', rowKey: name, summary: 'Segregation rule added', after: `${permissionLabel(input.permissionA)} + ${permissionLabel(input.permissionB)}` })
      return done({ ...rule })
    },

    setSodRuleEnabled(p, id, enabled, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const r = s.sod.find((x) => x.id === id)
      if (!r) return deny('Rule not found.')
      const next = { ...r, enabled }
      s.sod = s.sod.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'security', tableName: 'gst_core.sod_rules', op: 'U', rowKey: r.name, summary: 'Segregation rule', before: enabled ? 'Off' : 'On', after: enabled ? 'On' : 'Off' })
      return done(next)
    },

    // ---- Sign-in ----
    getAuthPolicy: (p) => Promise.resolve(structuredClone(get(p).policy)),

    saveAuthPolicy(p, patch, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const next: AuthPolicy = structuredClone({ ...s.policy, ...patch, updatedAt: nowIso(), updatedBy: actor.name })
      const pw = next.password
      if (pw.minLength < 8 || pw.minLength > 64) return deny('Minimum password length must be between 8 and 64.')
      if (pw.lockAfter < 3 || pw.lockAfter > 20) return deny('Lock after 3 to 20 failed attempts.')
      if (pw.expiryDays < 0 || pw.expiryDays > 365) return deny('Password expiry must be 0 to 365 days.')
      if (next.sessionTimeoutMins < 5 || next.sessionTimeoutMins > 720) return deny('Session timeout must be 5 to 720 minutes.')
      if (next.maxSessions < 1 || next.maxSessions > 10) return deny('Allow 1 to 10 sessions per person.')
      if (next.mfa.owner === 'off' || next.mfa.admin === 'off') {
        if (patch.mfa && (patch.mfa.owner === 'off' || patch.mfa.admin === 'off') && actor.role !== 'owner') return deny('Only the owner can switch MFA off for owner or hotel admin.')
      }
      const sso = next.sso
      if (sso.protocol !== 'none') {
        if (!/^https:\/\//.test(sso.issuerUrl)) return deny('The issuer or metadata URL must start with https://')
        if (!sso.clientId.trim()) return deny('Enter the client or entity id.')
        if (!/^(vault|aws-sm|gcp-sm):\/\//.test(sso.secretRef)) return deny('The secret must be a reference such as vault://... - never the secret itself.')
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(sso.domain)) return deny('Enter the email domain, such as lakeviewhotels.co.ug.')
      }
      const changed = Object.keys(patch).join(', ')
      s.policy = next
      log(s, p, actor, { category: 'security', tableName: 'gst_core.auth_policy', op: 'U', rowKey: 'Sign-in policy', summary: `Changed: ${changed}` })
      event(s, p, actor, 'policy_changed', `Sign-in policy: ${changed}`)
      return done(structuredClone(next))
    },

    testSso(p, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const sso = s.policy.sso
      const problem =
        sso.protocol === 'none'
          ? 'SSO is off.'
          : !/^https:\/\//.test(sso.issuerUrl)
            ? 'Issuer URL is not https.'
            : !sso.clientId
              ? 'Client id missing.'
              : !/^(vault|aws-sm|gcp-sm):\/\//.test(sso.secretRef)
                ? 'Secret reference missing.'
                : null
      s.policy = {
        ...s.policy,
        sso: {
          ...sso,
          lastTestAt: nowIso(),
          lastTestOk: !problem,
          lastTestMessage: problem ?? (sso.protocol === 'oidc' ? 'Discovery document read. Signing keys found. Test user signed in.' : 'Metadata read. Certificate valid. Assertion accepted.'),
        },
      }
      return new Promise((resolve) => setTimeout(() => resolve(done(structuredClone(s.policy))), 600))
    },

    listSessions: (p) => Promise.resolve(copy(get(p).sessions)),

    revokeSession(p, id, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const ss = s.sessions.find((x) => x.id === id)
      if (!ss) return deny('Session not found.')
      if (ss.revokedAt) return deny('Already revoked.')
      if (ss.userId === actor.id) return deny('This is your own session. Sign out instead.')
      const next = { ...ss, revokedAt: nowIso(), revokedBy: actor.name }
      s.sessions = s.sessions.map((x) => (x.id === id ? next : x))
      event(s, p, actor, 'session_revoked', `${ss.userName} on ${ss.deviceLabel}`)
      log(s, p, actor, { category: 'security', tableName: 'gst_core.sessions', op: 'U', rowKey: ss.userName, summary: 'Session revoked', before: 'Active', after: 'Revoked' })
      return done(next)
    },

    listDevices: (p) => Promise.resolve(copy(get(p).devices)),

    registerDevice(p, input, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      if (!input.name.trim()) return deny('Name the device.')
      if (!/^[A-Z0-9-]{4,40}$/i.test(input.serial.trim())) return deny('Enter the serial number (letters, numbers and dashes).')
      const s = get(p)
      if (s.devices.some((d) => d.serial.toLowerCase() === input.serial.trim().toLowerCase())) return deny('A device with this serial is already registered.')
      const d: Device = { ...input, name: input.name.trim(), serial: input.serial.trim(), location: input.location.trim() || 'Not set', id: nextId('DV'), propertyId: p, status: 'pending', registeredAt: nowIso() }
      s.devices = [...s.devices, d]
      log(s, p, actor, { category: 'security', tableName: 'gst_core.devices', op: 'I', rowKey: d.name, summary: 'Device registered', after: `${d.serial}, waiting for approval` })
      return done({ ...d })
    },

    setDeviceStatus(p, id, status, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const d = s.devices.find((x) => x.id === id)
      if (!d) return deny('Device not found.')
      const next: Device = { ...d, status, decidedBy: actor.name, decidedAt: nowIso() }
      s.devices = s.devices.map((x) => (x.id === id ? next : x))
      if (status === 'blocked') s.sessions = s.sessions.map((x) => (x.kind === 'device' && x.userName === d.name && !x.revokedAt ? { ...x, revokedAt: nowIso(), revokedBy: actor.name } : x))
      event(s, p, actor, status === 'approved' ? 'device_activated' : 'device_revoked', `${d.name} (${d.serial})`)
      log(s, p, actor, { category: 'security', tableName: 'gst_core.devices', op: 'U', rowKey: d.name, summary: status === 'approved' ? 'Device approved' : 'Device blocked', before: d.status, after: status })
      return done(next)
    },

    encryptionStatus(p) {
      const s = get(p)
      const rotatedDays = Math.floor((Date.now() - Date.parse(s.keyRotatedAt)) / DAY)
      const edge = s.devices.find((d) => d.kind === 'edge')
      const adminMfa = s.policy.mfa.owner === 'required' && s.policy.mfa.admin === 'required'
      const rawCard = s.methods.some((m) => m.handling === 'notTokenized')
      const list: EncryptionCheck[] = [
        { id: 'tls', label: 'Encryption in transit', detail: 'TLS 1.3 on app and API, HSTS on, TLS 1.0/1.1 refused', status: 'ok' },
        { id: 'db', label: 'Database at rest', detail: 'AES-256 storage encryption; ID numbers and dates of birth also encrypted per column', status: 'ok' },
        { id: 'backup', label: 'Backups', detail: 'Encrypted, kept in a second region, restore tested monthly', status: 'ok' },
        { id: 'keys', label: 'Key rotation', detail: `Tenant key last rotated ${new Date(s.keyRotatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${rotatedDays} days ago, due every 90)`, status: rotatedDays > 90 ? 'warn' : 'ok' },
        { id: 'secrets', label: 'Where secrets live', detail: 'Secrets vault; the app keeps references only, never values in code or the browser', status: 'ok' },
        { id: 'pan', label: 'Card numbers', detail: rawCard ? 'One payment method still has staff typing card numbers' : 'Tokenized at the processor; no full card number stored', status: rawCard ? 'warn' : 'ok' },
        { id: 'mfa', label: 'MFA for admins', detail: adminMfa ? 'Required for owner and hotel admin' : 'Not required for owner and hotel admin yet', status: adminMfa ? 'ok' : 'warn' },
        edge
          ? { id: 'edge', label: 'Edge server disk', detail: `${edge.name}: full-disk encryption, TPM-sealed key`, status: edge.status === 'approved' ? 'ok' : 'warn' }
          : { id: 'edge', label: 'Edge server disk', detail: 'No edge server at this property', status: 'ok' },
      ]
      return Promise.resolve(list)
    },

    listSecurityEvents: (p) => Promise.resolve(copy(get(p).events)),

    // ---- Audit ----
    listAudit: (p) => Promise.resolve([...get(p).audit]),

    ingestAudit(p, inputs) {
      const s = get(p)
      const seen = new Set(s.audit.map((e) => e.sourceRef))
      const fresh = inputs.filter((i) => !seen.has(i.sourceRef)).sort((a, b) => a.at.localeCompare(b.at))
      for (const i of fresh) appendTo(s, p, i)
      if (fresh.length) emit()
      return Promise.resolve(fresh.length)
    },

    verifyChain(p) {
      const s = get(p)
      let prev = GENESIS
      let brokenAt: number | undefined
      for (const e of s.audit) {
        const { hash, ...rest } = e
        if (e.prevHash !== prev || entryHash(rest) !== hash) {
          brokenAt = e.seq
          break
        }
        prev = e.hash
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve({ ok: brokenAt === undefined, checked: s.audit.length, headHash: prev, brokenAt, at: nowIso() }), 500),
      )
    },

    recordExport(p, what, actor) {
      const s = get(p)
      event(s, p, actor, 'export', what)
      return done(undefined)
    },

    // ---- Payments ----
    listPaymentMethods: (p) => Promise.resolve(copy(get(p).methods)),

    tokenizeMethod(p, id, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const m = s.methods.find((x) => x.id === id)
      if (!m) return deny('Payment method not found.')
      if (m.handling !== 'notTokenized') return deny('This method does not take card numbers by hand.')
      const next: PaymentMethodSecurity = { ...m, handling: 'tokenized', processor: 'DPO pay link' }
      s.methods = s.methods.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'security', tableName: 'gst_billing.payment_methods', op: 'U', rowKey: m.label, summary: 'Moved to tokenized pay link', before: m.processor, after: next.processor })
      return done(next)
    },

    listCardTokens: (p) => Promise.resolve(copy(get(p).tokens)),

    deleteCardToken(p, id, actor) {
      if (!MONEY_ROLES.includes(actor.role)) return deny('Only the owner, hotel admin or finance can remove a card token.')
      const s = get(p)
      const t = s.tokens.find((x) => x.id === id)
      if (!t) return deny('Token not found.')
      s.tokens = s.tokens.filter((x) => x.id !== id)
      log(s, p, actor, { category: 'security', tableName: 'gst_billing.card_tokens', op: 'D', rowKey: t.guestName, summary: 'Card token removed', before: `${t.brand} •••• ${t.last4}` })
      return done(undefined)
    },

    listFreeText: (p) => Promise.resolve(copy(get(p).freeText)),

    redactFreeText(p, id, actor) {
      if (!MONEY_ROLES.includes(actor.role) && actor.role !== 'gm') return deny('You cannot edit these records.')
      const s = get(p)
      const r = s.freeText.find((x) => x.id === id)
      if (!r) return deny('Record not found.')
      const text = redactCardNumbers(r.text)
      const next = { ...r, text }
      s.freeText = s.freeText.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'security', tableName: 'gst_integration.free_text', op: 'U', rowKey: `${r.source} ${r.ref}`, summary: 'Card number redacted from free text', before: '[card number]', after: '[removed]' })
      return done(next)
    },

    // ---- Privacy ----
    listConsents: (p) => Promise.resolve(copy(get(p).consents)),

    recordConsent(p, input, actor) {
      if (!PRIVACY_ROLES.includes(actor.role) && actor.role !== 'frontdesk') return deny('You cannot record consent.')
      if (!input.guestId) return deny('Pick a guest.')
      const s = get(p)
      const c: Consent = { ...input, id: nextId('CN'), propertyId: p, at: nowIso(), by: actor.name }
      s.consents = [...s.consents, c]
      log(s, p, actor, { category: 'privacy', tableName: 'gst_crm.consents', op: 'I', rowKey: input.guestName, summary: `Consent: ${input.purpose}`, after: input.granted ? 'Given' : 'Withdrawn' })
      return done({ ...c })
    },

    getJurisdiction: (p) => Promise.resolve(get(p).jurisdiction),

    setJurisdiction(p, j, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const before = s.jurisdiction
      s.jurisdiction = j
      log(s, p, actor, { category: 'privacy', tableName: 'gst_audit.retention_policies', op: 'U', rowKey: 'Jurisdiction', summary: 'Privacy law applied', before, after: j })
      return done(j)
    },

    listRetentionPolicies: (p) => Promise.resolve(copy(get(p).retention)),

    saveRetentionPolicy(p, id, patch, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      if (!Number.isInteger(patch.keepMonths) || patch.keepMonths < 1 || patch.keepMonths > 240) return deny('Keep for 1 to 240 months.')
      const s = get(p)
      const r = s.retention.find((x) => x.id === id)
      if (!r) return deny('Policy not found.')
      if (r.dataType === 'folios' && patch.keepMonths < 60) return deny('Folios and invoices must be kept at least 60 months for tax.')
      const next = { ...r, ...patch }
      s.retention = s.retention.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'privacy', tableName: 'gst_audit.retention_policies', op: 'U', rowKey: `${r.dataType} (${r.jurisdiction})`, summary: 'Retention changed', before: `${r.keepMonths} months, ${r.action}`, after: `${next.keepMonths} months, ${next.action}` })
      return done(next)
    },

    listDsrs: (p) => Promise.resolve(get(p).dsrs.map((d) => ({ ...d, history: [...d.history] }))),

    createDsr(p, input, actor) {
      if (!PRIVACY_ROLES.includes(actor.role)) return deny('Only the owner, hotel admin or general manager can log privacy requests.')
      if (!input.guestId) return deny('Pick the guest the request is about.')
      if (!input.details.trim()) return deny('Say what the guest asked for.')
      const s = get(p)
      const open = s.dsrs.find((d) => d.guestId === input.guestId && d.kind === input.kind && !['completed', 'rejected'].includes(d.status))
      if (open) return deny(`${open.id} is already open for this guest.`)
      const received = nowIso()
      const d: DataSubjectRequest = {
        ...input,
        details: input.details.trim(),
        id: `DSR-${p}-${String(s.dsrs.length + 1).padStart(3, '0')}`,
        propertyId: p,
        status: 'received',
        receivedAt: received,
        dueAt: new Date(Date.now() + DSR_DAYS[s.jurisdiction] * DAY).toISOString(),
        jurisdiction: s.jurisdiction,
        history: [{ at: received, by: actor.name, text: 'Request logged' }],
      }
      s.dsrs = [d, ...s.dsrs]
      log(s, p, actor, { category: 'privacy', tableName: 'gst_audit.data_subject_requests', op: 'I', rowKey: d.id, summary: `${input.kind} request for ${input.guestName}`, after: 'Received' })
      return done({ ...d })
    },

    advanceDsr(p, id, status, note, actor) {
      if (!PRIVACY_ROLES.includes(actor.role)) return deny('Only the owner, hotel admin or general manager can work privacy requests.')
      const s = get(p)
      const d = s.dsrs.find((x) => x.id === id)
      if (!d) return deny('Request not found.')
      if (['completed', 'rejected'].includes(d.status)) return deny('This request is closed.')
      if (status === 'rejected' && !note.trim()) return deny('Say why the request is refused. The guest must be told.')
      const order: DsrStatus[] = ['received', 'verifying', 'in-progress', 'completed']
      if (status !== 'rejected' && order.indexOf(status) <= order.indexOf(d.status)) return deny('That step is already done.')
      const at = nowIso()
      const labels: Record<DsrStatus, string> = { received: 'Received', verifying: 'Identity being checked', 'in-progress': 'Being worked on', completed: 'Completed', rejected: 'Refused' }
      const next: DataSubjectRequest = {
        ...d,
        status,
        history: [...d.history, { at, by: actor.name, text: note.trim() ? `${labels[status]}: ${note.trim()}` : labels[status] }],
        closedAt: status === 'completed' || status === 'rejected' ? at : undefined,
      }
      s.dsrs = s.dsrs.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'privacy', tableName: 'gst_audit.data_subject_requests', op: 'U', rowKey: d.id, summary: `${d.kind} request for ${d.guestName}`, before: labels[d.status], after: labels[status] })
      return done(next)
    },

    recordAnonymised(p, guestId, guestName, actor) {
      if (!roleCan(actor.role, 'seeGuestRecord')) return deny('Only someone who answers for guest records can anonymise one.')
      const s = get(p)
      s.consents = s.consents.map((c) => (c.guestId === guestId ? { ...c, guestName: 'Anonymised guest' } : c))
      s.tokens = s.tokens.filter((t) => t.guestId !== guestId)
      s.dsrs = s.dsrs.map((d) => (d.guestId === guestId ? { ...d, guestName: 'Anonymised guest' } : d))
      log(s, p, actor, { category: 'privacy', tableName: 'gst_crm.guests', op: 'U', rowKey: guestId, summary: 'Guest anonymised', before: guestName, after: 'Anonymised guest' })
      return done(undefined)
    },

    // ---- Fiscal ----
    listConnectors: (p) => Promise.resolve(get(p).connectors.map((c) => ({ ...c, credentials: c.credentials.map((x) => ({ ...x })) }))),

    saveConnector(p, id, patch, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const c = s.connectors.find((x) => x.id === id)
      if (!c) return deny('Connector not found.')
      if (!/^https:\/\//.test(patch.endpoint)) return deny('The endpoint must start with https://')
      for (const cr of patch.credentials) {
        if (cr.ref && !/^(vault|aws-sm|gcp-sm):\/\/\S+$/.test(cr.ref)) return deny(`${cr.label}: store a reference such as vault://..., never the secret itself.`)
      }
      const next: FiscalConnector = { ...c, ...patch, credentials: patch.credentials.map((x) => ({ ...x })), status: c.status === 'template' ? 'configured' : c.status }
      s.connectors = s.connectors.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'fiscal', tableName: 'gst_audit.fiscal_connectors', op: 'U', rowKey: c.name, summary: 'Connector settings saved', before: `${c.mode}`, after: `${next.mode}` })
      return done(next)
    },

    setConnectorActive(p, id, active, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const c = s.connectors.find((x) => x.id === id)
      if (!c) return deny('Connector not found.')
      if (active) {
        if (c.status === 'template') return deny('Set it up first.')
        if (c.credentials.some((x) => !x.ref)) return deny('Add every credential reference first.')
        if (!c.lastTestOk) return deny('Run a successful connection test first.')
      }
      const next: FiscalConnector = { ...c, status: active ? 'active' : 'configured' }
      s.connectors = s.connectors.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'fiscal', tableName: 'gst_audit.fiscal_connectors', op: 'U', rowKey: c.name, summary: active ? 'Connector switched on' : 'Connector switched off', before: c.status, after: next.status })
      return done(next)
    },

    testConnector(p, id, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      const s = get(p)
      const c = s.connectors.find((x) => x.id === id)
      if (!c) return deny('Connector not found.')
      const missing = c.credentials.find((x) => !x.ref)
      const device = s.fiscalDevices.find((d) => d.connectorId === id && d.active && d.deviceNo)
      const problem = missing ? `${missing.label} reference missing.` : c.code === 'URA_EFRIS' && !device ? 'No active device mapped. Add the EFRIS device number below.' : null
      const next: FiscalConnector = {
        ...c,
        lastTestAt: nowIso(),
        lastTestOk: !problem,
        lastTestMessage: problem ?? (c.code === 'URA_EFRIS' ? `T101 handshake OK with ${c.mode}. Device ${device!.deviceNo} recognised.` : `Handshake OK with ${c.mode}.`),
      }
      s.connectors = s.connectors.map((x) => (x.id === id ? next : x))
      return new Promise((resolve) => setTimeout(() => resolve(done(next)), 600))
    },

    listFiscalDevices: (p) => Promise.resolve(copy(get(p).fiscalDevices)),

    saveFiscalDevice(p, input, actor) {
      const no = needAdmin(actor)
      if (no) return deny(no)
      if (!input.label.trim()) return deny('Name the branch or outlet.')
      if (input.active && !input.deviceNo.trim()) return deny('An active mapping needs a device number.')
      if (input.tin && !/^\d{10}$/.test(input.tin)) return deny('A TIN is 10 digits.')
      const s = get(p)
      if (input.deviceNo && s.fiscalDevices.some((d) => d.deviceNo === input.deviceNo.trim() && d.id !== input.id)) return deny('That device number is already mapped.')
      const rec: FiscalDevice = { ...input, id: input.id ?? nextId('FD'), propertyId: p, label: input.label.trim(), deviceNo: input.deviceNo.trim(), branchCode: input.branchCode.trim() }
      const existed = s.fiscalDevices.some((d) => d.id === rec.id)
      s.fiscalDevices = existed ? s.fiscalDevices.map((d) => (d.id === rec.id ? rec : d)) : [...s.fiscalDevices, rec]
      log(s, p, actor, { category: 'fiscal', tableName: 'gst_audit.fiscal_devices', op: existed ? 'U' : 'I', rowKey: rec.label, summary: 'Device mapping saved', after: `${rec.deviceNo || 'no device'} / ${rec.branchCode || 'no branch'}` })
      return done({ ...rec })
    },

    listSubmissions: (p) => Promise.resolve(copy(get(p).submissions)),

    submitInvoices(p, invoices, actor) {
      if (!MONEY_ROLES.includes(actor.role)) return deny('Only the owner, hotel admin or finance can send invoices.')
      const s = get(p)
      const conn = s.connectors.find((c) => c.status === 'active')
      if (!conn) return deny('No fiscal connector is switched on.')
      const sent = new Set(s.submissions.map((x) => x.invoiceNo))
      const fresh = invoices.filter((i) => !sent.has(i.invoiceNo))
      for (const inv of fresh) {
        const n = s.submissions.length + 1
        s.submissions.unshift({
          id: nextId('FS'),
          propertyId: p,
          connectorId: conn.id,
          ...inv,
          status: 'accepted',
          attempts: 1,
          submittedAt: nowIso(),
          fiscalCode: `3218${String(71000000 + n * 2711).slice(0, 8)}`,
        })
      }
      if (fresh.length) log(s, p, actor, { category: 'fiscal', tableName: 'gst_audit.fiscal_submissions', op: 'I', rowKey: conn.name, summary: `${fresh.length} invoice${fresh.length === 1 ? '' : 's'} sent`, after: fresh.map((f) => f.invoiceNo).join(', ') })
      return done(fresh.length)
    },

    retrySubmission(p, id, actor) {
      if (!MONEY_ROLES.includes(actor.role)) return deny('Only the owner, hotel admin or finance can resend invoices.')
      const s = get(p)
      const sub = s.submissions.find((x) => x.id === id)
      if (!sub) return deny('Submission not found.')
      if (sub.status === 'accepted') return deny('Already accepted.')
      const conn = s.connectors.find((c) => c.id === sub.connectorId)
      const ok = conn?.status === 'active'
      const next: FiscalSubmission = {
        ...sub,
        attempts: sub.attempts + 1,
        submittedAt: nowIso(),
        status: ok ? 'accepted' : 'failed',
        fiscalCode: ok ? `3218${String(72000000 + sub.attempts * 977).slice(0, 8)}` : undefined,
        error: ok ? undefined : 'Connector is switched off.',
      }
      s.submissions = s.submissions.map((x) => (x.id === id ? next : x))
      log(s, p, actor, { category: 'fiscal', tableName: 'gst_audit.fiscal_submissions', op: 'U', rowKey: sub.invoiceNo, summary: 'Invoice resent', before: sub.status, after: next.status })
      return done(next)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
