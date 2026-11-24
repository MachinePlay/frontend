import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import {
  deleteEngine,
  deleteEngineVersion,
  engineUrl,
  fetchEngineByName,
  fetchEngines,
  gameUrl,
  isNotFound,
  profileUrl,
  updateEngine,
  updateEngineVersion,
  type EngineDetail as EngineDetailData,
  type EngineUpdateRequest,
  type EngineVersion,
  type Game,
  type RatingCategory,
} from '../api'
import { useAuth } from '../auth-context'
import {
  RATING_CATEGORIES,
  capitalize,
  formatBytes,
  formatDate,
  formatDelta,
  formatPercent,
  formatRating,
  relativeTime,
} from '../format'
import { finishedMeta, leaderboard, outcomeFor } from '../games'
import { NewGameDialog } from '../NewGameDialog'
import { button, deltaTone, row, tableHead } from '../styles'
import {
  ColorChip,
  ConfirmButton,
  DangerZone,
  Hint,
  InlineEdit,
  Loading,
  LoadError,
  Page,
  RatingChips,
  ResultBadge,
  SectionHeader,
  TagPills,
} from '../ui'
import NotFound from './NotFound'

const RECENT_GAMES = 10

// Comma- or space-separated; the backend normalizes them.
const parseTags = (raw: string): string[] =>
  raw.split(/[,\s]+/).filter(Boolean)

const versionGrid = (editing: boolean) =>
  `grid gap-3 ${
    editing
      ? 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[150px_minmax(0,1fr)_70px_auto]'
      : 'grid-cols-[100px_minmax(0,1fr)_80px] sm:grid-cols-[100px_minmax(0,1fr)_70px_80px]'
  }`

function VersionRow({
  version,
  editing,
  onRename,
  onDelete,
}: {
  version: EngineVersion
  editing: boolean
  onRename: (label: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  return (
    <div className={`${versionGrid(editing)} ${row} items-center py-[11px] text-sm`}>
      <span className="num truncate">
        <InlineEdit
          editable={editing}
          value={version.version}
          label="Rename version"
          inputClass="w-36 font-mono"
          onSave={onRename}
        >
          <span>{version.version}</span>
        </InlineEdit>
      </span>
      <span className={editing ? 'hidden sm:block' : ''}>
        <RatingChips ratings={version.ratings} />
      </span>
      <span
        className="hidden text-right text-meta text-muted sm:block"
      >
        {formatBytes(version.size_bytes)}
      </span>
      {editing ? (
        <span className="text-right">
          <ConfirmButton
            label="Delete"
            confirmLabel="Really delete?"
            busyLabel="Deleting…"
            onConfirm={onDelete}
          />
        </span>
      ) : (
        <span className="text-right text-meta text-muted">
          {formatDate(version.created_at)}
        </span>
      )}
    </div>
  )
}

function StatsStrip({
  engine,
  ranks,
}: {
  engine: EngineDetailData
  ranks: { [key in RatingCategory]?: { rank: number; of: number } }
}) {
  const ratings = engine.ratings ?? {}
  const categories = [...RATING_CATEGORIES].sort(
    (a, b) => (ratings[b]?.games ?? -1) - (ratings[a]?.games ?? -1),
  )
  const played = engine.games_played ?? 0
  const cells = [
    ...categories.map((c) => {
      const r = ratings[c]
      const rank = ranks[c]
      return {
        label: capitalize(c),
        value: r ? formatRating(r) : '—',
        sub: r
          ? `±${Math.round(r.phi)}${rank ? ` · #${rank.rank} of ${rank.of}` : ''}`
          : 'Unrated',
      }
    }),
    {
      label: 'Games',
      value: String(played),
      sub: engine.last_game_at
        ? `Last one ${relativeTime(engine.last_game_at)}`
        : 'None yet',
    },
    {
      label: 'Score',
      value: formatPercent((engine.wins ?? 0) + 0.5 * (engine.draws ?? 0), played),
      sub: `${engine.wins ?? 0} W · ${engine.draws ?? 0} D · ${engine.losses ?? 0} L`,
    },
  ]
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c) => (
        <div
          key={c.label}
          className="-mb-px -mr-px flex flex-col gap-1 border-b border-r border-line px-5 py-4"
        >
          <span className="text-xs text-faint">{c.label}</span>
          <span className="num text-[23px] font-medium leading-[30px]">{c.value}</span>
          <span className="truncate text-xs text-muted">{c.sub}</span>
        </div>
      ))}
    </div>
  )
}

