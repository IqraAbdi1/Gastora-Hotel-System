import { createContext, useContext } from 'react'
import type { CorporateService } from '../../services/corporate/corporateService'
import type { CorporateAccount, CorporatePolicy } from '../../services/corporate/corporateTypes'

type Drop<F> = F extends (...args: infer A) => infer R
  ? A extends [...infer Rest, unknown]
    ? (...args: Rest) => R
    : never
  : never

/** The service calls, with the signed-in person filled in as the actor. */
type Bound = { [K in Exclude<keyof CorporateService, 'listAccounts' | 'subscribe'>]: Drop<CorporateService[K]> }

export type CorporateValue = Bound & {
  accounts: CorporateAccount[]
  loading: boolean
  error: string | null
  /** The company rules for this hotel, from its size. Set by the platform admin. */
  policy: CorporatePolicy
  byId: (id: string) => CorporateAccount | undefined
}

export const CorporateContext = createContext<CorporateValue | null>(null)

export function useCorporate(): CorporateValue {
  const v = useContext(CorporateContext)
  if (!v) throw new Error('useCorporate must be used inside CorporateProvider')
  return v
}
