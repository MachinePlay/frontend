import type {
  ApiTokenOut,
  EngineDetailOut,
  EngineOut,
  EngineVersionOut,
  GameOut,
  PendingSignupOut,
  RunnerOut,
  SseStreamResponse,
  TokenOut,
  UserOut,
  UserProfileOut,
} from './api/generated'

export const API_URL = import.meta.env.VITE_API_URL as string
export const gameStreamUrl = (gameId: string): string =>
  `${API_URL}/stream/game/${gameId}`
export const liveStreamUrl = (): string => `${API_URL}/stream/live`

// Kicks off the GitHub OAuth flow; the backend redirects back here when done.
export const githubLoginUrl = (): string => `${API_URL}/auth/github/login`

// Fetch the logged-in user, or null when the session cookie is absent/expired.
export async function fetchMe(): Promise<User | null> {
  const r = await fetch(`${API_URL}/me`, { credentials: 'include' })
  if (r.status === 401) return null
  if (!r.ok) throw new Error(`GET /me failed: ${r.status}`)
  return (await r.json()) as User
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export async function fetchEngines(): Promise<Engine[]> {
  const r = await fetch(`${API_URL}/engine`)
  if (!r.ok) throw new Error(`GET /engine failed: ${r.status}`)
  return (await r.json()) as Engine[]
}

export async function fetchEngine(id: string): Promise<EngineDetail> {
  const r = await fetch(`${API_URL}/engine/${id}`)
  if (!r.ok) throw new Error(`GET /engine/${id} failed: ${r.status}`)
  return (await r.json()) as EngineDetail
}

export async function fetchEngineByName(
  login: string,
  name: string,
): Promise<EngineDetail> {
  const r = await fetch(
    `${API_URL}/u/${encodeURIComponent(login)}/${encodeURIComponent(name)}`,
  )
  if (!r.ok) throw new Error(`GET /u/${login}/${name} failed: ${r.status}`)
  return (await r.json()) as EngineDetail
}

// GitHub-style canonical frontend URLs. Ownerless engines (none in practice)
// fall back to the id route.
export const profileUrl = (login: string): string => `/${login}`
export const engineUrl = (e: {
  id: string
  name: string
  owner_login?: string | null
}): string => (e.owner_login ? `/${e.owner_login}/${e.name}` : `/engine/${e.id}`)

// Mint a CLI API token for the logged-in user (shown once). Session-authed.
export async function createCliToken(): Promise<string> {
  const r = await fetch(`${API_URL}/me/tokens`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!r.ok) throw new Error(`POST /me/tokens failed: ${r.status}`)
  return ((await r.json()) as TokenOut).token
}

export async function fetchTokens(): Promise<ApiToken[]> {
  const r = await fetch(`${API_URL}/me/tokens`, { credentials: 'include' })
  if (!r.ok) throw new Error(`GET /me/tokens failed: ${r.status}`)
  return (await r.json()) as ApiToken[]
}

export async function revokeToken(id: string): Promise<void> {
  const r = await fetch(`${API_URL}/me/tokens/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!r.ok) throw new Error(`DELETE /me/tokens/${id} failed: ${r.status}`)
}

// The GitHub signup waiting for a handle, or null when none is pending.
export async function fetchPendingSignup(): Promise<PendingSignup | null> {
  const r = await fetch(`${API_URL}/auth/pending`, { credentials: 'include' })
  if (r.status === 401) return null
  if (!r.ok) throw new Error(`GET /auth/pending failed: ${r.status}`)
  return (await r.json()) as PendingSignup
}

// Complete a pending signup with the chosen handle. Throws the backend's
// error message (taken/invalid handle) so the form can show it.
export async function completeSignup(login: string): Promise<User> {
  const r = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login }),
  })
  const body = await r.json()
  if (!r.ok) {
    throw new Error(body?.error?.message ?? `registration failed: ${r.status}`)
  }
  return body as User
}

export async function fetchUserProfile(login: string): Promise<UserProfile> {
  const r = await fetch(`${API_URL}/u/${encodeURIComponent(login)}`)
  if (!r.ok) throw new Error(`GET /u/${login} failed: ${r.status}`)
  return (await r.json()) as UserProfile
}

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export type Engine = EngineOut
export type EngineDetail = EngineDetailOut
export type EngineVersion = EngineVersionOut
export type Runner = RunnerOut
export type Game = GameOut
export type User = UserOut
export type StreamEvent = SseStreamResponse
export type ApiToken = ApiTokenOut
export type PendingSignup = PendingSignupOut
export type UserProfile = UserProfileOut

export type { GameStatus, LiveStreamEvent } from './api/generated'
