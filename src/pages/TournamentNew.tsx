import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth-context'
import {
  createTournament,
  fetchEngines,
  fetchRunners,
  tournamentUrl,
  type Engine,
  type TournamentFormat,
} from '../api'
import { Hint, PrimaryButton, Section } from '../components'
import { useEngineVersions } from '../useEngineVersions'
import { DEFAULT_TC, TC_PRESETS } from '../tc'

const selectClass = 'bg-neutral-900 border border-neutral-800 rounded px-2 py-1'
const fieldClass =
  'bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm'

// C(n,2) for round robin, (n-1) for gauntlet — the number of distinct pairings.
function pairingCount(format: TournamentFormat, n: number): number {
  if (n < 2) return 0
  return format === 'gauntlet' ? n - 1 : (n * (n - 1)) / 2
}

// One selectable engine: checkbox + name, plus a version picker and a
// gauntlet-head control once it's selected. `versionId` is '' for "latest".
function EngineEntryRow({
  engine,
  checked,
  gauntlet,
  isHead,
  versionId,
  onToggle,
  onVersion,
  onMakeHead,
}: {
  engine: Engine
  checked: boolean
  gauntlet: boolean
  isHead: boolean
  versionId: string
  onToggle: () => void
  onVersion: (versionId: string) => void
  onMakeHead: () => void
}) {
  // Only fetch versions once the engine is actually selected.
  const versions = useEngineVersions(checked ? engine : undefined)
  return (
    <div
      className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors ${
        checked
          ? 'border-neutral-600 bg-neutral-900'
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
        <input
          type="checkbox"
          className="accent-neutral-300"
          checked={checked}
          onChange={onToggle}
        />
        <span className="text-sm text-neutral-100 truncate">
          {engine.owner_login}/{engine.name}
        </span>
      </label>
      {checked && (
        <select
          className={`${selectClass} text-xs w-28 shrink-0`}
          value={versionId}
          onChange={(e) => onVersion(e.target.value)}
          title="version to enter"
        >
          <option value="">latest</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version}
            </option>
          ))}
        </select>
      )}
      {gauntlet &&
        checked &&
        (isHead ? (
          <span className="text-xs text-green-400 shrink-0">head</span>
        ) : (
          <button
            type="button"
            onClick={onMakeHead}
            className="text-xs text-neutral-500 hover:text-neutral-200 shrink-0"
          >
            make head
          </button>
        ))}
    </div>
  )
}

export default function TournamentNew() {
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

  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('round_robin')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // engine id -> chosen version id ('' / absent means the engine's latest).
  const [versionSel, setVersionSel] = useState<Map<string, string>>(new Map())
  const [headId, setHeadId] = useState('')
  const [gamesPerPairing, setGamesPerPairing] = useState(2)
  const [runnerSel, setRunnerSel] = useState('')
  const [tcSel, setTcSel] = useState(DEFAULT_TC)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onlineRunners = runners.filter((r) => r.online)
  const runnerId =
    runnerSel || onlineRunners[0]?.runner_id || runners[0]?.runner_id || ''
  const selectedRunner = runners.find((r) => r.runner_id === runnerId)

  const selectedEngines = useMemo(
    () => engines.filter((e) => selected.has(e.id)),
    [engines, selected],
  )
  // The gauntlet head must be one of the chosen engines; default to the first.
  const effectiveHead =
    format === 'gauntlet'
      ? selected.has(headId)
        ? headId
        : (selectedEngines[0]?.id ?? '')
      : ''

  const games = pairingCount(format, selected.size) * gamesPerPairing

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setVersion = (engineId: string, versionId: string) => {
    setVersionSel((prev) => {
      const next = new Map(prev)
      next.set(engineId, versionId)
      return next
    })
  }

  const valid =
    name.trim() !== '' &&
    selected.size >= 2 &&
    gamesPerPairing >= 1 &&
    selectedRunner?.online === true &&
    (format !== 'gauntlet' || effectiveHead !== '')

  const submit = async () => {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      const detail = await createTournament({
        name: name.trim(),
        format,
        entries: [...selected].map((engine_id) => ({
          engine_id,
          version_id: versionSel.get(engine_id) || null,
        })),
        gauntlet_head_id: format === 'gauntlet' ? effectiveHead : null,
        games_per_pairing: gamesPerPairing,
        runner_id: runnerId,
        tc: tcSel,
      })
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      navigate(tournamentUrl(detail.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-neutral-100">new tournament</h1>

      <Section title="setup">
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-neutral-400 w-24 shrink-0">name</span>
            <input
              className={`${fieldClass} flex-1 min-w-0`}
              value={name}
              placeholder="my tournament"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            <span className="text-neutral-400 w-24 shrink-0">format</span>
            <div className="flex gap-2">
              {(['round_robin', 'gauntlet'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded border px-3 py-1 transition-colors ${
                    format === f
                      ? 'border-neutral-500 text-neutral-100 bg-neutral-800'
                      : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  {f === 'round_robin' ? 'round robin' : 'gauntlet'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-400 w-24 shrink-0">games/pairing</span>
            <input
              type="number"
              min={1}
              max={20}
              className={`${fieldClass} w-20`}
              value={gamesPerPairing}
              onChange={(e) =>
                setGamesPerPairing(
                  Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                )
              }
            />
            <span className="text-neutral-600 text-xs">colors alternate</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-400 w-24 shrink-0">runner</span>
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
                  <option key={r.runner_id} value={r.runner_id} disabled={!r.online}>
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
          </div>
        </div>
      </Section>

      <Section
        title={
          <>
            engines
            <span className="ml-2 text-neutral-400 normal-case">
              ({selected.size} selected)
            </span>
          </>
        }
      >
        {engines.length === 0 ? (
          <Hint>no engines to enter — upload one first</Hint>
        ) : (
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
            {engines.map((e) => (
              <EngineEntryRow
                key={e.id}
                engine={e}
                checked={selected.has(e.id)}
                gauntlet={format === 'gauntlet'}
                isHead={effectiveHead === e.id}
                versionId={versionSel.get(e.id) ?? ''}
                onToggle={() => toggle(e.id)}
                onVersion={(v) => setVersion(e.id, v)}
                onMakeHead={() => setHeadId(e.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <div className="flex items-center gap-3">
        {user ? (
          <PrimaryButton onClick={() => void submit()} disabled={!valid || submitting}>
            {submitting ? 'starting…' : 'create & start'}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={login}>sign in to create</PrimaryButton>
        )}
        {selected.size >= 2 && (
          <span className="text-xs text-neutral-500">
            {games} game{games === 1 ? '' : 's'} on {selectedRunner?.name ?? '—'}
          </span>
        )}
      </div>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