function EngineGameRow({ game, engineId }: { game: Game; engineId: string }) {
  const outcome = outcomeFor(game, engineId)
  const asWhite = game.white_id === engineId
  const opponent = asWhite ? game.black_name : game.white_name
  const change = asWhite ? game.white_rating : game.black_rating
  const delta = change ? change.after - change.before : null
  return (
    <Link
      to={gameUrl(game.id)}
      className={`${row} flex items-center gap-2.5 py-2.5 text-sm transition-colors hover:bg-surface`}
    >
      {outcome ? (
        <ResultBadge outcome={outcome} />
      ) : (
        <span className="num flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-line text-xs text-faint">
          –
        </span>
      )}
      <ColorChip color={asWhite ? 'white' : 'black'} />
      <span className="min-w-0 truncate">vs {opponent}</span>
      <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-xs text-faint">
        {game.status === 'playing'
          ? 'In progress · now'
          : game.status === 'aborted'
            ? `Aborted · ${finishedMeta(game)}`
            : finishedMeta(game)}
      </span>
      <span
        className={`num w-[52px] shrink-0 text-right text-xs ${delta === null ? '' : deltaTone(delta)}`}
      >
        {delta === null ? '' : formatDelta(delta)}
      </span>
    </Link>
  )
}

export default function EngineDetail() {
  const { login = '', engineName = '' } = useParams()
  const { user, login: signIn } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const {
    data: engine,
    error,
    refetch,
  } = useQuery({
    queryKey: ['engine', login, engineName],
    queryFn: () => fetchEngineByName(login, engineName),
  })
  const { data: engines = [] } = useQuery({
    queryKey: ['engines'],
    queryFn: fetchEngines,
  })

  // A rename moves the URL: seed the cache under the new key and replace the
  // history entry.
  const patch = async (body: EngineUpdateRequest) => {
    const updated = await updateEngine(login, engineName, body)
    queryClient.setQueryData(['engine', login, updated.name], updated)
    await queryClient.invalidateQueries({ queryKey: ['engines'] })
    if (updated.name !== engineName) {
      void navigate(engineUrl(updated), { replace: true })
    }
  }

  const renameVersion = async (versionId: string, version: string) => {
    const updated = await updateEngineVersion(login, engineName, versionId, {
      version,
    })
    queryClient.setQueryData(['engine', login, engineName], updated)
  }

  const removeEngine = async () => {
    await deleteEngine(login, engineName)
    await queryClient.invalidateQueries({ queryKey: ['engines'] })
    void navigate(profileUrl(login))
  }

  const removeVersion = async (versionId: string) => {
    await deleteEngineVersion(login, engineName, versionId)
    // Refetch first, so the row is gone when the button stops saying "Deleting…".
    await queryClient.invalidateQueries({
      queryKey: ['engine', login, engineName],
    })
    await queryClient.invalidateQueries({ queryKey: ['engines'] })
  }

  if (error) {
    return isNotFound(error) ? (
      <NotFound />
    ) : (
      <LoadError what="this engine" error={error} onRetry={() => void refetch()} />
    )
  }
  if (!engine) return <Loading />

  const canEdit = user?.login === engine.owner_login || (user?.is_admin ?? false)
  const ranks = Object.fromEntries(
    RATING_CATEGORIES.map((c) => {
      const board = leaderboard(engines, c)
      const i = board.findIndex((e) => e.id === engine.id)
      return [c, i < 0 ? undefined : { rank: i + 1, of: board.length }]
    }),
  )
  const versionCount = engine.versions.length

  return (
    <Page>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="min-w-0 text-title font-semibold">
            <Link
              to={profileUrl(engine.owner_login)}
              className="font-normal text-muted transition-colors hover:text-fg"
            >
              {engine.owner_login}
            </Link>
            <span className="font-normal text-faint"> / </span>
            <InlineEdit
              editable={editing}
              value={engine.name}
              label="Rename engine"
              inputClass="w-56"
              onSave={(name) => patch({ name })}
            >
              <span>{engine.name}</span>
            </InlineEdit>
          </h1>
          <div className="ml-auto flex gap-2.5">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                className={button.secondary}
              >
                {editing ? 'Done' : 'Edit'}
              </button>
            )}
            <button
              type="button"
              disabled={versionCount === 0}
              onClick={() => (user ? setPlaying(true) : signIn())}
              className={button.primary}
            >
              Play a game
            </button>
          </div>
        </div>
        {(engine.description || editing) && (
          <div className="max-w-[640px] text-md text-muted">
            <InlineEdit
              editable={editing}
              value={engine.description}
              label="Edit description"
              multiline
              placeholder="What does this engine do?"
              hint="⌘/Ctrl+Enter to save"
              onSave={(description) => patch({ description })}
            >
              <span className={engine.description ? '' : 'text-faint'}>
                {engine.description || 'Add a description'}
              </span>
            </InlineEdit>
          </div>
        )}
        {(engine.tags.length > 0 || editing) && (
          <InlineEdit
            editable={editing}
            value={engine.tags.join(', ')}
            label="Edit tags"
            inputClass="w-80"
            placeholder="python, mcts, rust"
            hint="Comma-separated"
            onSave={(raw) => patch({ tags: parseTags(raw) })}
          >
            {engine.tags.length > 0 ? (
              <TagPills tags={engine.tags} />
            ) : (
              <span className="text-sm text-faint">Add tags</span>
            )}
          </InlineEdit>
        )}
      </div>

      <StatsStrip engine={engine} ranks={ranks} />

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <SectionHeader title="Versions">
            <span>{versionCount}</span>
          </SectionHeader>
          {versionCount === 0 ? (
            <p className="text-sm text-loss">
              No versions — this engine can't play until one is pushed with{' '}
              <code className="font-mono">machineplay upload</code>.
            </p>
          ) : (
            <div className="flex flex-col">
              <div className={`${versionGrid(editing)} ${tableHead}`}>
                <span>Version</span>
                <span className={editing ? 'hidden sm:block' : ''}>Ratings</span>
                <span className="hidden text-right sm:block">Size</span>
                <span className="text-right">{editing ? '' : 'Uploaded'}</span>
              </div>
              {engine.versions.map((v) => (
                <VersionRow
                  key={v.id}
                  version={v}
                  editing={editing}
                  onRename={(label) => renameVersion(v.id, label)}
                  onDelete={() => removeVersion(v.id)}
                />
              ))}
            </div>
          )}
          <span className="text-meta text-faint">
            Upload a new version with{' '}
            <span className="font-mono text-muted">machineplay upload</span>
          </span>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <SectionHeader title="Recent games" />
          {engine.games.length === 0 ? (
            <Hint>No games yet</Hint>
          ) : (
            <div className="flex flex-col">
              {engine.games.slice(0, RECENT_GAMES).map((g) => (
                <EngineGameRow key={g.id} game={g} engineId={engine.id} />
              ))}
            </div>
          )}
        </section>
      </div>

      {canEdit && (
        <DangerZone
          title="Delete engine"
          summary="Removes all versions and images. Played games stay in history."
          phrase={engine.name}
          label="Delete engine"
          busyLabel="Deleting…"
          onConfirm={removeEngine}
        >
          <p className="text-sm">
            Deletes{' '}
            <span className="font-mono">
              {engine.owner_login}/{engine.name}
            </span>
            , its {versionCount} uploaded {versionCount === 1 ? 'version' : 'versions'}{' '}
            and their registry images. This can't be undone — re-uploading builds
            a new engine, not this one.
          </p>
          <p className="text-xs text-faint">
            Games it already played stay in the public history: they record the
            engine and version names they were played under. Deletion is refused
            while any of its games is pending or playing.
          </p>
        </DangerZone>
      )}

      <NewGameDialog
        open={playing}
        onClose={() => setPlaying(false)}
        whiteEngineId={engine.id}
      />
    </Page>
  )
}
