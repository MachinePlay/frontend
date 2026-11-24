import type {
  ApiTokenOut,
  BookOut,
  EngineDetailOut,
  EngineOut,
  EngineUpdateRequest,
  EngineVersionOut,
  EngineVersionUpdateRequest,
  GameDetailOut,
  GameOut,
  GameStatus,
  HandleCheckOut,
  HardwareInfo,
  PendingSignupOut,
  RunnerDetailOut,
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

/** Only a real 404: a dead backend or a 500 must not read as "doesn't exist". */
export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 404

/** True when the request never reached the backend (down, DNS, CORS, offline). */
export const isUnreachable = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 0

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${API_URL}${path}`, init)
  } catch {
    // No HTTP response at all: down, unresolvable, or blocked by CORS.
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

export const githubLoginUrl = (): string => `${API_URL}/auth/github/login`

export const fetchMe = (): Promise<User | null> =>
  request<User>('/me', { credentials: 'include' }).catch(nullOn401)

export const logout = (): Promise<unknown> =>
  request('/auth/logout', post())

/** Mirrors `DELETED_LOGIN` in the backend's `app/accounts.py`. */
export const DELETED_LOGIN = '[deleted]'

/** Render such a handle as text, not a link to a 404 or its next owner. */
export const isDeletedLogin = (login: string): boolean =>
  login === DELETED_LOGIN

export const deleteAccount = (): Promise<unknown> =>
  request('/me', { method: 'DELETE', credentials: 'include' })

export const fetchEngines = (): Promise<Engine[]> => request('/engine')

export const fetchEngineByName = (
  login: string,
  name: string,
): Promise<EngineDetail> =>
  request(`/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}`)

// A rename moves the engine's URL: navigate to the returned name.
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

export const deleteEngine = (login: string, name: string): Promise<unknown> =>
  request(`/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
  })

const versionPath = (login: string, name: string, versionId: string): string =>
  `/user/${encodeURIComponent(login)}/${encodeURIComponent(name)}/version/${versionId}`

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

export const fetchGame = (id: string): Promise<GameDetail> =>
  request(`/game/${id}`)

export const fetchRunners = (): Promise<Runner[]> => request('/runners')

export const fetchRunner = (id: string): Promise<RunnerDetail> =>
  request(`/runner/${id}`)

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

// Returns the new game id; omitted versions and tc default server-side.
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

export const cancelGame = (id: string): Promise<unknown> =>
  request(`/game/${id}/cancel`, post())

// Static for the life of a deploy, so callers cache it hard.
export const fetchBooks = (): Promise<Book[]> => request('/book')

export const fetchTournaments = (): Promise<Tournament[]> =>
  request('/tournament')

export const fetchTournament = (id: string): Promise<TournamentDetail> =>
  request(`/tournament/${id}`)

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

export const createTournament = (
  req: TournamentCreateRequest,
): Promise<TournamentDetail> => request('/tournament', post(req))

export const cancelTournament = (id: string): Promise<unknown> =>
  request(`/tournament/${id}/cancel`, post())

export const createCliToken = async (): Promise<string> =>
  (await request<TokenOut>('/me/tokens', post())).token

export const fetchTokens = (): Promise<ApiToken[]> =>
  request('/me/tokens', { credentials: 'include' })

export const revokeToken = (id: string): Promise<unknown> =>
  request(`/me/tokens/${id}`, { method: 'DELETE', credentials: 'include' })

export const fetchPendingSignup = (): Promise<PendingSignup | null> =>
  request<PendingSignup>('/auth/pending', { credentials: 'include' }).catch(
    nullOn401,
  )

export const completeSignup = (login: string): Promise<User> =>
  request('/auth/register', post({ login }))

export const checkHandle = (login: string): Promise<HandleCheck> =>
  request(`/auth/handle/${encodeURIComponent(login)}`)

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
export type RunnerDetail = RunnerDetailOut
export type HandleCheck = HandleCheckOut
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
export type Book = BookOut
export type Tournament = TournamentOut
export type TournamentDetail = TournamentDetailOut
export type TournamentGames = TournamentGamesOut
export type TournamentGameRow = TournamentGameRowType
export type TournamentParticipant = TournamentParticipantOut
export type TournamentProgress = TournamentProgressType
export type Standing = StandingRow

export type {
  Rating,
  RatingCategory,
  RatingChange,
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
