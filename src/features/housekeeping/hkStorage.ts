/**
 * Where housekeeping is kept on this browser, alongside the rest of the hotel's record.
 * Before this, the room was saved but the work on it was not: a refresh left a room out of order
 * with no repair behind it, and offered to release it as though nothing were wrong.
 */
export const HK_KEYS = {
  tasks: 'gastora:hotel:hkTasks',
  details: 'gastora:hotel:hkDetails',
  threads: 'gastora:hotel:hkThreads',
  readyAlerts: 'gastora:hotel:hkReadyAlerts',
  declined: 'gastora:hotel:hkDeclined',
  downtime: 'gastora:hotel:hkDowntime',
  roster: 'gastora:hotel:hkRoster',
} as const
