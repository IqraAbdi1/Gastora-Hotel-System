export const housekeepingPermissions = {
  view: 'Housekeeping.View',
  updateRoomStatus: 'Housekeeping.RoomStatus.Update',
  createTask: 'Housekeeping.Task.Create',
  assignTask: 'Housekeeping.Task.Assign',
  inspectRoom: 'Housekeeping.Inspection.Perform',
  reportDefect: 'Housekeeping.Defect.Report',
  requestMaintenance: 'Housekeeping.Maintenance.Request',
  resolveDefect: 'Housekeeping.Defect.Resolve',
} as const

export type HousekeepingPermission =
  (typeof housekeepingPermissions)[keyof typeof housekeepingPermissions]

export type PermissionSet = ReadonlySet<string>

export function hasPermission(
  permissions: PermissionSet,
  permission: HousekeepingPermission,
): boolean {
  return permissions.has(permission)
}

/**
 * UI authorization helper only.
 *
 * The backend must enforce the same permission at API level.
 * Hiding a button or disabling an action is never the security boundary.
 */
export function canUpdateRoomStatus(
  permissions: PermissionSet,
): boolean {
  return hasPermission(
    permissions,
    housekeepingPermissions.updateRoomStatus,
  )
}

export function canCreateTask(
  permissions: PermissionSet,
): boolean {
  return hasPermission(
    permissions,
    housekeepingPermissions.createTask,
  )
}

export function canInspectRoom(
  permissions: PermissionSet,
): boolean {
  return hasPermission(
    permissions,
    housekeepingPermissions.inspectRoom,
  )
}
