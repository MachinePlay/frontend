import type {
  ApiTokenOut,
  EngineDetailOut,
  EngineOut,
  EngineUpdateRequest,
  EngineVersionOut,
  EngineVersionUpdateRequest,
  GameDetailOut,
  GameOut,
  GameStatus,
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
  TournamentGameRow as TournamentGameRowType,
  TournamentGamesOut,
  TournamentOut,
  TournamentParticipantOut,
  TournamentProgress as TournamentProgressType,
  StandingRow,
  UserOut,
  UserProfileOut,
} from './api/generated'

export const API_URL = import.meta.env.VITE_API_URL as string

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got an answer at all. */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** True only when the backend positively answered "no such thing". A dead
    backend or a 500 is *not* a 404 — pages must not show "page doesn't
    exist" for those. */
export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 404

/** True when the request never reached the backend (down, DNS, CORS, offline). */
export const isUnreachable = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 0

// Fetch + json with the backend's error envelope surfaced as the message.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${API_URL}${path}`, init)
  } catch {
    // fetch only rejects when there was no HTTP response: the API is down,
    // unresolvable, or blocked by CORS. Status 0 marks that apart from a
    // real HTTP error so callers don't mistake it for "not found".
    throw new ApiError(`could not reach the API at ${API_URL}`, 0)
  }
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

/** The name public history shows in place of a deleted account's handle. Not a
    legal handle, so it never collides with a real user — see `DELETED_LOGIN` in
    the backend's `app/accounts.py`. */
export const DELETED_LOGIN = '[deleted]'

/** True when a recorded handle belongs to an account that no longer exists, so
    callers render it as plain text instead of a link to a 404 (or, worse, to
    whoever registered the freed handle next). */
export const isDeletedLogin = (login: string): boolean =>
  login === DELETED_LOGIN

/** Delete the logged-in account — whoever the session cookie names, so there is
    nothing to pass. Engines, uploaded versions and registry images go; live
    games and tournaments end immediately; played history stays. The typed-handle
    confirmation is a UI gate (see DangerZone), not part of the request. */
export const deleteAccount = (): Promise<unknown> =>
  request('/me', { method: 'DELETE', credentials: 'include' })

export const fetchEngines = (): Promise<Engine[]> => request('/engine')

export const fetchEngineByName = (
  login: string,
  name: string,
): Promise<EngineDetail> =>
  request(`/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}`)

// Edit an engine's owner-managed metadata (owner/admin only). Omitted fields
// are left unchanged; `tags` replaces the whole list. A rename moves the
// engine's URL, so callers should navigate to the returned name.
export const updateEngine = (
  login: string,
  name: string,
  patch: EngineUpdateRequest,
): Promise<EngineDetail> =>
  request(`/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

// Delete an engine, its versions, and its registry images (owner/admin only).
// Refused with a 409 while the engine has games pending or playing.
export const deleteEngine = (login: string, name: string): Promise<unknown> =>
  request(`/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
  })

const versionPath = (login: string, name: string, versionId: string): string =>
  `/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}/version/${versionId}`

// Rename one uploaded version (owner/admin only). Only the label moves —
// finished games keep the version string they recorded. Returns the engine.
export const updateEngineVersion = (
  login: string,
  name: string,
  versionId: string,
  patch: EngineVersionUpdateRequest,
): Promise<EngineDetail> =>
  request(versionPath(login, name, versionId), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

// Delete one uploaded version and its registry image (owner/admin only).
// Refused with a 409 while that version has a game pending or playing.
export const deleteEngineVersion = (
  login: string,
  name: string,
  versionId: string,
): Promise<unknown> =>
  request(versionPath(login, name, versionId), {
    method: 'DELETE',
    credentials: 'include',
  })

export const fetchUserProfile = (login: string): Promise<UserProfile> =>
  request(`/user/${encodeURIComponent(login)}`)

export const fetchGames = (): Promise<Game[]> => request('/game')

// One game with its per-ply analysis; the list endpoints leave that out.
export const fetchGame = (id: string): Promise<GameDetail> =>
  request(`/game/${id}`)

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

// One page of a tournament's pairings, in schedule order. Separate from the
// detail because a tournament runs to thousands of games: the detail carries
// only standings, progress and the live boards.
export const fetchTournamentGames = (
  id: string,
  opts: { status?: GameStatus; limit: number; offset: number },
): Promise<TournamentGames> => {
  const params = new URLSearchParams({
    limit: String(opts.limit),
    offset: String(opts.offset),
  })
  if (opts.status) params.set('status', opts.status)
  return request(`/tournament/${id}/games?${params}`)
}

// Create a tournament and start dispatching its pairings; returns the detail
// (participants + standings + progress). `tc`/`gauntletHeadId` are optional.
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
export type GameDetail = GameDetailOut
export type User = UserOut
export type StreamEvent = SseStreamResponse
export type ApiToken = ApiTokenOut
export type PendingSignup = PendingSignupOut
export type UserProfile = UserProfileOut
export type Tournament = TournamentOut
export type TournamentDetail = TournamentDetailOut
export type TournamentGames = TournamentGamesOut
export type TournamentGameRow = TournamentGameRowType
export type TournamentParticipant = TournamentParticipantOut
export type TournamentProgress = TournamentProgressType
export type Standing = StandingRow

export type {
  EngineUpdateRequest,
  SearchInfo,
  UciLine,
  EngineVersionUpdateRequest,
  GameStatus,
  LiveStreamEvent,
  TournamentCreateRequest,
  TournamentFormat,
  TournamentStatus,
} from './api/generated'
