import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelTournament,
  fetchRunner,
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
import { GameList, LiveGameGrid, TournamentStatusPill } from '../components'
import { useAuth } from '../auth-context'
import { applyLiveEvent } from '../live'
import { formatDuration, formatLabel, formatRating, relativeTime } from '../format'
import { link, row, tableHead } from '../styles'
import { formatTc } from '../tc'
import {
  ConfirmButton,
  Hint,
  Loading,
  LoadError,
  Page,
  RatingDelta,
  SectionHeader,
  Segmented,
} from '../ui'
import NotFound from './NotFound'

const GAMES_PAGE = 50

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ended', label: 'Finished' },
  { value: 'pending', label: 'Pending' },
  { value: 'aborted', label: 'Aborted' },
] as const

type Filter = (typeof FILTERS)[number]['value']

function Person({ login }: { login: string }) {
  if (isDeletedLogin(login)) return <span>{login}</span>
  return (
    <Link to={profileUrl(login)} className="text-fg transition-colors hover:text-muted">
      {login}
    </Link>
  )
}

function StandingsTable({
  standings,
  headVersionId,
  rated,
}: {
  standings: Standing[]
  headVersionId: string | null
  rated: boolean
}) {
  if (standings.length === 0) return <Hint>No results yet</Hint>
  const grid = rated
    ? 'grid grid-cols-[20px_minmax(0,1fr)_28px_28px_28px_28px_44px] gap-2 sm:grid-cols-[28px_minmax(0,1fr)_36px_36px_36px_36px_52px_64px_44px] sm:gap-3'
    : 'grid grid-cols-[20px_minmax(0,1fr)_28px_28px_28px_28px_44px] gap-2 sm:grid-cols-[28px_minmax(0,1fr)_36px_36px_36px_36px_52px] sm:gap-3'
  return (
    <div className="flex flex-col">
      <div className={`${grid} ${tableHead}`}>
        <span>#</span>
        <span>Engine</span>
        <span className="text-right">P</span>
        <span className="text-right">W</span>
        <span className="text-right">D</span>
        <span className="text-right">L</span>
        <span className="text-right">Score</span>
        {rated && (
          <>
            <span className="hidden text-right sm:block">Rating</span>
            <span className="hidden text-right sm:block">±</span>
          </>
        )}
      </div>
      {standings.map((s, i) => (
        <div
          key={s.version_id}
          className={`${grid} ${row} items-center py-2.5 text-sm tabular-nums`}
        >
          <span className="text-faint">{i + 1}</span>
          <span className="min-w-0 truncate">
            {s.engine_name}{' '}
            <span className="num text-xs text-faint">{s.version}</span>
            {headVersionId === s.version_id && (
              <span className="ml-2 text-xs text-muted">head</span>
            )}
          </span>
          <span className="text-right text-muted">{s.played}</span>
          <span className="text-right">{s.wins}</span>
          <span className="text-right">{s.draws}</span>
          <span className="text-right">{s.losses}</span>
          <span className="text-right font-semibold">{s.score}</span>
          {rated && (
            <>
              <span
                className="num hidden text-right text-muted sm:block"
                title={s.rating ? `Rating deviation ${Math.round(s.rating.phi)}` : undefined}
              >
                {s.rating ? formatRating(s.rating) : '—'}
              </span>
              <RatingDelta
                delta={s.rating_delta ?? 0}
                className="hidden text-right text-meta sm:block"
              />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/** Segments for played, aborted and playing games, then a legend. */
function ProgressBar({
  progress,
  etaSeconds,
}: {
  progress: TournamentProgress
  etaSeconds: number | null | undefined
}) {
  const { total, ended, aborted, playing, pending } = progress
  if (total === 0) return null
  const pct = (n: number) => `${(100 * n) / total}%`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-track">
        <span className="bg-muted" style={{ width: pct(ended) }} />
        <span className="bg-loss/70" style={{ width: pct(aborted) }} />
        <span className="bg-accent" style={{ width: pct(playing) }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta tabular-nums text-faint">
        <span className="text-muted">
          {ended} / {total} played
        </span>
        {aborted > 0 && <span className="text-loss">{aborted} aborted</span>}
        {playing > 0 && <span className="text-accent">{playing} playing</span>}
        {pending > 0 && <span>{pending} queued</span>}
        {etaSeconds != null && (
          <span className="ml-auto">~{formatDuration(etaSeconds)} left</span>
        )}
      </div>
    </div>
  )
}

function Pairings({ id, running }: { id: string; running: boolean }) {
  const [filter, setFilter] = useState<Filter>('all')
  const status: GameStatus | undefined = filter === 'all' ? undefined : filter
  const { data, error, isFetching, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: ['tournament-games', id, filter],
      queryFn: ({ pageParam }) =>
        fetchTournamentGames(id, { status, limit: GAMES_PAGE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (last, pages) => {
        const loaded = pages.reduce((n, p) => n + p.games.length, 0)
        return loaded < last.total ? loaded : undefined
      },
      // Slower than the header: a refetch re-reads every loaded page.
      refetchInterval: running ? 15_000 : false,
    })

  const games = data?.pages.flatMap((p) => p.games) ?? []
  const matching = data?.pages[0]?.total

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Pairings" count={matching}>
        <Segmented
          label="Pairings filter"
          value={filter}
          onChange={setFilter}
          options={FILTERS}
        />
      </SectionHeader>
      {error ? (
        <Hint>Couldn't load the pairings</Hint>
      ) : (
        <>
          <GameList games={games} empty={data ? 'No games match' : 'Loading…'} />
          {hasNextPage && (
            <button
              type="button"
              disabled={isFetching}
              onClick={() => void fetchNextPage()}
              className={`${link} self-start text-sm disabled:opacity-40`}
            >
              {isFetching ? 'Loading…' : `Load more (${games.length}/${matching})`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

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
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3_000 : false,
  })
  const { data: runner } = useQuery({
    queryKey: ['runner', t?.runner_id],
    queryFn: () => fetchRunner(t!.runner_id),
    enabled: t !== undefined,
    staleTime: 60_000,
  })

  // Animate the boards already on screen; the poll adds new ones. No refetch
  // on game_end: at short time controls that fires several times a second.
  useEffect(() => {
    const es = new EventSource(liveStreamUrl())
    es.onmessage = (e) => {
      const event: LiveStreamEvent = JSON.parse(e.data)
      queryClient.setQueryData<TournamentDetailData>(['tournament', id], (prev) => {
        if (!prev || !prev.live_games.some((g) => g.id === event.game_id)) {
          return prev
        }
        return { ...prev, live_games: applyLiveEvent(prev.live_games, event) }
      })
    }
    return () => es.close()
  }, [queryClient, id])

  if (error) {
    return isNotFound(error) ? (
      <NotFound />
    ) : (
      <LoadError what="this tournament" error={error} onRetry={() => void refetch()} />
    )
  }
  if (!t) return <Loading />

  const canCancel =
    t.status === 'running' && (user?.login === t.created_by || user?.is_admin === true)

  return (
    <Page>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title font-semibold">{t.name}</h1>
            <TournamentStatusPill status={t.status} />
          </div>
          <p className="text-sm text-muted">
            {formatLabel(t.format)} · {t.progress.total}{' '}
            {t.progress.total === 1 ? 'game' : 'games'}
            {t.participants.length > 2 && <> ({t.games_per_pairing}/pairing)</>} ·{' '}
            <span className="num">{formatTc(t.tc)}</span> ·{' '}
            {t.rated ? `rated ${t.rating_category}` : 'unrated'} · on{' '}
            <Link
              to={runnerUrl(t.runner_id)}
              className="text-fg transition-colors hover:text-muted"
            >
              {runner?.name ?? 'runner'}
            </Link>{' '}
            · {t.book ? `${t.book_name ?? t.book} book` : 'no book'} · by{' '}
            <Person login={t.created_by} />
          </p>
        </div>
        {canCancel && (
          <span className="ml-auto">
            <ConfirmButton
              label="Cancel tournament"
              confirmLabel="Really cancel?"
              busyLabel="Cancelling…"
              onConfirm={async () => {
                await cancelTournament(t.id)
                await queryClient.invalidateQueries({ queryKey: ['tournament', id] })
                await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
              }}
            />
          </span>
        )}
      </div>

      <ProgressBar progress={t.progress} etaSeconds={t.eta_seconds} />

      <div
        className={`grid grid-cols-1 gap-12 ${t.live_games.length > 0 ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]' : ''}`}
      >
        <section className="flex min-w-0 flex-col gap-3">
          <SectionHeader title="Standings" />
          <StandingsTable
            standings={t.standings}
            headVersionId={t.gauntlet_head_version_id}
            rated={t.rated}
          />
        </section>
        {t.live_games.length > 0 && (
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHeader title="Live now" count={t.live_games.length} />
            <LiveGameGrid games={t.live_games} columns={2} />
          </section>
        )}
      </div>

      <Pairings id={t.id} running={t.status === 'running'} />

      <p className="text-xs text-faint">
        Created {relativeTime(t.created_at)}
        {t.ended_at && <> · ended {relativeTime(t.ended_at)}</>}
      </p>
    </Page>
  )
}
