import { useState } from 'react'
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

// One participant slot: an engine + version. `key` is a stable local id so rows
// keep their identity (and the gauntlet head reference) across edits/removals.
// `versionId` is '' for "latest".
type Entry = { key: string; engineId: string; versionId: string }

const mkEntry = (engineId: string): Entry => ({
  key: crypto.randomUUID(),
  engineId,
  versionId: '',
})

// C(n,2) for round robin, (n-1) for gauntlet — the number of distinct pairings.
function pairingCount(format: TournamentFormat, n: number): number {
  if (n < 2) return 0
  return format === 'gauntlet' ? n - 1 : (n * (n - 1)) / 2
}

// One participant row: engine + version pickers, a gauntlet-head control and a
// remove button. The same engine can appear on several rows at different
// versions.
function EntryRow({
  entry,
  engines,
  gauntlet,
  isHead,
  onEngine,
  onVersion,
  onMakeHead,
  onRemove,
}: {
  entry: Entry
  engines: Engine[]
  gauntlet: boolean
  isHead: boolean
  onEngine: (engineId: string) => void
  onVersion: (versionId: string) => void
  onMakeHead: () => void
  onRemove: () => void
}) {
  const engine = engines.find((e) => e.id === entry.engineId)
  const versions = useEngineVersions(engine)
  return (
    <div className="flex items-center gap-2 rounded border border-neutral-800 px-3 py-2">
      <select
        className={`${selectClass} text-sm flex-1 min-w-0`}
        value={entry.engineId}
        onChange={(e) => onEngine(e.target.value)}
      >
        {engines.map((e) => (
          <option key={e.id} value={e.id}>
            {e.owner_login}/{e.name}
          </option>
        ))}
      </select>
      <select
        className={`${selectClass} text-xs w-24 shrink-0`}
        value={entry.versionId}
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
      {gauntlet &&
        (isHead ? (
          <span className="text-xs text-green-400 shrink-0 w-16 text-center">
            head
          </span>
        ) : (
          <button
            type="button"
            onClick={onMakeHead}
            className="text-xs text-neutral-500 hover:text-neutral-200 shrink-0 w-16 text-center"
          >
            make head
          </button>
        ))}
      <button
        type="button"
        onClick={onRemove}
        className="text-neutral-600 hover:text-red-400 shrink-0"
        title="remove"
      >
        ✕
      </button>
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
  const [entries, setEntries] = useState<Entry[]>([])
  const [seeded, setSeeded] = useState(false)
  const [headKey, setHeadKey] = useState('')
  const [gamesPerPairing, setGamesPerPairing] = useState(2)
  const [runnerSel, setRunnerSel] = useState('')
  const [tcSel, setTcSel] = useState(DEFAULT_TC)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed two rows the first time the engine list arrives, so the form is usable
  // at once. Done during render (not in an effect) to avoid an extra commit.
  if (!seeded && engines.length > 0) {
    setSeeded(true)
    setEntries([
      mkEntry(engines[0].id),
      mkEntry(engines[Math.min(1, engines.length - 1)].id),
    ])
  }

  const onlineRunners = runners.filter((r) => r.online)
  const runnerId =
    runnerSel || onlineRunners[0]?.runner_id || runners[0]?.runner_id || ''
  const selectedRunner = runners.find((r) => r.runner_id === runnerId)

  // The gauntlet head is one of the rows; default to the first.
  const effectiveHeadKey =
    format === 'gauntlet'
      ? entries.some((e) => e.key === headKey)
        ? headKey
        : (entries[0]?.key ?? '')
      : ''

  // Two rows with the identical engine+version are a duplicate. (An explicit
  // version equal to "latest" is only caught server-side.)
  const dup =
    new Set(entries.map((e) => `${e.engineId}|${e.versionId}`)).size !==
    entries.length

  const games = pairingCount(format, entries.length) * gamesPerPairing

  const updateEntry = (key: string, patch: Partial<Entry>) =>
    setEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    )

  const valid =
    name.trim() !== '' &&
    entries.length >= 2 &&
    !dup &&
    gamesPerPairing >= 1 &&
    selectedRunner?.online === true &&
    (format !== 'gauntlet' || effectiveHeadKey !== '')

  const submit = async () => {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      const detail = await createTournament({
        name: name.trim(),
        format,
        entries: entries.map((e) => ({
          engine_id: e.engineId,
          version_id: e.versionId || null,
        })),
        gauntlet_head_index:
          format === 'gauntlet'
            ? entries.findIndex((e) => e.key === effectiveHeadKey)
            : null,
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
            participants
            <span className="ml-2 text-neutral-400 normal-case">
              ({entries.length})
            </span>
          </>
        }
      >
        {engines.length === 0 ? (
          <Hint>no engines to enter — upload one first</Hint>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <EntryRow
                  key={entry.key}
                  entry={entry}
                  engines={engines}
                  gauntlet={format === 'gauntlet'}
                  isHead={effectiveHeadKey === entry.key}
                  onEngine={(engineId) =>
                    updateEntry(entry.key, { engineId, versionId: '' })
                  }
                  onVersion={(versionId) => updateEntry(entry.key, { versionId })}
                  onMakeHead={() => setHeadKey(entry.key)}
                  onRemove={() =>
                    setEntries((prev) => prev.filter((e) => e.key !== entry.key))
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEntries((prev) => [...prev, mkEntry(engines[0].id)])}
              className="self-start text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              + add participant
            </button>
            {dup && (
              <span className="text-amber-500/80 text-xs">
                the same engine + version is entered more than once
              </span>
            )}
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
        {entries.length >= 2 && !dup && (
          <span className="text-xs text-neutral-500">
            {games} game{games === 1 ? '' : 's'} on {selectedRunner?.name ?? '—'}
          </span>
        )}
      </div>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
