import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth-context'
import {
  createTournament,
  fetchBooks,
  fetchEngines,
  fetchRunners,
  tournamentUrl,
  type Engine,
  type TournamentFormat,
} from '../api'
import { useEngineVersions } from '../useEngineVersions'
import {
  DEFAULT_TC,
  TC_PRESETS,
  estimateTournamentSeconds,
  ratingCategory,
} from '../tc'
import { formatCount, formatDuration } from '../format'
import { button, field, link, panel } from '../styles'
import {
  ErrorText,
  Hint,
  Page,
  PageHeader,
  Segmented,
  Select,
  StatusDot,
  Switch,
} from '../ui'

// Mirrors MAX_GAMES_PER_TOURNAMENT in backend/app/tournaments.py.
const MAX_GAMES = 2000

// Mirrors books.NO_BOOK in backend/app/books.py.
const NO_BOOK = 'none'

// `key` keeps a row's identity (and the gauntlet head) across removals;
// `versionId` '' means latest.
type Entry = { key: string; engineId: string; versionId: string }

const mkEntry = (engineId: string): Entry => ({
  key: crypto.randomUUID(),
  engineId,
  versionId: '',
})

function pairingCount(format: TournamentFormat, n: number): number {
  if (n < 2) return 0
  return format === 'gauntlet' ? n - 1 : (n * (n - 1)) / 2
}


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
    <div className="flex items-center gap-2">
      <Select
        aria-label="Engine"
        className="flex-1"
        value={entry.engineId}
        onChange={(e) => onEngine(e.target.value)}
      >
        {engines.map((e) => (
          <option key={e.id} value={e.id}>
            {e.owner_login}/{e.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Version"
        title="Version to enter"
        className="w-[120px] shrink-0"
        value={entry.versionId}
        onChange={(e) => onVersion(e.target.value)}
      >
        <option value="">latest</option>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.version}
          </option>
        ))}
      </Select>
      {gauntlet &&
        (isHead ? (
          <span className="w-20 shrink-0 text-center text-xs text-fg">Head</span>
        ) : (
          <button
            type="button"
            onClick={onMakeHead}
            className={`${link} w-20 shrink-0 text-center text-xs`}
          >
            Make head
          </button>
        ))}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove participant"
        title="Remove"
        className="w-5 shrink-0 text-center text-faint transition-colors hover:text-loss"
      >
        ✕
      </button>
    </div>
  )
}

function SetupRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <span className="text-sm text-muted sm:pt-[7px]">{label}</span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-h-[34px] items-center gap-2">{children}</div>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
    </div>
  )
}

