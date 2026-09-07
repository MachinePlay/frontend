import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  cancelTournament,
  fetchTournament,
  fetchTournamentGames,
  isDeletedLogin,
  isNotFound,
  liveStreamUrl,
  profileUrl,
  runnerUrl,
  type GameStatus,
  type LiveStreamEvent,
  type Standing,
  type TournamentDetail as TournamentDetailData,
  type TournamentProgress,
} from '../api'
import {
  GameList,
  Hint,
  LiveGameGrid,
  LoadError,
  Section,
  TournamentStatusPill,
} from '../components'
import { useAuth } from '../auth-context'
import { applyLiveEvent } from '../live'
import { formatDuration, formatLabel, relativeTime } from '../format'
import NotFound from './NotFound'

// One page of the pairings list. Small enough to stay responsive on a
// 2000-game tournament, big enough that most tournaments fit in one page.
const GAMES_PAGE = 50

const FILTERS: { label: string; status?: GameStatus }[] = [
  { label: 'all' },
  { label: 'finished', status: 'ended' },
  { label: 'pending', status: 'pending' },
  { label: 'aborted', status: 'aborted' },
]

/** Who created the tournament. A deleted account is recorded as a neutral
    label rather than a handle, so it renders as plain text — there is no
    profile behind it, and the freed handle may belong to someone else now. */
function Creator({ login }: { login: string }) {
  if (isDeletedLogin(login)) {
    return <span className="text-neutral-500">{login}</span>
  }
  return (
    <Link
      to={profileUrl(login)}
      className="text-neutral-300 hover:text-neutral-100 transition-colors"
    >
      {login}
    </Link>
  )
}

