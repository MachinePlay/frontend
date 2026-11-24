import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth-context'
import {
  engineUrl,
  fetchEngines,
  fetchGames,
  fetchRunners,
  fetchTournaments,
  liveStreamUrl,
  tournamentUrl,
  type Engine,
  type Game,
  type LiveStreamEvent,
  type RatingCategory,
  type Tournament,
} from '../api'
import {
  GameList,
  LiveGameGrid,
  TournamentStatusText,
} from '../components'
import { RATING_CATEGORIES, capitalize, formatLabel, formatRating } from '../format'
import { busiestCategory, leaderboard } from '../games'
import { applyLiveEvent } from '../live'
import { NewGameDialog } from '../NewGameDialog'
import { button, link, row, tableHead } from '../styles'
import {
  Hint,
  LiveDot,
  Page,
  RatingDelta,
  SectionHeader,
  Segmented,
  ThinProgress,
} from '../ui'

const LIVE_PREVIEW = 4
const LEADERS = 8
// Refetch on game_start at most this often: a fast tournament starts several a
// second, and live events don't carry a game's tournament or time control.
const REFETCH_THROTTLE_MS = 5_000

function Leaderboard({ engines }: { engines: Engine[] }) {
  const [picked, setPicked] = useState<RatingCategory | null>(null)
  const category = picked ?? busiestCategory(engines)
  const leaders = leaderboard(engines, category).slice(0, LEADERS)
  const grid = 'grid grid-cols-[28px_minmax(0,1fr)_64px_52px_48px] gap-3'

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHeader title="Leaderboard">
        <Segmented
          label="Rating category"
          value={category}
          onChange={setPicked}
          options={RATING_CATEGORIES.map((c) => ({ value: c, label: capitalize(c) }))}
        />
      </SectionHeader>
      <div className="flex flex-col">
        <div className={`${grid} ${tableHead}`}>
          <span>#</span>
          <span>Engine</span>
          <span className="text-right">Rating</span>
          <span className="text-right">Games</span>
          <span className="text-right">7d</span>
        </div>
        {leaders.length === 0 ? (
          <div className="py-3">
            <Hint>No rated {category} games yet</Hint>
          </div>
        ) : (
          leaders.map((e, i) => {
            const r = e.ratings![category]!
            return (
              <Link
                key={e.id}
                to={engineUrl(e)}
                className={`${grid} ${row} items-center py-2.5 text-sm tabular-nums transition-colors hover:bg-surface`}
              >
                <span className="text-faint">{i + 1}</span>
                <span className="truncate">
                  <span className="text-faint">{e.owner_login}/</span>
                  {e.name}
                </span>
                <span className="num text-right">{formatRating(r)}</span>
                <span className="text-right text-muted">{r.games}</span>
                <RatingDelta
                  delta={e.week_delta?.[category] ?? 0}
                  className="text-right text-meta"
                />
              </Link>
            )
          })
        )}
        <Link to={`/engine?cat=${category}`} className={`${link} mt-3 text-sm`}>
          Full leaderboard →
        </Link>
      </div>
    </section>
  )
}

function TournamentRows({ tournaments }: { tournaments: Tournament[] }) {
  if (tournaments.length === 0) return <Hint>No tournaments yet</Hint>
  return (
    <div className="flex flex-col">
      {tournaments.map((t) => (
        <Link
          key={t.id}
          to={tournamentUrl(t.id)}
          className={`${row} flex flex-col gap-2 py-3 transition-colors hover:bg-surface`}
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate font-medium">{t.name}</span>
            <span className="shrink-0 text-xs text-faint">
              {formatLabel(t.format)} · {t.participant_count} engines
            </span>
            <span className="ml-auto shrink-0">
              <TournamentStatusText status={t.status} />
            </span>
          </div>
          <ThinProgress done={t.games_completed} total={t.games_total} />
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  const queryClient = useQueryClient()
  const { user, login } = useAuth()
  const [starting, setStarting] = useState(false)
  const [showAllLive, setShowAllLive] = useState(false)
  const { data: engines = [] } = useQuery({
    queryKey: ['engines'],
    queryFn: fetchEngines,
  })
  const { data: runners = [] } = useQuery({
    queryKey: ['runners'],
    queryFn: fetchRunners,
    refetchInterval: 15_000,
  })
  const { data: games, error: gamesError } = useQuery({
    queryKey: ['games'],
    queryFn: fetchGames,
  })
  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: fetchTournaments,
    refetchInterval: 10_000,
  })

  // Live events update the shared ['games'] cache.
  useEffect(() => {
    let lastRefetch = 0
    const es = new EventSource(liveStreamUrl())
    es.onmessage = (e) => {
      const event: LiveStreamEvent = JSON.parse(e.data)
      queryClient.setQueryData<Game[]>(['games'], (prev) =>
        prev ? applyLiveEvent(prev, event) : prev,
      )
      if (
        event.event.type === 'game_start' &&
        Date.now() - lastRefetch > REFETCH_THROTTLE_MS
      ) {
        lastRefetch = Date.now()
        void queryClient.invalidateQueries({ queryKey: ['games'] })
      }
    }
    return () => es.close()
  }, [queryClient])

  const allLive = (games ?? []).filter((g) => g.status === 'playing')
  const live = showAllLive ? allLive : allLive.slice(0, LIVE_PREVIEW)
  const recent = (games ?? [])
    .filter((g) => g.status === 'ended' || g.status === 'aborted')
    .slice(0, 5)
  const online = runners.filter((r) => r.online).length

  return (
    <Page>
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="flex items-center gap-2.5 text-title font-semibold">
            {allLive.length > 0 && <LiveDot />}
            Live now
          </h1>
          <span className="text-sm text-muted">
            {allLive.length} {allLive.length === 1 ? 'game' : 'games'} · {online}{' '}
            {online === 1 ? 'runner' : 'runners'} online
          </span>
          <div className="ml-auto flex items-center gap-5">
            {allLive.length > LIVE_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllLive((s) => !s)}
                className={`${link} text-sm`}
              >
                {showAllLive ? 'Fewer' : `All live (${allLive.length}) →`}
              </button>
            )}
            <button
              type="button"
              onClick={() => (user ? setStarting(true) : login())}
              className={button.secondary}
            >
              Start a game
            </button>
          </div>
        </div>
        {games === undefined ? (
          <Hint>Loading…</Hint>
        ) : live.length === 0 ? (
          <Hint>No games are being played right now.</Hint>
        ) : (
          <LiveGameGrid games={live} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-2">
        <Leaderboard engines={engines} />
        <div className="flex flex-col gap-11">
          <section className="flex flex-col gap-1.5">
            <SectionHeader title="Tournaments">
              <Link to="/tournament/new" className={link}>
                + New
              </Link>
              <Link to="/tournament" className={link}>
                All →
              </Link>
            </SectionHeader>
            <TournamentRows tournaments={tournaments.slice(0, 3)} />
          </section>
          <section className="flex flex-col gap-1.5">
            <SectionHeader title="Recent games" />
            {gamesError ? (
              <Hint>Couldn't load games</Hint>
            ) : games === undefined ? (
              <Hint>Loading…</Hint>
            ) : (
              <GameList games={recent} />
            )}
          </section>
        </div>
      </div>

      <NewGameDialog open={starting} onClose={() => setStarting(false)} />
    </Page>
  )
}
