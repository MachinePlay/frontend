import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Chessground } from '../Chessground'
import { useAuth } from '../auth-context'
import {
  fetchEngines,
  fetchGames,
  fetchRunners,
  gameUrl,
  liveStreamUrl,
  startGame as apiStartGame,
  type Game,
  type LiveStreamEvent,
} from '../api'
import { GameList, Hint, PrimaryButton, Section } from '../components'
import { applyLiveEvent } from '../live'

const LIVE_DISPLAY_LIMIT = 8

function LiveGameCard({ game }: { game: Game }) {
  const moveNo = Math.max(1, Math.ceil(game.moves.length / 2))
  return (
    <Link
      to={gameUrl(game.id)}
      className="group flex flex-col gap-2 rounded-lg border border-neutral-800 hover:border-neutral-600 bg-neutral-900/60 p-3 transition-colors"
    >
      <Chessground
        className="!w-full"
        config={{
          fen: game.fen,
          viewOnly: true,
          coordinates: false,
          drawable: { enabled: false },
        }}
      />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium truncate">{game.white_name}</span>
        <span className="text-neutral-500">vs</span>
        <span className="font-medium truncate">{game.black_name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          live
        </span>
        <span className="ml-auto">move {moveNo}</span>
      </div>
    </Link>
  )
}

function EngineSelect({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-neutral-400 w-12">{label}</span>
      <select
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 flex-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, login } = useAuth()
  const { data: engines = [] } = useQuery({
    queryKey: ['engines'],
    queryFn: fetchEngines,
  })
  const { data: runners = [] } = useQuery({
    queryKey: ['runners'],
    queryFn: fetchRunners,
    staleTime: 5_000,
  })
  const { data: games, error: gamesError } = useQuery({
    queryKey: ['games'],
    queryFn: fetchGames,
  })
  // '' means "use the default" so the selects work as soon as data arrives.
  const [whiteSel, setWhiteSel] = useState('')
  const [blackSel, setBlackSel] = useState('')
  const [runnerSel, setRunnerSel] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const whiteId = whiteSel || engines[0]?.id || ''
  const blackId = blackSel || engines[Math.min(1, engines.length - 1)]?.id || ''
  const runnerId = runnerSel || runners[0]?.runner_id || ''

  // Live events update the shared ['games'] cache, so this page and any
  // revisit render the freshest state without refetching.
  useEffect(() => {
    const es = new EventSource(liveStreamUrl())
    es.onmessage = (e) => {
      const event: LiveStreamEvent = JSON.parse(e.data)
      queryClient.setQueryData<Game[]>(['games'], (prev) =>
        prev ? applyLiveEvent(prev, event) : prev,
      )
    }
    return () => es.close()
  }, [queryClient])

  const startGame = async () => {
    if (!whiteId || !blackId || !runnerId) return
    setStarting(true)
    setStartError(null)
    try {
      navigate(gameUrl(await apiStartGame(whiteId, blackId, runnerId)))
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  const allLive = (games ?? []).filter((g) => g.status === 'playing')
  const live = allLive.slice(0, LIVE_DISPLAY_LIMIT)
  const recent = (games ?? []).filter((g) => g.status === 'ended').slice(0, 20)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-8">
      <Section title="new game">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center text-sm">
          <EngineSelect label="white" value={whiteId} onChange={setWhiteSel}>
            {engines.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </EngineSelect>
          <EngineSelect label="black" value={blackId} onChange={setBlackSel}>
            {engines.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </EngineSelect>
          <EngineSelect
            label="runner"
            value={runnerId}
            onChange={setRunnerSel}
            disabled={runners.length === 0}
          >
            {runners.length === 0 ? (
              <option value="">no runners connected</option>
            ) : (
              runners.map((r) => (
                <option key={r.runner_id} value={r.runner_id}>
                  {r.name}
                </option>
              ))
            )}
          </EngineSelect>
          {user ? (
            <PrimaryButton
              onClick={() => void startGame()}
              disabled={
                starting ||
                engines.length === 0 ||
                !whiteId ||
                !blackId ||
                !runnerId
              }
            >
              {starting ? 'starting…' : 'start game'}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={login}>
              sign in to start a game
            </PrimaryButton>
          )}
          {startError && (
            <span className="text-red-400 text-xs self-center">
              {startError}
            </span>
          )}
        </div>
      </Section>

      <Section
        title={
          <>
            live
            {allLive.length > 0 && (
              <span className="ml-2 text-neutral-400 normal-case">
                ({allLive.length})
              </span>
            )}
          </>
        }
      >
        {games === undefined ? (
          <Hint>loading…</Hint>
        ) : live.length === 0 ? (
          <Hint>no live games</Hint>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {live.map((g) => (
              <LiveGameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </Section>

      <Section title="recent">
        {gamesError ? (
          <p className="text-red-400 text-sm">failed to load games</p>
        ) : games === undefined ? (
          <Hint>loading…</Hint>
        ) : (
          <GameList games={recent} />
        )}
      </Section>
    </div>
  )
}
