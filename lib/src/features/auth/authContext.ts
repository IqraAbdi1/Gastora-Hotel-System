import { createContext, useContext } from 'react'
import type { Action, Role, RoleId, User } from '../../lib/roles'

export interface AuthValue {
  /** Who signed in. */
  user: User | null
  /** The signed-in user's own role. */
  actualRole: Role | null
  /** The role the app is showing right now (differs while an admin is previewing). */
  role: Role | null
  viewAs: RoleId | null
  isViewingAs: boolean
  login: (email: string) => User | null
  loginAs: (id: string) => User | null
  logout: () => void
  setViewAs: (id: RoleId | null) => void
  can: (action: Action) => boolean
  canOpen: (pathname: string) => boolean
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}