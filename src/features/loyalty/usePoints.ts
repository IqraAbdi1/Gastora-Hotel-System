import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { Voucher } from '../../lib/points'

// Vouchers the hotel has issued. Points themselves are never stored: they are worked out from the
// stays that earned them, so a balance can always be explained to a guest who argues about it.
const KEY = 'gastora:hotel:vouchers'

export function useVouchers() {
  const [vouchers, setVouchers] = useBrowserSyncedState<Voucher[]>(KEY, [])
  const issue = (v: Voucher) => setVouchers([v, ...vouchers])
  const update = (id: string, patch: Partial<Voucher>) =>
    setVouchers(vouchers.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  return { vouchers, setVouchers, issue, update }
}
