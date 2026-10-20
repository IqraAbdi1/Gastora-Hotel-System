import type { RoleId } from '../../lib/roles'
import type { Actor } from '../types'

// Records for compliance, security and controls. Named after the database tables:
// gst_core (roles, permissions, role_permissions, user_roles, sod_rules, sessions, devices),
// gst_audit (audit_log, masked_columns, security_events, retention_policies, data_subject_requests,
// fiscal_devices, fiscal_submissions), gst_billing.card_tokens and gst_crm.consents.

/** The person acting, with their role, so the service can check what they may do. */
export type SecurityActor = Actor & { role: RoleId }

// ---- Roles and permissions ----------------------------------------------------------------------

export type PermissionVerb = 'view' | 'create' | 'edit' | 'approve'

/** gst_core.permissions: one function of one module, such as "refunds". */
export interface Permission {
  id: string
  module: string
  label: string
  /** The page this function lives on, used to work out the default from the roles table. */
  path: string
  verbs: PermissionVerb[]
}

/** gst_core.role_permissions: a tenant's override on top of the built-in roles table. */
export interface RolePermission {
  id: string
  propertyId: string
  roleId: RoleId
  /** `${permission id}.${verb}`, such as "refunds.approve". */
  permissionKey: string
  granted: boolean
  updatedAt: string
  updatedBy: string
}

/** gst_core.user_roles: a person's role and the properties it covers. */
export interface UserRole {
  id: string
  propertyId: string
  userId: string
  roleId: RoleId
  scope: 'all' | 'listed'
  /** Used when scope is 'listed'. */
  propertyIds: string[]
  grantedAt: string
  grantedBy: string
}

export type SensitiveField = 'guestIdNumber' | 'lifetimeSpend' | 'cardLast4' | 'salary'

/** gst_audit.masked_columns, per role: whether a sensitive field shows or is masked. */
export interface MaskedColumn {
  id: string
  propertyId: string
  field: SensitiveField
  roleId: RoleId
  visible: boolean
}

/** gst_core.sod_rules: two permissions one person must not hold together. */
export interface SodRule {
  id: string
  propertyId: string
  name: string
  permissionA: string
  permissionB: string
  enabled: boolean
  severity: 'high' | 'medium'
  createdAt: string
  createdBy: string
}

export type NewSodRule = Pick<SodRule, 'name' | 'permissionA' | 'permissionB' | 'severity'>

// ---- Sign-in, sessions and devices --------------------------------------------------------------

export type MfaMode = 'off' | 'optional' | 'required'

export interface SsoSettings {
  protocol: 'none' | 'saml' | 'oidc'
  /** SAML: IdP metadata URL. OIDC: issuer URL. */
  issuerUrl: string
  /** OIDC client id or SAML entity id. */
  clientId: string
  /** Where the client secret or signing certificate lives. Never the value itself. */
  secretRef: string
  /** Email domain that signs in through SSO, such as lakeview.co.ug. */
  domain: string
  lastTestAt?: string
  lastTestOk?: boolean
  lastTestMessage?: string
}

export interface PasswordPolicy {
  minLength: number
  requireNumber: boolean
  requireSymbol: boolean
  /** 0 means passwords never expire. */
  expiryDays: number
  /** Failed attempts before the account locks for 15 minutes. */
  lockAfter: number
}

export interface AuthPolicy {
  propertyId: string
  mfa: Record<RoleId, MfaMode>
  password: PasswordPolicy
  /** Minutes of inactivity before a session signs out. */
  sessionTimeoutMins: number
  /** Most sessions one person may have open at once. */
  maxSessions: number
  sso: SsoSettings
  updatedAt: string
  updatedBy: string
}

/** gst_core.sessions. The token itself is never stored, only its hash. */
export interface Session {
  id: string
  propertyId: string
  userId: string
  userName: string
  roleId: RoleId
  kind: 'user' | 'device' | 'service'
  deviceLabel: string
  ip: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  mfa: boolean
  revokedAt?: string
  revokedBy?: string
}

export type DeviceKind = 'pos' | 'tablet' | 'edge' | 'kiosk' | 'fiscal'
export type DeviceStatus = 'pending' | 'approved' | 'blocked'

/** gst_core.devices: a terminal registered to the hotel. */
export interface Device {
  id: string
  propertyId: string
  name: string
  kind: DeviceKind
  serial: string
  location: string
  status: DeviceStatus
  registeredAt: string
  lastSeenAt?: string
  decidedBy?: string
  decidedAt?: string
}

export interface NewDevice {
  name: string
  kind: DeviceKind
  serial: string
  location: string
}

export type CheckStatus = 'ok' | 'warn' | 'fail'

/** One line of the encryption and secrets checklist. Read only. */
export interface EncryptionCheck {
  id: string
  label: string
  detail: string
  status: CheckStatus
}

/** gst_audit.security_events. */
export interface SecurityEvent {
  id: string
  propertyId: string
  at: string
  userName: string
  kind:
    | 'login'
    | 'login_failed'
    | 'logout'
    | 'mfa_failed'
    | 'session_revoked'
    | 'export'
    | 'device_activated'
    | 'device_revoked'
    | 'policy_changed'
  detail: string
}

// ---- Audit trail --------------------------------------------------------------------------------

