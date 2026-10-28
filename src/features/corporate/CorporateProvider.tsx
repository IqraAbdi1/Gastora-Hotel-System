import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { POLICY_PRESETS } from '../../lib/corporate'
import { corporateService } from '../../services'
import type { CorporateAccount, CorporateActor } from '../../services/corporate/corporateTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { CorporateContext } from './corporateContext'
import type { CorporateValue } from './corporateContext'

// Company accounts for every screen that needs them. Lives in Root next to the other hotel data.
// The company rules come from the hotel's size, which the platform admin sets. The hotel cannot change them.
export default function CorporateProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth()
  const { tenant } = useFeatures()
  const [accounts, setAccounts] = useState<CorporateAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      corporateService
        .listAccounts()
        .then((list) => {
          if (!alive) return
          setAccounts(list)
          setError(null)
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load company accounts'))
        .finally(() => alive && setLoading(false))
    load()
    const stop = corporateService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [])

  // The role shown on screen, so "view as" previews behave like that role.
  const actor = useMemo<CorporateActor | null>(
    () => (user && role ? { id: user.id, name: user.name, role: role.id } : null),
    [user, role],
  )
  const need = useCallback(() => {
    if (!actor) throw new Error('Sign in first')
    return actor
  }, [actor])

  const policy = POLICY_PRESETS[tenant.companySize]
  const s = corporateService

  const value: CorporateValue = {
    accounts,
    loading,
    error,
    policy,
    byId: (id) => accounts.find((a) => a.id === id),
    requestAccount: (input) => s.requestAccount(input, need()),
    approveAccount: (id, note) => s.approveAccount(id, note, need()),
    declineAccount: (id, reason) => s.declineAccount(id, reason, need()),
    setStatus: (id, status, reason) => s.setStatus(id, status, reason, need()),
    setCredit: (id, limit, terms, reason, pol) => s.setCredit(id, limit, terms, reason, pol, need()),
    updateBilling: (id, billing) => s.updateBilling(id, billing, need()),
    saveContact: (id, contact) => s.saveContact(id, contact, need()),
    saveAgreement: (id, agreement, reason) => s.saveAgreement(id, agreement, reason, need()),
  }

  return <CorporateContext.Provider value={value}>{children}</CorporateContext.Provider>
}
