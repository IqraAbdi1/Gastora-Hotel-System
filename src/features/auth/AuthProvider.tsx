import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { USERS, pathAllowed, roleById } from '../../lib/roles'
import type { Action, RoleId, User } from '../../lib/roles'
import { AuthContext } from './authContext'
import type { AuthValue } from './authContext'

const KEY = 'gastora.user'

// Keeps you signed in across a refresh. Wrapped, because storage can be blocked.
function readStored(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // Private window or blocked storage: the sign-in just will not survive a refresh.
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(readStored)
  const [viewAs, setViewAsState] = useState<RoleId | null>(null)

  const signIn = useCallback((user: User | undefined) => {
    if (!user) return null
    setUserId(user.id)
    setViewAsState(null)
    writeStored(user.id)
    return user
  }, [])

  const login = useCallback(
    (email: string) => signIn(USERS.find((u) => u.email === email.trim().toLowerCase())),
    [signIn],
  )
  const loginAs = useCallback((id: string) => signIn(USERS.find((u) => u.id === id)), [signIn])

  const logout = useCallback(() => {
    setUserId(null)
    setViewAsState(null)
    writeStored(null)
  }, [])

  const value = useMemo<AuthValue>(() => {
    const user = USERS.find((u) => u.id === userId) ?? null
    const actualRole = user ? roleById(user.role) : null
    // Only hotel admin and owner can preview another role.
    const previewing = !!(actualRole?.canViewAs && viewAs)
    const role = previewing && viewAs ? roleById(viewAs) : actualRole
    return {
      user,
      actualRole,
      role,
      viewAs: previewing ? viewAs : null,
      isViewingAs: previewing,
      login,
      loginAs,
      logout,
      setViewAs: setViewAsState,
      can: (action: Action) => !!role && role.actions.includes(action),
      canOpen: (pathname: string) => !!role && pathAllowed(role, pathname),
    }
  }, [userId, viewAs, login, loginAs, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}