import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Chessground } from '../Chessground'
import { useAuth } from '../auth-context'
import {
  fetchEngineByName,
  fetchEngines,
  fetchGames,
  fetchRunners,
  gameUrl,
  liveStreamUrl,
  startGame as apiStartGame,
  type Engine,
  type EngineVersion,
  type Game,
  type LiveStreamEvent,
} from '../api'
import { GameList, Hint, PrimaryButton, Section } from '../components'
import { applyLiveEvent } from '../live'

const LIVE_DISPLAY_LIMIT = 8

// Time controls offered in the new-game form ("base+inc" in seconds).
const TC_PRESETS = [
  { value: '10+0.1', label: '10s + 0.1' },
  { value: '30+0.3', label: '30s + 0.3' },
  { value: '60+1', label: '1m + 1' },
  { value: '180+2', label: '3m + 2' },
  { value: '300+3', label: '5m + 3' },
]
const DEFAULT_TC = '30+0.3'

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

const selectClass = 'bg-neutral-900 border border-neutral-800 rounded px-2 py-1'

// Versions of the selected engine, shared with the engine page's cache entry.
function useEngineVersions(engine: Engine | undefined): EngineVersion[] {
  const { data } = useQuery({
    queryKey: ['engine', engine?.owner_login ?? '', engine?.name ?? ''],
    queryFn: () => fetchEngineByName(engine!.owner_login, engine!.name),
    enabled: engine !== undefined,
    select: (d) => d.versions,
  })
  return data ?? []
}

function SideRow({
  label,
  engines,
  engineId,
  onEngine,
  versions,
  versionId,
  onVersion,
}: {
  label: string
  engines: Engine[]
  engineId: string
  onEngine: (id: string) => void
  versions: EngineVersion[]
  versionId: string
  onVersion: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-400 w-12">{label}</span>
      <select
        className={`${selectClass} flex-1 min-w-0`}
        value={engineId}
        onChange={(e) => onEngine(e.target.value)}
      >
        {engines.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select
        className={`${selectClass} w-28`}
        value={versionId}
        onChange={(e) => onVersion(e.target.value)}
        disabled={versions.length === 0}
      >
        {versions.length === 0 ? (
          <option value="">version</option>
        ) : (
          versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version}
            </option>
          ))
        )}
      </select>
    </div>
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
  const [whiteVerSel, setWhiteVerSel] = useState('')
  const [blackVerSel, setBlackVerSel] = useState('')
  const [runnerSel, setRunnerSel] = useState('')
  const [tcSel, setTcSel] = useState(DEFAULT_TC)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const whiteId = whiteSel || engines[0]?.id || ''
  const blackId = blackSel || engines[Math.min(1, engines.length - 1)]?.id || ''
  // Only online runners can play, so default to the first online one (falling
  // back to any runner so the select still shows a sensible value).
  const onlineRunners = runners.filter((r) => r.online)
  const runnerId =
    runnerSel || onlineRunners[0]?.runner_id || runners[0]?.runner_id || ''
  const selectedRunner = runners.find((r) => r.runner_id === runnerId)

  const whiteVersions = useEngineVersions(engines.find((e) => e.id === whiteId))
  const blackVersions = useEngineVersions(engines.find((e) => e.id === blackId))
  // Versions are sorted newest-first, so the default ('') is the latest.
  const whiteVersionId = whiteVerSel || whiteVersions[0]?.id || ''
  const blackVersionId = blackVerSel || blackVersions[0]?.id || ''

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
    if (!whiteId || !blackId || !selectedRunner?.online) return
    setStarting(true)
    setStartError(null)
    try {
      const id = await apiStartGame({
        whiteEngineId: whiteId,
        blackEngineId: blackId,
        runnerId,
        whiteVersionId: whiteVersionId || undefined,
        blackVersionId: blackVersionId || undefined,
        tc: tcSel,
      })
      navigate(gameUrl(id))
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  const allLive = (games ?? []).filter((g) => g.status === 'playing')
  const live = allLive.slice(0, LIVE_DISPLAY_LIMIT)
  // Everything terminal (ended *and* aborted) — aborted games shouldn't vanish.
  const recent = (games ?? []).filter((g) => g.status !== 'playing').slice(0, 20)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-8">
      <Section title="new game">
        <div className="flex flex-col gap-2 text-sm max-w-xl">
          <SideRow
            label="white"
            engines={engines}
            engineId={whiteId}
            onEngine={(id) => {
              setWhiteSel(id)
              setWhiteVerSel('')
            }}
            versions={whiteVersions}
            versionId={whiteVersionId}
            onVersion={setWhiteVerSel}
          />
          <SideRow
            label="black"
            engines={engines}
            engineId={blackId}
            onEngine={(id) => {
              setBlackSel(id)
              setBlackVerSel('')
            }}
            versions={blackVersions}
            versionId={blackVersionId}
            onVersion={setBlackVerSel}
          />
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 w-12">runner</span>
            <select
              className={`${selectClass} flex-1 min-w-0`}
              value={runnerId}
              onChange={(e) => setRunnerSel(e.target.value)}
              disabled={runners.length === 0}
            >
              {runners.length === 0 ? (
                <option value="">no runners registered</option>
              ) : (
                runners.map((r) => (
                  <option
                    key={r.runner_id}
                    value={r.runner_id}
                    disabled={!r.online}
                  >
                    {r.name}
                    {r.online ? '' : ' (offline)'}
                  </option>
                ))
              )}
            </select>
            <select
              className={`${selectClass} w-28`}
              value={tcSel}
              onChange={(e) => setTcSel(e.target.value)}
              title="time control (base + increment)"
            >
              {TC_PRESETS.map((tc) => (
                <option key={tc.value} value={tc.value}>
                  {tc.label}
                </option>
              ))}
            </select>
            {user ? (
              <PrimaryButton
                onClick={() => void startGame()}
                disabled={
                  starting ||
                  engines.length === 0 ||
                  !whiteId ||
                  !blackId ||
                  !selectedRunner?.online
                }
                className="shrink-0"
              >
                {starting ? 'starting…' : 'start game'}
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={login} className="shrink-0">
                sign in to start a game
              </PrimaryButton>
            )}
          </div>
          {startError && (
            <span className="text-red-400 text-xs">{startError}</span>
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
