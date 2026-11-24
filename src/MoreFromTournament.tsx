import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchTournament,
  fetchTournamentGames,
  gameUrl,
  tournamentUrl,
  type GameStatus,
} from './api'
import { GameRow } from './components'
import { capitalize } from './format'
import { moveNumber } from './games'
import { link } from './styles'
import { Checkbox, Hint } from './ui'

const AUTOPLAY_KEY = 'mp:autoplay'
const PREVIEW = 3

function readAutoplay(): boolean {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) === '1'
  } catch {
    return false
  }
}

function writeAutoplay(on: boolean) {
  try {
    localStorage.setItem(AUTOPLAY_KEY, on ? '1' : '0')
  } catch {
    // Private mode: the setting lasts for this page only.
  }
}

function Column({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="border-b border-line pb-2 text-meta text-faint">
        {title} · {count}
      </span>
      {children}
    </div>
  )
}

function usePreview(id: string, status: GameStatus, running: boolean) {
  return useQuery({
    queryKey: ['tournament-games', id, status, 'preview'],
    queryFn: () =>
      fetchTournamentGames(id, { status, limit: PREVIEW, offset: 0 }),
    refetchInterval: running ? 10_000 : false,
  })
}

/** A tournament game's siblings: what's playing, up next and finished. With
    auto-play on, a game that ends while watched hands over to the next one. */
export function MoreFromTournament({
  tournamentId,
  gameId,
  plies,
  endedAt,
}: {
  tournamentId: string
  gameId: string
  plies: number
  // When this game ended while the page watched it.
  endedAt: number | null
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [autoplay, setAutoplay] = useState(readAutoplay)
  const waiting = autoplay && endedAt !== null
  const { data: t, dataUpdatedAt } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => fetchTournament(tournamentId),
    refetchInterval: (q) =>
      q.state.data?.status === 'running' ? (waiting ? 2_000 : 5_000) : false,
  })
  const running = t?.status === 'running'
  const pending = usePreview(tournamentId, 'pending', running)
  const finished = usePreview(tournamentId, 'ended', running)

  useEffect(() => {
    if (endedAt === null) return
    void queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    void queryClient.invalidateQueries({
      queryKey: ['tournament-games', tournamentId],
    })
  }, [endedAt, queryClient, tournamentId])

  // Only a fetch from after the end knows which games are still playing.
  useEffect(() => {
    if (!waiting || !t || dataUpdatedAt <= endedAt!) return
    const next = t.live_games.find((g) => g.id !== gameId)
    if (next) void navigate(gameUrl(next.id))
  }, [waiting, t, dataUpdatedAt, endedAt, gameId, navigate])

  if (!t) return null

  const done = t.progress.ended + t.progress.aborted

  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-section font-semibold">More from {t.name}</h2>
        <span className="text-meta text-faint">
          {done} / {t.progress.total} played
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-6 text-sm">
          {running && (
            <Checkbox
              checked={autoplay}
              onChange={(on) => {
                setAutoplay(on)
                writeAutoplay(on)
              }}
            >
              Auto-play next game when this one ends
            </Checkbox>
          )}
          <Link to={tournamentUrl(t.id)} className={link}>
            Tournament page →
          </Link>
        </div>
      </div>
      {waiting && running && (
        <p className="text-meta text-accent">
          Waiting for the next game to start…
        </p>
      )}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
        <Column title="Playing" count={t.progress.playing}>
          {t.live_games.length === 0 ? (
            <div className="py-2.5">
              <Hint>Nothing playing</Hint>
            </div>
          ) : (
            t.live_games.map((g) => {
              const me = g.id === gameId
              return (
                <GameRow
                  key={g.id}
                  game={g}
                  active={me}
                  meta={
                    me
                      ? `Watching · m${moveNumber(plies)}`
                      : `Move ${moveNumber(g.moves.length)}`
                  }
                />
              )
            })
          )}
        </Column>
        <Column title="Up next" count={t.progress.pending}>
          {(pending.data?.games ?? []).map((g, i) => (
            <GameRow
              key={g.id}
              game={g}
              meta={i === 0 ? 'Next' : 'Pending'}
              showResult={false}
            />
          ))}
          {pending.data?.games.length === 0 && (
            <div className="py-2.5">
              <Hint>Nothing queued</Hint>
            </div>
          )}
        </Column>
        <Column title="Finished" count={t.progress.ended}>
          {(finished.data?.games ?? []).map((g) => (
            <GameRow
              key={g.id}
              game={g}
              active={g.id === gameId}
              meta={g.id === gameId ? 'Watching' : capitalize(g.reason ?? 'Finished')}
            />
          ))}
          {finished.data?.games.length === 0 && (
            <div className="py-2.5">
              <Hint>None yet</Hint>
            </div>
          )}
        </Column>
      </div>
    </section>
  )
}
