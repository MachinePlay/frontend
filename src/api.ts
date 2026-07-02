import type {
  ApiTokenOut,
  EngineDetailOut,
  EngineOut,
  EngineVersionOut,
  GameOut,
  HardwareInfo,
  PendingSignupOut,
  RunnerLiveEvent,
  RunnerOut,
  SseStreamResponse,
  Telemetry,
  StartGameResponse,
  TokenOut,
  TournamentCreateRequest,
  TournamentDetailOut,
  TournamentOut,
  TournamentParticipantOut,
  StandingRow,
  UserOut,
  UserProfileOut,
} from './api/generated'

export const API_URL = import.meta.env.VITE_API_URL as string

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Fetch + json with the backend's error envelope surfaced as the message.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, init)
  if (!r.ok) {
    let message = `${init?.method ?? 'GET'} ${path} failed: ${r.status}`
    try {
      const body = (await r.json()) as { error?: { message?: string } }
      message = body.error?.message ?? message
    } catch {
      // body wasn't json; keep the generic message
    }
    throw new ApiError(message, r.status)
  }
  return (await r.json()) as T
}

function post(body?: unknown): RequestInit {
  return {
    method: 'POST',
    credentials: 'include',
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  }
}

const nullOn401 = (e: unknown): null => {
  if (e instanceof ApiError && e.status === 401) return null
  throw e
}

export const gameStreamUrl = (gameId: string): string =>
  `${API_URL}/stream/game/${gameId}`
export const liveStreamUrl = (): string => `${API_URL}/stream/live`
export const runnerStreamUrl = (): string => `${API_URL}/stream/runners`

// Kicks off the GitHub OAuth flow; the backend redirects back when done.
export const githubLoginUrl = (): string => `${API_URL}/auth/github/login`

// The logged-in user, or null when the session cookie is absent/expired.
export const fetchMe = (): Promise<User | null> =>
  request<User>('/me', { credentials: 'include' }).catch(nullOn401)

export const logout = (): Promise<unknown> =>
  request('/auth/logout', post())

export const fetchEngines = (): Promise<Engine[]> => request('/engine')

export const fetchEngineByName = (
  login: string,
  name: string,
): Promise<EngineDetail> =>
  request(`/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}`)

export const fetchUserProfile = (login: string): Promise<UserProfile> =>
  request(`/user/${encodeURIComponent(login)}`)

export const fetchGames = (): Promise<Game[]> => request('/game')

export const fetchGame = (id: string): Promise<Game> => request(`/game/${id}`)

export const fetchRunners = (): Promise<Runner[]> => request('/runners')

export const fetchRunner = (id: string): Promise<Runner> =>
  request(`/runner/${id}`)

// Edit a runner's owner-managed metadata (owner only). Omitted fields are left
// unchanged.
export const updateRunner = (
  id: string,
  patch: { name?: string; description?: string },
): Promise<Runner> =>
  request(`/runner/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

// Schedule a game; returns the new game id. Version ids are optional —
// the backend defaults each side to the engine's latest upload — as is the
// time control ("base+inc" seconds), which defaults server-side.
export const startGame = async (req: {
  whiteEngineId: string
  blackEngineId: string
  runnerId: string
  whiteVersionId?: string
  blackVersionId?: string
  tc?: string
}): Promise<string> => {
  const r = await request<StartGameResponse>(
    '/game',
    post({
      white_engine_id: req.whiteEngineId,
      black_engine_id: req.blackEngineId,
      runner_id: req.runnerId,
      white_version_id: req.whiteVersionId ?? null,
      black_version_id: req.blackVersionId ?? null,
      tc: req.tc ?? null,
    }),
  )
  return r.id
}

// Stop a running game; it ends as aborted with reason "cancelled".
export const cancelGame = (id: string): Promise<unknown> =>
  request(`/game/${id}/cancel`, post())

export const fetchTournaments = (): Promise<Tournament[]> =>
  request('/tournament')

export const fetchTournament = (id: string): Promise<TournamentDetail> =>
  request(`/tournament/${id}`)

// Create a tournament and start dispatching its pairings; returns the detail
// (participants + standings + games). `tc`/`gauntletHeadId` are optional.
export const createTournament = (
  req: TournamentCreateRequest,
): Promise<TournamentDetail> => request('/tournament', post(req))

// Stop a running tournament (creator or admin only).
export const cancelTournament = (id: string): Promise<unknown> =>
  request(`/tournament/${id}/cancel`, post())

// Mint a CLI API token for the logged-in user (plaintext shown once).
export const createCliToken = async (): Promise<string> =>
  (await request<TokenOut>('/me/tokens', post())).token

export const fetchTokens = (): Promise<ApiToken[]> =>
  request('/me/tokens', { credentials: 'include' })

export const revokeToken = (id: string): Promise<unknown> =>
  request(`/me/tokens/${id}`, { method: 'DELETE', credentials: 'include' })

// The GitHub signup waiting for a handle, or null when none is pending.
export const fetchPendingSignup = (): Promise<PendingSignup | null> =>
  request<PendingSignup>('/auth/pending', { credentials: 'include' }).catch(
    nullOn401,
  )

// Complete a pending signup; throws the backend's message on a bad handle.
export const completeSignup = (login: string): Promise<User> =>
  request('/auth/register', post({ login }))

// GitHub-style frontend URLs.
export const profileUrl = (login: string): string => `/${login}`
export const engineUrl = (e: { name: string; owner_login: string }): string =>
  `/${e.owner_login}/${e.name}`
export const gameUrl = (id: string): string => `/game/${id}`
export const runnerUrl = (id: string): string => `/runners/${id}`
export const tournamentUrl = (id: string): string => `/tournament/${id}`

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export type Engine = EngineOut
export type EngineDetail = EngineDetailOut
export type EngineVersion = EngineVersionOut
export type Runner = RunnerOut
export type RunnerLive = RunnerLiveEvent
export type Hardware = HardwareInfo
export type RunnerTelemetry = Telemetry
export type Game = GameOut
export type User = UserOut
export type StreamEvent = SseStreamResponse
export type ApiToken = ApiTokenOut
export type PendingSignup = PendingSignupOut
export type UserProfile = UserProfileOut
export type Tournament = TournamentOut
export type TournamentDetail = TournamentDetailOut
export type TournamentParticipant = TournamentParticipantOut
export type Standing = StandingRow

export type {
  GameStatus,
  LiveStreamEvent,
  TournamentCreateRequest,
  TournamentFormat,
  TournamentStatus,
} from './api/generated'
