import { createContext, useContext } from 'react'
import type { User } from './api'

export interface AuthState {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => Promise<void>
  // After signup, or null after account deletion.
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
