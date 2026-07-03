import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelTournament,
  fetchTournament,
  liveStreamUrl,
  profileUrl,
  runnerUrl,
  type LiveStreamEvent,
  type Standing,
  type TournamentDetail as TournamentDetailData,
} from '../api'
import {
  GameList,
  Hint,
  LiveGameGrid,
  Section,
  TournamentStatusPill,
} from '../components'
import { useAuth } from '../auth-context'
import { applyLiveEvent } from '../live'
import { computeStandings } from '../standings'
import { formatLabel, relativeTime } from '../format'
import NotFound from './NotFound'

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
  const { data: t, error } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => fetchTournament(id),
    // Poll while running so standings + newly-dispatched pairings show up.
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3_000 : false,
  })

  // Animate the live boards move-by-move (like the home dashboard). Only merge
  // events for games already in this tournament — foreign games are ignored;
  // the poll above adds new pairings, then their board starts updating here.
  useEffect(() => {
    const es = new EventSource(liveStreamUrl())
    es.onmessage = (e) => {
      const event: LiveStreamEvent = JSON.parse(e.data)
      queryClient.setQueryData<TournamentDetailData>(
        ['tournament', id],
        (prev) => {
          if (!prev || !prev.games.some((g) => g.id === event.game_id)) {
            return prev
          }
          return { ...prev, games: applyLiveEvent(prev.games, event) }
        },
      )
    }
    return () => es.close()
  }, [queryClient, id])

  if (error) return <NotFound />
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
  const live = t.games.filter((g) => g.status === 'playing')
  // Derived from the games (which the SSE feed keeps fresh) so standings update
  // the instant a game ends, not just on the next poll.
  const standings = computeStandings(t.participants, t.games)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
            {t.name}
            <TournamentStatusPill status={t.status} />
          </h1>
          <p className="text-sm text-neutral-400">
            {formatLabel(t.format)} · {t.games_per_pairing} game
            {t.games_per_pairing === 1 ? '' : 's'}/pairing · {t.tc} · on{' '}
            <Link
              to={runnerUrl(t.runner_id)}
              className="text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              runner
            </Link>{' '}
            · by{' '}
            <Link
              to={profileUrl(t.created_by)}
              className="text-neutral-300 hover:text-neutral-100 transition-colors"
            >
              {t.created_by}
            </Link>
          </p>
        </div>
        {canCancel && (
          <div className="ml-auto">
            <CancelControl id={t.id} />
          </div>
        )}
      </div>

      <Section title="standings">
        <StandingsTable
          standings={standings}
          headVersionId={t.gauntlet_head_version_id}
        />
      </Section>

      {live.length > 0 && (
        <Section
          title={
            <>
              live now
              <span className="ml-2 text-neutral-400 normal-case">
                ({live.length})
              </span>
            </>
          }
        >
          <LiveGameGrid games={live} />
        </Section>
      )}

      <Section
        title={
          <>
            pairings
            <span className="ml-2 text-neutral-400 normal-case">
              ({t.games.length})
            </span>
          </>
        }
      >
        <GameList games={t.games} />
      </Section>

      <p className="text-xs text-neutral-600">
        created {relativeTime(t.created_at)}
        {t.ended_at && <> · ended {relativeTime(t.ended_at)}</>}
      </p>
    </div>
  )
}
