import type { RoleId } from '../../lib/roles'
import type { Unsubscribe } from '../types'
import type {
  AuditInput,
  AuditLogEntry,
  AuthPolicy,
  CardToken,
  ChainVerification,
  Consent,
  DataSubjectRequest,
  Device,
  DeviceStatus,
  DsrStatus,
  EncryptionCheck,
  FiscalConnector,
  FiscalDevice,
  FiscalSubmission,
  FreeTextRecord,
  InvoiceForSubmission,
  Jurisdiction,
  MaskedColumn,
  NewConsent,
  NewDevice,
  NewDsr,
  NewSodRule,
  PaymentMethodSecurity,
  RetentionPolicy,
  RolePermission,
  SecurityActor,
  SecurityEvent,
  SensitiveField,
  Session,
  SodRule,
  UserRole,
} from './securityTypes'

// What the screens need for compliance, security and controls. Every call names the property and
// every change takes the actor: the backend checks the actor's rights and writes the audit log itself.
// The mock does the same checks so the screens can be tried against them.
export interface SecurityService {
  // Roles and permissions
  listRolePermissions(propertyId: string): Promise<RolePermission[]>
  setRolePermission(propertyId: string, roleId: RoleId, permissionKey: string, granted: boolean, actor: SecurityActor): Promise<RolePermission>
  /** Drop every override for one role, back to the built-in roles table. */
  resetRole(propertyId: string, roleId: RoleId, actor: SecurityActor): Promise<void>
  listUserRoles(propertyId: string): Promise<UserRole[]>
  setUserScope(propertyId: string, userRoleId: string, scope: UserRole['scope'], propertyIds: string[], actor: SecurityActor): Promise<UserRole>
  listMaskedColumns(propertyId: string): Promise<MaskedColumn[]>
  setFieldVisible(propertyId: string, field: SensitiveField, roleId: RoleId, visible: boolean, actor: SecurityActor): Promise<MaskedColumn>
  listSodRules(propertyId: string): Promise<SodRule[]>
  addSodRule(propertyId: string, input: NewSodRule, actor: SecurityActor): Promise<SodRule>
  setSodRuleEnabled(propertyId: string, id: string, enabled: boolean, actor: SecurityActor): Promise<SodRule>

  // Sign-in, sessions and devices
  getAuthPolicy(propertyId: string): Promise<AuthPolicy>
  saveAuthPolicy(propertyId: string, patch: Partial<Omit<AuthPolicy, 'propertyId' | 'updatedAt' | 'updatedBy'>>, actor: SecurityActor): Promise<AuthPolicy>
  /** Try the SSO settings against the identity provider. */
  testSso(propertyId: string, actor: SecurityActor): Promise<AuthPolicy>
  listSessions(propertyId: string): Promise<Session[]>
  revokeSession(propertyId: string, id: string, actor: SecurityActor): Promise<Session>
  listDevices(propertyId: string): Promise<Device[]>
  registerDevice(propertyId: string, input: NewDevice, actor: SecurityActor): Promise<Device>
  setDeviceStatus(propertyId: string, id: string, status: Exclude<DeviceStatus, 'pending'>, actor: SecurityActor): Promise<Device>
  encryptionStatus(propertyId: string): Promise<EncryptionCheck[]>
  listSecurityEvents(propertyId: string): Promise<SecurityEvent[]>

  // Audit trail
  listAudit(propertyId: string): Promise<AuditLogEntry[]>
  /** Seal records from other modules into the log. Ones already sealed (same sourceRef) are skipped. Returns how many were added. */
  ingestAudit(propertyId: string, inputs: AuditInput[]): Promise<number>
  verifyChain(propertyId: string): Promise<ChainVerification>
  /** Note that someone exported data, for the security events. */
  recordExport(propertyId: string, what: string, actor: SecurityActor): Promise<void>

  // Payments
  listPaymentMethods(propertyId: string): Promise<PaymentMethodSecurity[]>
  /** Move a method off raw card entry onto a tokenized flow, such as a pay link. */
  tokenizeMethod(propertyId: string, id: string, actor: SecurityActor): Promise<PaymentMethodSecurity>
  listCardTokens(propertyId: string): Promise<CardToken[]>
  deleteCardToken(propertyId: string, id: string, actor: SecurityActor): Promise<void>
  /** Free text other systems hold (imported booking remarks, POS notes) for the card-number scan. */
  listFreeText(propertyId: string): Promise<FreeTextRecord[]>
  /** Replace a card number found in free text with its masked form. */
  redactFreeText(propertyId: string, id: string, actor: SecurityActor): Promise<FreeTextRecord>

  // Privacy
  listConsents(propertyId: string): Promise<Consent[]>
  recordConsent(propertyId: string, input: NewConsent, actor: SecurityActor): Promise<Consent>
  getJurisdiction(propertyId: string): Promise<Jurisdiction>
  setJurisdiction(propertyId: string, jurisdiction: Jurisdiction, actor: SecurityActor): Promise<Jurisdiction>
  listRetentionPolicies(propertyId: string): Promise<RetentionPolicy[]>
  saveRetentionPolicy(propertyId: string, id: string, patch: Pick<RetentionPolicy, 'keepMonths' | 'action'>, actor: SecurityActor): Promise<RetentionPolicy>
  listDsrs(propertyId: string): Promise<DataSubjectRequest[]>
  createDsr(propertyId: string, input: NewDsr, actor: SecurityActor): Promise<DataSubjectRequest>
  advanceDsr(propertyId: string, id: string, status: DsrStatus, note: string, actor: SecurityActor): Promise<DataSubjectRequest>
  /** Record that a guest's personal data was replaced by placeholders. */
  recordAnonymised(propertyId: string, guestId: string, guestName: string, actor: SecurityActor): Promise<void>

  // Fiscal connectors
  listConnectors(propertyId: string): Promise<FiscalConnector[]>
  saveConnector(propertyId: string, id: string, patch: Pick<FiscalConnector, 'mode' | 'endpoint' | 'credentials'>, actor: SecurityActor): Promise<FiscalConnector>
  setConnectorActive(propertyId: string, id: string, active: boolean, actor: SecurityActor): Promise<FiscalConnector>
  testConnector(propertyId: string, id: string, actor: SecurityActor): Promise<FiscalConnector>
  listFiscalDevices(propertyId: string): Promise<FiscalDevice[]>
  saveFiscalDevice(propertyId: string, device: Omit<FiscalDevice, 'id' | 'propertyId'> & { id?: string }, actor: SecurityActor): Promise<FiscalDevice>
  listSubmissions(propertyId: string): Promise<FiscalSubmission[]>
  /** Send invoices that have not been sent yet. Returns how many were queued. */
  submitInvoices(propertyId: string, invoices: InvoiceForSubmission[], actor: SecurityActor): Promise<number>
  retrySubmission(propertyId: string, id: string, actor: SecurityActor): Promise<FiscalSubmission>

  subscribe(listener: () => void): Unsubscribe
}
