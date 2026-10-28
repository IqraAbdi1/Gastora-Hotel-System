import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { TODAY } from '../../data/sample'
import { stamp } from '../../lib/folio'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { KEY_RETURN_LABEL, onlineCheck } from '../../lib/onlineCheckout'
import type { OnlineCheckout } from '../../lib/onlineCheckout'
import { tokenFor } from '../../lib/preRegistration'
import type { Reservation } from '../../types'
import { useCorporate } from '../corporate/corporateContext'
import { useMessages } from '../messages/messagesContext'
import { useFeatures } from '../platform/featuresContext'

/**
 * Online checkouts the guest started from their own page. Kept in this browser beside the hotel's
 * own record, like guest requests, so the guest page and the desk agree in a one-browser demonstration.
 */
const KEY = 'gastora:hotel:onlineCheckouts'

export function useOnlineCheckouts() {
  const [list, setList] = useBrowserSyncedState<OnlineCheckout[]>(KEY, [])
  const { reservations, checkOut, agreeExpress, runExpress } = useHotel()
  const { byId } = useCorporate()
  const { options } = useFeatures()
  const { queue } = useMessages()

  const add = (x: OnlineCheckout) => setList((l) => [x, ...l])
  const update = (id: string, patch: Partial<OnlineCheckout>) =>
    setList((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const accountNameOf = (r: Reservation) => (r.corporate ? byId(r.corporate.accountId)?.name : undefined)
  const checkOf = (r: Reservation) => onlineCheck(r, accountNameOf(r), options.expressMax)

  /**
   * Check the guest out. The check is made again now, because a charge may have landed since they
   * asked. The money is taken first and the stay is checked out second, the way express checkout does.
   * Returns why it could not be done, or nothing when it was.
   */
  function complete(x: OnlineCheckout, by: string, via: 'guest' | 'desk'): string | undefined {
    const r = reservations.find((y) => y.id === x.reservationId)
    if (!r || r.status !== 'in-house') return 'This stay is no longer in the hotel.'
    if (r.departure > TODAY) return 'This guest leaves tomorrow. Check them out on the morning.'
    const check = checkOf(r)
    if (!check.ok) return check.why
    const note = `Checked out online. ${KEY_RETURN_LABEL[x.keys]}.`
    const owed = check.express.guestOwed
    if (owed > 0 && r.guarantee === 'card') {
      agreeExpress(r.id, by, 'guest')
      runExpress(r.id, owed, 'Card')
    } else {
      checkOut(r.id, note)
    }
    queue({
      kind: 'bill sent',
      reservationId: r.id,
      vars: { balance: ugx(owed), link: `${window.location.origin}/bill/${tokenFor(r.id, r.arrival)}` },
    })
    update(x.id, { state: 'done', doneVia: via, doneBy: by, doneAt: stamp(), note: undefined })
    return undefined
  }

  return { checkouts: list, add, update, complete, checkOf }
}
