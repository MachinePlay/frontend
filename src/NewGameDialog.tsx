import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  fetchEngines,
  fetchRunners,
  gameUrl,
  startGame,
  type Engine,
  type EngineVersion,
} from './api'
import { button } from './styles'
import { DEFAULT_TC, TC_PRESETS } from './tc'
import { ErrorText, Hint, Modal, Select, StatusDot } from './ui'
import { useEngineVersions } from './useEngineVersions'

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
    <div className="grid grid-cols-[64px_minmax(0,1fr)_112px] items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <Select
        aria-label={`${label} engine`}
        value={engineId}
        onChange={(e) => onEngine(e.target.value)}
      >
        {engines.map((e) => (
          <option key={e.id} value={e.id}>
            {e.owner_login}/{e.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label={`${label} version`}
        value={versionId}
        onChange={(e) => onVersion(e.target.value)}
        disabled={versions.length === 0}
      >
        {versions.length === 0 ? (
          <option value="">Version</option>
        ) : (
          versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version}
            </option>
          ))
        )}
      </Select>
    </div>
  )
}

function NewGameForm({ whiteEngineId }: { whiteEngineId?: string }) {
  const navigate = useNavigate()
  const { data: allEngines = [] } = useQuery({
    queryKey: ['engines'],
    queryFn: fetchEngines,
  })
  const { data: runners = [] } = useQuery({
    queryKey: ['runners'],
    queryFn: fetchRunners,
    staleTime: 5_000,
  })
  const engines = allEngines.filter((e) => (e.version_count ?? 0) > 0)
  // '' means "use the default".
  const [whiteSel, setWhiteSel] = useState(whiteEngineId ?? '')
  const [blackSel, setBlackSel] = useState('')
  const [whiteVerSel, setWhiteVerSel] = useState('')
  const [blackVerSel, setBlackVerSel] = useState('')
  const [runnerSel, setRunnerSel] = useState('')
  const [tc, setTc] = useState(DEFAULT_TC)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const whiteId = whiteSel || engines[0]?.id || ''
  const blackId =
    blackSel || engines.find((e) => e.id !== whiteId)?.id || engines[0]?.id || ''
  const onlineRunners = runners.filter((r) => r.online)
  const runnerId =
    runnerSel || onlineRunners[0]?.runner_id || runners[0]?.runner_id || ''
  const runner = runners.find((r) => r.runner_id === runnerId)

  const whiteVersions = useEngineVersions(engines.find((e) => e.id === whiteId))
  const blackVersions = useEngineVersions(engines.find((e) => e.id === blackId))
  const whiteVersionId = whiteVerSel || whiteVersions[0]?.id || ''
  const blackVersionId = blackVerSel || blackVersions[0]?.id || ''

  const start = async () => {
    if (!whiteId || !blackId || !runner?.online) return
    setStarting(true)
    setError(null)
    try {
      const id = await startGame({
        whiteEngineId: whiteId,
        blackEngineId: blackId,
        runnerId,
        whiteVersionId: whiteVersionId || undefined,
        blackVersionId: blackVersionId || undefined,
        tc,
      })
      navigate(gameUrl(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStarting(false)
    }
  }

  if (engines.length === 0) {
    return <Hint>No engines with an uploaded version yet.</Hint>
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void start()
      }}
    >
      <SideRow
        label="White"
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
        label="Black"
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
      <div className="grid grid-cols-[64px_minmax(0,1fr)_112px] items-center gap-2">
        <span className="text-sm text-muted">Runner</span>
        <Select
          aria-label="Runner"
          value={runnerId}
          onChange={(e) => setRunnerSel(e.target.value)}
          disabled={runners.length === 0}
          leading={runner && <StatusDot online={runner.online} size={7} />}
        >
          {runners.length === 0 ? (
            <option value="">No runners registered</option>
          ) : (
            runners.map((r) => (
              <option key={r.runner_id} value={r.runner_id} disabled={!r.online}>
                {r.name}
                {r.online ? ` · ${r.max_games} slots` : ' (offline)'}
              </option>
            ))
          )}
        </Select>
        <Select
          aria-label="Time control"
          title="Time control (base + increment)"
          value={tc}
          onChange={(e) => setTc(e.target.value)}
        >
          {TC_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      {runner && !runner.online && (
        <ErrorText>Runner {runner.name} is offline</ErrorText>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={starting || !runner?.online}
          className={button.primary}
        >
          {starting ? 'Starting…' : 'Start game'}
        </button>
        <span className="text-xs text-faint">
          The game opens as soon as the runner picks it up.
        </span>
      </div>
    </form>
  )
}

export function NewGameDialog({
  open,
  onClose,
  whiteEngineId,
}: {
  open: boolean
  onClose: () => void
  whiteEngineId?: string
}) {
  return (
    <Modal open={open} onClose={onClose} title="Start a game">
      <NewGameForm whiteEngineId={whiteEngineId} />
    </Modal>
  )
}
