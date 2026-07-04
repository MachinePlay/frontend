import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { deleteEngine, fetchEngineByName, profileUrl } from '../api'
import { useAuth } from '../auth-context'
import { GameList, Hint, Section } from '../components'
import { formatBytes } from '../format'
import NotFound from './NotFound'

// Owner/admin-only delete with the same arm-then-confirm step as game cancel;
// lands on the owner's profile once the engine is gone.
function DeleteEngineButton({ login, name }: { login: string; name: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Disarm the confirm step after a moment so a stray click can't linger.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const doDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteEngine(login, name)
      await queryClient.invalidateQueries({ queryKey: ['engines'] })
      navigate(profileUrl(login))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <div className="flex items-center gap-3 ml-auto">
      {error && <span className="text-red-400 text-xs">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => (armed ? void doDelete() : setArmed(true))}
        className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
          armed
            ? 'border-red-700 text-red-400 hover:bg-red-950'
            : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
        }`}
      >
        {busy ? 'deleting…' : armed ? 'really delete?' : 'delete engine'}
      </button>
    </div>
  )
}

// Mounted at /{login}/{engineName}, GitHub-style.
export default function EngineDetail() {
  const { login = '', engineName = '' } = useParams()
  const { user } = useAuth()
  const { data: engine, error } = useQuery({
    queryKey: ['engine', login, engineName],
    queryFn: () => fetchEngineByName(login, engineName),
  })

  if (error) {
    return <NotFound />
  }
  if (!engine) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Hint>loading…</Hint>
      </div>
    )
  }

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
            {engine.name}
          </h1>
          {(user?.login === engine.owner_login || user?.is_admin) && (
            <DeleteEngineButton login={engine.owner_login} name={engine.name} />
          )}
        </div>
        {engine.description && (
          <p className="text-neutral-400 text-sm">{engine.description}</p>
        )}
      </div>

      <Section title="versions">
        {engine.versions.length === 0 ? (
          <Hint>no versions uploaded</Hint>
        ) : (
          <div className="flex flex-col gap-1">
            {engine.versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 border border-neutral-800 rounded px-3 py-2 text-sm"
              >
                <span className="font-mono text-neutral-100">{v.version}</span>
                <span className="ml-auto text-xs text-neutral-500">
                  {formatBytes(v.size_bytes)}
                </span>
                <span className="text-xs text-neutral-500">
                  {new Date(v.created_at).toLocaleDateString()}
                </span>
              </div>
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
