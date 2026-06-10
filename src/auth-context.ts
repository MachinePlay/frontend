import { createContext, useContext } from 'react'
import type { User } from './api'

export interface AuthState {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => Promise<void>
  // Adopt a user established outside the provider (e.g. just-completed signup).
  setUser: (user: User) => void
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
