import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { stamp } from '../../lib/folio'
import { nightsBetween } from '../../lib/format'
import { codeFrom, newBlockId, placeholderName, rateFor } from '../../lib/groups'
import type { GroupBlock, GroupStatus } from '../../lib/groups'
import { useHotel } from '../../lib/hotelContext'
import type { NewReservation } from '../../types'
import { nightlyRate } from '../../lib/rates'
import { useFeatures } from '../platform/featuresContext'
import { GroupsContext } from './groupsContext'
import type { GroupsValue, NewBlock } from './groupsContext'

// Blocks of rooms held under one name. Creating one makes a real booking for every room it holds, so
// availability, the rack and check-in all understand a group without being taught anything about one.
export default function GroupsProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useBrowserSyncedState<GroupBlock[]>('gastora:hotel:groups', [])
  const { addReservations } = useHotel()
  const { options } = useFeatures()

  const byId = useCallback((id: string | undefined) => blocks.find((b) => b.id === id), [blocks])

  const create = useCallback(
    (input: NewBlock, by: string) => {
      const made: GroupBlock = {
        ...input,
        id: newBlockId(blocks),
        code: input.code?.trim() || codeFrom(input.name, blocks),
        status: 'held',
        at: stamp(),
        by,
      }
      setBlocks((list) => [made, ...list])

      // One booking per room held. Unnamed to begin with: in this market the names usually arrive on
      // the day, and a room with nobody's name on it is still a room out of inventory.
      const nights = Math.max(1, nightsBetween(made.arrival, made.departure))
      const rooms: NewReservation[] = []
      let index = 0
      for (const line of made.rooms) {
        for (let n = 0; n < line.count; n += 1) {
          index += 1
          const nightly = rateFor(made, line.type, nightlyRate(line.type, 0, options.rates))
          rooms.push({
            guest: placeholderName(made, index),
            roomType: line.type,
            room: null,
            arrival: made.arrival,
            departure: made.departure,
            total: nightly * nights,
            paid: 0,
            plan: made.plan,
            // The block is what secures these rooms, not a deposit on each one.
            guarantee: made.billing === 'each-guest' ? 'none' : 'company',
            source: made.billing === 'agent-net' ? 'ota' : 'front desk',
            group: { blockId: made.id, code: made.code, index, named: false },
          })
        }
      }
      addReservations(rooms)
      return made
    },
    [addReservations, blocks, options.rates, setBlocks],
  )

  const update = useCallback(
    (id: string, patch: Partial<GroupBlock>) => setBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b))),
    [setBlocks],
  )

  const setStatus = useCallback((id: string, status: GroupStatus) => update(id, { status }), [update])

  const value = useMemo<GroupsValue>(() => ({ blocks, byId, create, update, setStatus }), [blocks, byId, create, update, setStatus])
  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>
}
