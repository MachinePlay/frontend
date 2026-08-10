import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import {
  deleteEngine,
  deleteEngineVersion,
  engineUrl,
  fetchEngineByName,
  isNotFound,
  profileUrl,
  updateEngine,
  updateEngineVersion,
  type EngineUpdateRequest,
  type EngineVersion,
} from '../api'
import { useAuth } from '../auth-context'
import {
  ConfirmButton,
  DangerZone,
  GameList,
  Hint,
  InlineEdit,
  LoadError,
  Section,
  TagPills,
} from '../components'
import { formatBytes } from '../format'
import NotFound from './NotFound'

// Tags are edited as one comma- (or space-) separated line; the backend
// lowercases, de-duplicates and validates what comes back.
const parseTags = (raw: string): string[] =>
  raw.split(/[,\s]+/).filter(Boolean)

// One uploaded version. The owner can rename its label — that moves nothing but
// the label, since the image is pinned by digest — or delete it, which the
// backend refuses while that exact version has a game pending or playing.
function VersionRow({
  version,
  editable,
  onRename,
  onDelete,
}: {
  version: EngineVersion
  editable: boolean
  onRename: (label: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-neutral-800 rounded px-3 py-2 text-sm">
      <span className="font-mono text-neutral-100">
        <InlineEdit
          editable={editable}
          value={version.version}
          label="edit version"
          inputClass="w-44 font-mono"
          onSave={onRename}
        >
          <span>{version.version}</span>
        </InlineEdit>
      </span>
      <span className="ml-auto text-xs text-neutral-500">
        {formatBytes(version.size_bytes)}
      </span>
      <span className="text-xs text-neutral-500">
        {new Date(version.created_at).toLocaleDateString()}
      </span>
      {editable && (
        <ConfirmButton
          label="delete"
          confirmLabel="really delete?"
          busyLabel="deleting…"
          onConfirm={onDelete}
        />
      )}
    </div>
  )
}

// Mounted at /{login}/{engineName}, GitHub-style.
export default function EngineDetail() {
  const { login = '', engineName = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    data: engine,
    error,
    refetch,
  } = useQuery({
    queryKey: ['engine', login, engineName],
    queryFn: () => fetchEngineByName(login, engineName),
  })

  // Owner/admin edits. A rename moves the engine's URL, so seed the cache under
  // the new key and replace the current history entry with it.
  const patch = async (body: EngineUpdateRequest) => {
    const updated = await updateEngine(login, engineName, body)
    queryClient.setQueryData(['engine', login, updated.name], updated)
    await queryClient.invalidateQueries({ queryKey: ['engines'] })
    if (updated.name !== engineName) {
      void navigate(engineUrl(updated), { replace: true })
    }
  }

  // Version edits stay on this page: only the label moves, so the engine's own
  // cache entry is replaced with the detail the backend returns.
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
    // Refetch before returning so the row is gone by the time the button
    // stops saying "deleting…"; version_count also shows in engine lists.
    await queryClient.invalidateQueries({
      queryKey: ['engine', login, engineName],
    })
    await queryClient.invalidateQueries({ queryKey: ['engines'] })
  }

  if (error) {
    return isNotFound(error) ? (
      <NotFound />
    ) : (
      <LoadError
        what="this engine"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }
  if (!engine) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Hint>loading…</Hint>
      </div>
    )
  }

  const canEdit = user?.login === engine.owner_login || (user?.is_admin ?? false)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-100">
            <Link
              to={profileUrl(engine.owner_login)}
              className="text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              {engine.owner_login}
            </Link>
            <span className="text-neutral-600"> / </span>
            <InlineEdit
              editable={canEdit}
              value={engine.name}
              label="edit name"
              inputClass="w-56"
              onSave={(name) => patch({ name })}
            >
              <span>{engine.name}</span>
            </InlineEdit>
          </h1>
        </div>
        {(engine.description || canEdit) && (
          <div className="text-neutral-400 text-sm">
            <InlineEdit
              editable={canEdit}
              value={engine.description}
              label="edit description"
              multiline
              placeholder="what does this engine do?"
              hint="⌘/ctrl+enter to save"
              onSave={(description) => patch({ description })}
            >
              <span
                className={engine.description ? '' : 'text-neutral-600 italic'}
              >
                {engine.description || 'add a description'}
              </span>
            </InlineEdit>
          </div>
        )}
        {(engine.tags.length > 0 || canEdit) && (
          <div className="mt-1.5">
            <InlineEdit
              editable={canEdit}
              value={engine.tags.join(', ')}
              label="edit tags"
              inputClass="w-80"
              placeholder="python, mcts, rust"
              hint="comma-separated"
              onSave={(raw) => patch({ tags: parseTags(raw) })}
            >
              {engine.tags.length > 0 ? (
                <TagPills tags={engine.tags} />
              ) : (
                <span className="text-neutral-600 italic text-sm">add tags</span>
              )}
            </InlineEdit>
          </div>
        )}
      </div>

      {canEdit && (
        <DangerZone
          phrase={engine.name}
          label="delete engine"
          busyLabel="deleting…"
          onConfirm={removeEngine}
        >
          <p className="text-neutral-300 text-sm">
            Deletes{' '}
            <span className="font-mono">
              {engine.owner_login}/{engine.name}
            </span>
            , its {engine.versions.length} uploaded{' '}
            {engine.versions.length === 1 ? 'version' : 'versions'} and their
            registry images. This can't be undone — re-uploading builds a new
            engine, not this one.
          </p>
          <p className="text-neutral-500 text-xs">
            Games it already played stay in the public history: they record the
            engine and version names they were played under. Deletion is refused
            while any of its games is pending or playing.
          </p>
        </DangerZone>
      )}

      <Section title="versions">
        {engine.versions.length === 0 ? (
          <p className="text-amber-500/80 text-sm">
            no versions — this engine can't play until one is pushed with{' '}
            <code className="font-mono">machineplay upload</code>.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {engine.versions.map((v) => (
              <VersionRow
                key={v.id}
                version={v}
                editable={canEdit}
                onRename={(label) => renameVersion(v.id, label)}
                onDelete={() => removeVersion(v.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="recent games">
        <GameList games={engine.games} />
      </Section>
    </div>
  )
}
