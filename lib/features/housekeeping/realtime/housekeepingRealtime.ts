import type {
  RoomStatusChangedEvent,
} from '../api/housekeepingContracts'

export type HousekeepingRealtimeSubscription = {
  unsubscribe: () => Promise<void>
}

export type HousekeepingRealtime = {
  connect(context: {
    tenantId: string
    propertyId: string
    accessToken: string | null
  }): Promise<void>

  subscribeToRoomStatus(
    handler: (event: RoomStatusChangedEvent) => void,
  ): HousekeepingRealtimeSubscription

  disconnect(): Promise<void>
}

/**
 * Integration boundary for ASP.NET Core SignalR.
 *
 * The actual SignalR client can be introduced later without changing
 * HousekeepingPage or the rest of the housekeeping feature. This adapter
 * deliberately does not import @microsoft/signalr yet because the frontend
 * is currently being developed without a backend.
 */
export function createHousekeepingRealtime(): HousekeepingRealtime {
  const handlers = new Set<
    (event: RoomStatusChangedEvent) => void
  >()

  return {
    async connect(context) {
      void context
    },

    subscribeToRoomStatus(handler) {
      handlers.add(handler)

      return {
        async unsubscribe() {
          handlers.delete(handler)
        },
      }
    },

    async disconnect() {
      handlers.clear()
    },
  }
}

/**
 * Local development/testing helper.
 * A future SignalR adapter will call the same internal event shape.
 */
export function emitRoomStatusChanged(
  realtime: HousekeepingRealtime,
  event: RoomStatusChangedEvent,
) {
  void realtime
  void event
}