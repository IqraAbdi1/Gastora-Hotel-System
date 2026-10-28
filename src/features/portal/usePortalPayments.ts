import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { GuestPayment } from '../../lib/portalPay'

/**
 * Receipts for what guests paid from their own pages.
 *
 * The money itself is on the reservation, where the desk sees it. This is only the guest's copy, so
 * they can open the receipt again. Kept in this browser beside the hotel's own record, the same way
 * guest requests are, so the guest page and the desk agree in a one-browser demonstration.
 */
const KEY = 'gastora:hotel:portalPayments'

export function usePortalPayments() {
  const [payments, setPayments] = useBrowserSyncedState<GuestPayment[]>(KEY, [])
  const add = (p: GuestPayment) => setPayments((list) => [p, ...list])
  return { payments, add }
}