export type AuditCategory =
  | 'rates'
  | 'reservations'
  | 'folios'
  | 'refunds'
  | 'voids'
  | 'discounts'
  | 'stock'
  | 'accounting'
  | 'security'
  | 'privacy'
  | 'fiscal'

/** What a source hands the audit log. The log adds the sequence and the hash. */
export interface AuditInput {
  /** Stable id of the source record, so the same event is never written twice. */
  sourceRef: string
  at: string
  actorName: string
  category: AuditCategory
  /** Database table the change belongs to, such as "gst_desk.folio_lines". */
  tableName: string
  op: 'I' | 'U' | 'D'
  /** The record changed, such as a reservation number. */
  rowKey: string
  summary: string
  before?: string
  after?: string
  amount?: number
}

/** gst_audit.audit_log. Append only: nothing here is ever edited or deleted. */
export interface AuditLogEntry extends AuditInput {
  id: string
  propertyId: string
  seq: number
  prevHash: string
  hash: string
  recordedAt: string
}

export interface ChainVerification {
  ok: boolean
  checked: number
  headHash: string
  /** Sequence number of the first entry that does not match, when the chain is broken. */
  brokenAt?: number
  at: string
}

// ---- Payments -----------------------------------------------------------------------------------

export interface PaymentMethodSecurity {
  id: string
  propertyId: string
  label: string
  channel: string
  handling: 'tokenized' | 'noCardData' | 'notTokenized'
  /** Who holds the card data when it is tokenized. */
  processor: string
}

/** gst_billing.card_tokens. Never the full number. */
export interface CardToken {
  id: string
  propertyId: string
  token: string
  brand: 'Visa' | 'Mastercard' | 'Amex'
  last4: string
  expiry: string
  guestId: string
  guestName: string
  processor: string
  createdAt: string
}

/** Free text kept by other systems, scanned for card numbers that should never have been typed. */
export interface FreeTextRecord {
  id: string
  source: string
  ref: string
  text: string
  at: string
  by: string
}

// ---- Privacy ------------------------------------------------------------------------------------

export type ConsentPurpose = 'marketing' | 'loyalty' | 'sensitive' | 'idCopy' | 'cctv'

/** gst_crm.consents. A new record for each change, so history is kept. */
export interface Consent {
  id: string
  propertyId: string
  guestId: string
  guestName: string
  purpose: ConsentPurpose
  granted: boolean
  source: 'check-in form' | 'guest portal' | 'booking page' | 'staff' | 'email'
  at: string
  by: string
}

export type NewConsent = Pick<Consent, 'guestId' | 'guestName' | 'purpose' | 'granted' | 'source'>

export type Jurisdiction = 'UG-DPPA-2019' | 'EU-GDPR'

export type DataType = 'guestProfile' | 'idDocuments' | 'folios' | 'cardTokens' | 'cctv' | 'marketing' | 'auditLog' | 'staffRecords'

/** gst_audit.retention_policies. */
export interface RetentionPolicy {
  id: string
  propertyId: string
  jurisdiction: Jurisdiction
  dataType: DataType
  /** Months to keep after the last stay or last activity. */
  keepMonths: number
  action: 'delete' | 'anonymise' | 'archive'
  legalBasis: string
}

export type DsrKind = 'access' | 'correction' | 'deletion'
export type DsrStatus = 'received' | 'verifying' | 'in-progress' | 'completed' | 'rejected'

/** gst_audit.data_subject_requests. */
export interface DataSubjectRequest {
  id: string
  propertyId: string
  guestId: string
  guestName: string
  kind: DsrKind
  status: DsrStatus
  channel: 'email' | 'in person' | 'phone' | 'guest portal'
  details: string
  receivedAt: string
  dueAt: string
  jurisdiction: Jurisdiction
  history: { at: string; by: string; text: string }[]
  closedAt?: string
}

export type NewDsr = Pick<DataSubjectRequest, 'guestId' | 'guestName' | 'kind' | 'channel' | 'details'>

// ---- Fiscal connectors --------------------------------------------------------------------------

export type ConnectorStatus = 'active' | 'configured' | 'template'

export interface FiscalConnector {
  id: string
  propertyId: string
  code: 'URA_EFRIS' | 'KRA_ETIMS' | 'TRA_VFD' | 'RRA_EBM' | 'ZRA_SMART'
  name: string
  country: string
  status: ConnectorStatus
  mode: 'sandbox' | 'production'
  endpoint: string
  /** Secret references, never the values. */
  credentials: { label: string; ref: string }[]
  lastTestAt?: string
  lastTestOk?: boolean
  lastTestMessage?: string
}

/** gst_audit.fiscal_devices: which fiscal device or branch code each property uses. */
export interface FiscalDevice {
  id: string
  propertyId: string
  connectorId: string
  deviceNo: string
  branchCode: string
  tin: string
  label: string
  active: boolean
}

export type SubmissionStatus = 'accepted' | 'pending' | 'failed'

/** gst_audit.fiscal_submissions. */
export interface FiscalSubmission {
  id: string
  propertyId: string
  connectorId: string
  invoiceNo: string
  reservationId?: string
  guestName: string
  amount: number
  status: SubmissionStatus
  attempts: number
  submittedAt: string
  fiscalCode?: string
  error?: string
}

export interface InvoiceForSubmission {
  invoiceNo: string
  reservationId?: string
  guestName: string
  amount: number
}
