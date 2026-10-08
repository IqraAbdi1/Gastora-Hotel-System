export type HousekeepingScope = {
  tenantId: string
  propertyId: string
  propertyName: string
  userId: string
  permissions: ReadonlySet<string>
}

export type HousekeepingScopeProvider = {
  getScope(): HousekeepingScope
}

/**
 * Temporary frontend-only scope.
 *
 * Replace the values with the authenticated user's real tenant/property
 * context once Identity and Property services are connected.
 *
 * Do not accept tenantId/propertyId from ordinary page form fields or URL
 * parameters as an authorization decision.
 */
const developmentScope: HousekeepingScope = {
  tenantId: 'demo-tenant',
  propertyId: 'demo-property',
  propertyName: 'Sample Hotel',
  userId: 'demo-housekeeping-user',
  permissions: new Set([
    'Housekeeping.View',
    'Housekeeping.RoomStatus.Update',
    'Housekeeping.Task.Create',
    'Housekeeping.Task.Assign',
    'Housekeeping.Inspection.Perform',
    'Housekeeping.Defect.Report',
    'Housekeeping.Maintenance.Request',
    'Housekeeping.Defect.Resolve',
  ]),
}

export const housekeepingScopeProvider: HousekeepingScopeProvider = {
  getScope() {
    return developmentScope
  },
}