export default function TournamentNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, login } = useAuth()

  const { data: allEngines = [] } = useQuery({
    queryKey: ['engines'],
    queryFn: fetchEngines,
  })
  const { data: runners = [] } = useQuery({
    queryKey: ['runners'],
    queryFn: fetchRunners,
    staleTime: 5_000,
  })
  const { data: books = [] } = useQuery({
    queryKey: ['books'],
    queryFn: fetchBooks,
    staleTime: Infinity,
  })
  const engines = allEngines.filter((e) => (e.version_count ?? 0) > 0)

  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('round_robin')
  const [entries, setEntries] = useState<Entry[]>([])
  const [seeded, setSeeded] = useState(false)
  const [headKey, setHeadKey] = useState('')
  const [gamesPerPairing, setGamesPerPairing] = useState(2)
  const [runnerSel, setRunnerSel] = useState('')
  const [tcSel, setTcSel] = useState(DEFAULT_TC)
  const [rated, setRated] = useState(true)
  // '' until the catalog loads, then the first book.
  const [bookSel, setBookSel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seeded during render, not in an effect, to avoid an extra commit.
  if (!seeded && engines.length > 0) {
    setSeeded(true)
    setEntries([
      mkEntry(engines[0].id),
      mkEntry(engines[Math.min(1, engines.length - 1)].id),
    ])
  }

  const book = bookSel || books[0]?.slug || NO_BOOK
  const selectedBook = books.find((b) => b.slug === book)

  const onlineRunners = runners.filter((r) => r.online)
  const runnerId =
    runnerSel || onlineRunners[0]?.runner_id || runners[0]?.runner_id || ''
  const selectedRunner = runners.find((r) => r.runner_id === runnerId)

  const effectiveHeadKey =
    format === 'gauntlet'
      ? entries.some((e) => e.key === headKey)
        ? headKey
        : (entries[0]?.key ?? '')
      : ''

  // An explicit version equal to "latest" is only caught server-side.
  const dup =
    new Set(entries.map((e) => `${e.engineId}|${e.versionId}`)).size !==
    entries.length

  const pairings = pairingCount(format, entries.length)
  const games = pairings * gamesPerPairing
  const maxPerPairing = pairings > 0 ? Math.floor(MAX_GAMES / pairings) : MAX_GAMES
  const tooManyGames = games > MAX_GAMES
  const eta = estimateTournamentSeconds(
    games,
    tcSel,
    selectedRunner?.max_games ?? 0,
  )

  const updateEntry = (key: string, patch: Partial<Entry>) =>
    setEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    )

  const valid =
    name.trim() !== '' &&
    entries.length >= 2 &&
    !dup &&
    gamesPerPairing >= 1 &&
    !tooManyGames &&
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
        rated,
        book,
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
    <Page className="!max-w-[720px] !gap-6">
      <PageHeader
        title="New tournament"
        subtitle="Pick engines, a time control and a runner. Games start right away."
      />

      <div className={`${panel} flex flex-col gap-[18px] p-6`}>
        <span className="text-meta text-faint">Setup</span>
        <SetupRow label="Name">
          <input
            className={`${field} min-w-0 flex-1`}
            value={name}
            placeholder="My tournament"
            onChange={(e) => setName(e.target.value)}
          />
        </SetupRow>
        <SetupRow
          label="Format"
          hint={
            format === 'gauntlet'
              ? 'Gauntlet plays one head engine against the rest.'
              : 'Everyone plays everyone.'
          }
        >
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'round_robin', label: 'Round robin' },
              { value: 'gauntlet', label: 'Gauntlet' },
            ]}
          />
        </SetupRow>
        <SetupRow
          label="Games per pairing"
          hint={`Colours alternate · up to ${formatCount(maxPerPairing)} for ${pairings} ${pairings === 1 ? 'pairing' : 'pairings'}`}
        >
          <input
            type="number"
            min={1}
            max={maxPerPairing}
            className={`${field} w-20`}
            value={gamesPerPairing}
            onChange={(e) =>
              setGamesPerPairing(Math.max(1, Number(e.target.value) || 1))
            }
          />
        </SetupRow>
        <SetupRow label="Runner">
          <Select
            aria-label="Runner"
            className="flex-1"
            value={runnerId}
            onChange={(e) => setRunnerSel(e.target.value)}
            disabled={runners.length === 0}
            leading={selectedRunner && <StatusDot online={selectedRunner.online} size={7} />}
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
            className="w-[120px] shrink-0"
            value={tcSel}
            onChange={(e) => setTcSel(e.target.value)}
          >
            {TC_PRESETS.map((tc) => (
              <option key={tc.value} value={tc.value}>
                {tc.label}
              </option>
            ))}
          </Select>
        </SetupRow>
        <SetupRow label="Rated">
          <Switch checked={rated} onChange={setRated} label="Rated" />
          <span className="text-meta text-muted">
            {rated
              ? `Finished games count toward ${ratingCategory(tcSel)} ratings`
              : 'No game changes any rating'}
          </span>
        </SetupRow>
        <SetupRow
          label="Openings"
          hint={
            selectedBook
              ? `${formatCount(selectedBook.lines)} lines, ${selectedBook.plies} plies deep. ` +
                'Each is played twice, once from each side.'
              : 'Without a book, two engines that always pick the same move ' +
                'replay one game per colour — the tournament tells you nothing.'
          }
        >
          <Select
            aria-label="Opening book"
            title="Opening book each pairing is dealt from"
            className="flex-1"
            value={book}
            onChange={(e) => setBookSel(e.target.value)}
          >
            {books.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
            <option value={NO_BOOK}>None — always from the start</option>
          </Select>
        </SetupRow>
      </div>

      <div className={`${panel} flex flex-col gap-3 p-6`}>
        <span className="text-meta text-faint">Participants · {entries.length}</span>
        {engines.length === 0 ? (
          <Hint>No engines to enter — upload one first</Hint>
        ) : (
          <>
            <div className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto">
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
              className={`${link} self-start text-sm`}
            >
              + Add participant
            </button>
            {dup && (
              <ErrorText>The same engine and version is entered more than once</ErrorText>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {user ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || submitting}
            className={button.primary}
          >
            {submitting ? 'Starting…' : 'Create & start'}
          </button>
        ) : (
          <button type="button" onClick={login} className={button.primary}>
            Sign in to create
          </button>
        )}
        {entries.length >= 2 && !dup && (
          <span className="text-meta text-muted">
            {formatCount(games)} {games === 1 ? 'game' : 'games'} on{' '}
            {selectedRunner?.name ?? '—'}
            {selectedRunner && (
              <span className="text-faint"> ({selectedRunner.max_games} at a time)</span>
            )}
            {eta !== null && <> · ~{formatDuration(eta)}</>}
          </span>
        )}
      </div>
      {tooManyGames && (
        <ErrorText>
          {formatCount(games)} games is over the {formatCount(MAX_GAMES)} limit — at
          most {maxPerPairing} per pairing with {pairings}{' '}
          {pairings === 1 ? 'pairing' : 'pairings'}
        </ErrorText>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Page>
  )
}