function StandingsTable({
  standings,
  headVersionId,
}: {
  standings: Standing[]
  headVersionId: string | null
}) {
  if (standings.length === 0) return <Hint>no results yet</Hint>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-neutral-500 text-xs uppercase tracking-wide">
            <th className="py-1 pr-2 font-normal w-8">#</th>
            <th className="py-1 pr-2 font-normal">engine</th>
            <th className="py-1 px-2 font-normal text-right">P</th>
            <th className="py-1 px-2 font-normal text-right">W</th>
            <th className="py-1 px-2 font-normal text-right">D</th>
            <th className="py-1 px-2 font-normal text-right">L</th>
            <th className="py-1 pl-2 font-normal text-right">score</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr
              key={row.version_id}
              className="border-t border-neutral-800/70 text-neutral-200"
            >
              <td className="py-1.5 pr-2 text-neutral-500 tabular-nums">
                {i + 1}
              </td>
              <td className="py-1.5 pr-2">
                {row.engine_name}
                <span className="ml-1.5 text-xs text-neutral-500">
                  {row.version}
                </span>
                {headVersionId === row.version_id && (
                  <span className="ml-2 text-xs text-green-400">head</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-neutral-400">
                {row.played}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{row.wins}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{row.draws}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {row.losses}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums font-medium">
                {row.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** How far along the tournament is, and roughly how much longer it has to run.
    The bar is the games that have a result; aborted games are counted as done
    (they will not be retried) but tinted apart from the played ones. */
function ProgressBar({
  progress,
  etaSeconds,
}: {
  progress: TournamentProgress
  etaSeconds: number | null | undefined
}) {
  const { total, ended, aborted, playing } = progress
  if (total === 0) return null
  const pct = (n: number) => `${(100 * n) / total}%`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="bg-neutral-400" style={{ width: pct(ended) }} />
        <div className="bg-amber-700/70" style={{ width: pct(aborted) }} />
        <div className="bg-green-600 animate-pulse" style={{ width: pct(playing) }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
        <span className="tabular-nums text-neutral-400">
          {ended} / {total} played
        </span>
        {aborted > 0 && (
          <span className="text-amber-500/80 tabular-nums">
            {aborted} aborted
          </span>
        )}
        {progress.pending > 0 && (
          <span className="tabular-nums">{progress.pending} queued</span>
        )}
        {etaSeconds != null && (
          <span className="ml-auto">~{formatDuration(etaSeconds)} left</span>
        )}
      </div>
    </div>
  )
}

/** The pairings list: paged, and filterable by status. Kept out of the detail
    response — a tournament runs to thousands of games and the page polls. */
function Pairings({
  id,
  total,
  running,
}: {
  id: string
  total: number
  running: boolean
}) {
  const [status, setStatus] = useState<GameStatus | undefined>(undefined)
  const { data, error, isFetching, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: ['tournament-games', id, status ?? 'all'],
      queryFn: ({ pageParam }) =>
        fetchTournamentGames(id, {
          status,
          limit: GAMES_PAGE,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (last, pages) => {
        const loaded = pages.reduce((n, p) => n + p.games.length, 0)
        return loaded < last.total ? loaded : undefined
      },
      // Results land continuously while the tournament runs, but slower than
      // the header polls: a refetch here re-reads every page already loaded.
      refetchInterval: running ? 15_000 : false,
    })

  const games = data?.pages.flatMap((p) => p.games) ?? []
  const matching = data?.pages[0]?.total ?? total

  return (
    <Section
      title={
        <>
          pairings
          <span className="ml-2 text-neutral-400 normal-case">({matching})</span>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setStatus(f.status)}
              className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                status === f.status
                  ? 'border-neutral-500 bg-neutral-800 text-neutral-100'
                  : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {error ? (
          <Hint>could not load the pairings</Hint>
        ) : (
          <>
            <GameList games={games} />
            {hasNextPage && (
              <button
                type="button"
                disabled={isFetching}
                onClick={() => void fetchNextPage()}
                className="self-start text-sm text-neutral-400 hover:text-neutral-100 transition-colors disabled:opacity-40"
              >
                {isFetching ? 'loading…' : `load more (${games.length}/${matching})`}
              </button>
            )}
          </>
        )}
      </div>
    </Section>
  )
}

function CancelControl({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const cancel = useMutation({
    mutationFn: () => cancelTournament(id),
    onSuccess: async () => {
      setArmed(false)
      await queryClient.invalidateQueries({ queryKey: ['tournament', id] })
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={cancel.isPending}
        onClick={() => (armed ? cancel.mutate() : setArmed(true))}
        className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
          armed
            ? 'border-red-700 text-red-400 hover:bg-red-950'
            : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
        }`}
      >
        {cancel.isPending
          ? 'cancelling…'
          : armed
            ? 'really cancel?'
            : 'cancel tournament'}
      </button>
      {cancel.isError && (
        <span className="text-red-400 text-xs">
          {cancel.error instanceof Error ? cancel.error.message : 'failed'}
        </span>
      )}
    </div>
  )
}

// Mounted at /tournament/:id.
export default function TournamentDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const {
    data: t,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => fetchTournament(id),
    // Poll while running so standings + newly-dispatched pairings show up.
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3_000 : false,
  })

  // Animate the live boards move-by-move (like the home dashboard). Only merge
  // events for boards already on screen — foreign games are ignored; the poll
  // above adds newly-dispatched ones, then their board starts updating here.
  //
  // Merging locally is all this does: refetching on game_end instead would fire
  // once per finished game, which on a short time control is several times a
  // second. The polls are what refresh standings and the pairings list, and a
  // few seconds' lag there is not worth the traffic.
  useEffect(() => {
    const es = new EventSource(liveStreamUrl())
    es.onmessage = (e) => {
      const event: LiveStreamEvent = JSON.parse(e.data)
      queryClient.setQueryData<TournamentDetailData>(
        ['tournament', id],
        (prev) => {
          if (!prev || !prev.live_games.some((g) => g.id === event.game_id)) {
            return prev
          }
          return {
            ...prev,
            live_games: applyLiveEvent(prev.live_games, event),
          }
        },
      )
    }
    return () => es.close()
  }, [queryClient, id])

  if (error) {
    return isNotFound(error) ? (
      <NotFound />
    ) : (
      <LoadError
        what="this tournament"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }
  if (!t) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Hint>loading…</Hint>
      </div>
    )
  }

  const canCancel =
    t.status === 'running' &&
    (user?.login === t.created_by || user?.is_admin === true)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
            {t.name}
            <TournamentStatusPill status={t.status} />
          </h1>
          <p className="text-sm text-neutral-400">
            {formatLabel(t.format)} · {t.progress.total} game
            {t.progress.total === 1 ? '' : 's'}
            {/* Only worth spelling out when there is more than one pairing to
                divide by — for a two-engine match the total says it all. */}
            {t.participants.length > 2 && <> ({t.games_per_pairing}/pairing)</>}{' '}
            · {t.tc} · on{' '}
            <Link
              to={runnerUrl(t.runner_id)}
              className="text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              runner
            </Link>{' '}
            · {t.book ? (t.book_name ?? t.book) : 'no book'} · by{' '}
            <Creator login={t.created_by} />
          </p>
        </div>
        {canCancel && (
          <div className="ml-auto">
            <CancelControl id={t.id} />
          </div>
        )}
      </div>

      <ProgressBar progress={t.progress} etaSeconds={t.eta_seconds} />

      <Section title="standings">
        <StandingsTable
          standings={t.standings}
          headVersionId={t.gauntlet_head_version_id}
        />
      </Section>

      {t.live_games.length > 0 && (
        <Section
          title={
            <>
              live now
              <span className="ml-2 text-neutral-400 normal-case">
                ({t.live_games.length})
              </span>
            </>
          }
        >
          <LiveGameGrid games={t.live_games} />
        </Section>
      )}

      <Pairings
        id={t.id}
        total={t.progress.total}
        running={t.status === 'running'}
      />

      <p className="text-xs text-neutral-600">
        created {relativeTime(t.created_at)}
        {t.ended_at && <> · ended {relativeTime(t.ended_at)}</>}
      </p>
    </div>
  )
}
