import { useMemo } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useHotel } from '../../lib/hotelContext'
import { POS_STORAGE_KEYS } from '../pos/posTypes'
import type { HeldOrder, Sale } from '../pos/posTypes'
import { useFeatures } from '../platform/featuresContext'
import type { DirectBillTransfer } from '../../services/accounting/accountingTypes'
import { daySource, liveExceptions } from './daySource'

/** The open day's transactions and exceptions, from the folios and the POS (read only). */
export function useDay(date: string, transfers: DirectBillTransfer[]) {
  const { reservations, rooms } = useHotel()
  const { tax } = useFeatures()
  const [sales] = useBrowserSyncedState<Sale[]>(POS_STORAGE_KEYS.sales, [])
  const [held] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const day = useMemo(() => daySource(date, reservations, sales, transfers, tax), [date, reservations, sales, transfers, tax])
  const exceptions = useMemo(() => liveExceptions(date, reservations, rooms, held, transfers), [date, reservations, rooms, held, transfers])
  return { ...day, exceptions, sales, held }
}
