export type OfflineHousekeepingCommand = {
  id: string
  type: 'ChangeRoomStatus'
  tenantId: string
  propertyId: string
  createdAt: string
  idempotencyKey: string
  payload: {
    roomId: string
    status:
      | 'Dirty'
      | 'Being Cleaned'
      | 'Clean'
      | 'Inspected'
      | 'Out of Service'
      | 'Out of Order'
      | 'Discrepancy'
    reason?: string
  }
}

const databaseName = 'gastora-housekeeping'
const storeName = 'offline-commands'
const databaseVersion = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      databaseName,
      databaseVersion,
    )

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, {
          keyPath: 'id',
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ??
          new Error('Unable to open housekeeping offline storage.'),
      )
  })
}

export async function enqueueHousekeepingCommand(
  command: OfflineHousekeepingCommand,
): Promise<void> {
  const database = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      storeName,
      'readwrite',
    )

    transaction.objectStore(storeName).put(command)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Unable to queue housekeeping command.'),
      )
  })

  database.close()
}

export async function listHousekeepingCommands(): Promise<
  OfflineHousekeepingCommand[]
> {
  const database = await openDatabase()

  const commands = await new Promise<
    OfflineHousekeepingCommand[]
  >((resolve, reject) => {
    const transaction = database.transaction(
      storeName,
      'readonly',
    )

    const request = transaction
      .objectStore(storeName)
      .getAll()

    request.onsuccess = () =>
      resolve(
        (request.result ?? []) as OfflineHousekeepingCommand[],
      )

    request.onerror = () =>
      reject(
        request.error ??
          new Error('Unable to read housekeeping offline queue.'),
      )
  })

  database.close()

  return commands.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

export async function removeHousekeepingCommand(
  commandId: string,
): Promise<void> {
  const database = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      storeName,
      'readwrite',
    )

    transaction.objectStore(storeName).delete(commandId)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Unable to remove housekeeping command.'),
      )
  })

  database.close()
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}
