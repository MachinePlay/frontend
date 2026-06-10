import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  createCliToken,
  fetchTokens,
  fetchUserProfile,
  revokeToken,
  type ApiToken,
  type UserProfile as Profile,
} from '../api'
import { useAuth } from '../auth-context'

function engineLabel(login: string, name: string): string {
  return `${login}/${name}`
}

function TokenSection() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    fetchTokens()
      .then(setTokens)
      .catch(() => setError('failed to load tokens'))
  }

  useEffect(reload, [])

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      setFresh(await createCliToken())
      reload()
    } catch {
      setError('could not create a token')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setError(null)
    try {
      await revokeToken(id)
      setTokens((t) => t?.filter((tok) => tok.id !== id) ?? null)
    } catch {
      setError('could not revoke the token')
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-100">API tokens</h2>
        <button
          onClick={() => void generate()}
          disabled={busy}
          className="ml-auto bg-neutral-100 text-neutral-900 rounded px-3 py-1 text-sm disabled:opacity-40"
        >
          {busy ? 'generating…' : 'generate token'}
        </button>
      </div>
      <p className="text-neutral-500 text-xs">
        Used by <span className="font-mono">machineplay login</span> to upload
        engines from your terminal.
      </p>

      {fresh && (
        <div className="flex flex-col gap-1 border border-neutral-800 rounded p-3">
          <code className="text-sm font-mono text-neutral-200 break-all">
            {fresh}
          </code>
          <p className="text-amber-500/80 text-xs">
            Copy it now — for security it won't be shown again.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {tokens === null ? (
        <p className="text-neutral-500 text-sm italic">loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-neutral-500 text-sm italic">no tokens yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 border border-neutral-800 rounded px-3 py-2 text-sm"
            >
              <code className="font-mono text-neutral-200">{t.prefix}…</code>
              <span className="text-xs text-neutral-500">
                created {new Date(t.created_at).toLocaleDateString()}
                {t.last_used_at &&
                  ` · last used ${new Date(t.last_used_at).toLocaleDateString()}`}
              </span>
              <button
                onClick={() => void revoke(t.id)}
                className="ml-auto text-xs text-neutral-500 hover:text-red-400 transition-colors"
              >
                revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function UserProfile() {
  const { login = '' } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchUserProfile(login)
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch(() => {
        if (!cancelled) setError('user not found')
      })
    return () => {
      cancelled = true
    }
  }, [login])

  if (error) {
    return <p className="max-w-3xl mx-auto px-4 py-8 text-red-400">{error}</p>
  }
  if (profile === null) {
    return (
      <p className="max-w-3xl mx-auto px-4 py-8 text-neutral-500 italic">
        loading…
      </p>
    )
  }

  const isOwn =
    user !== null && user.login.toLowerCase() === profile.login.toLowerCase()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="flex items-center gap-4">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.login}
            className="h-16 w-16 rounded-full border border-neutral-700"
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">
            {profile.login}
          </h1>
          {profile.name && (
            <p className="text-neutral-400 text-sm">{profile.name}</p>
          )}
          <p className="text-neutral-600 text-xs">
            joined {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">engines</h2>
        {profile.engines.length === 0 ? (
          <p className="text-neutral-500 text-sm italic">no engines yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.engines.map((e) => (
              <Link
                key={e.id}
                to={`/engine/${e.id}`}
                className="block border border-neutral-800 hover:border-neutral-600 rounded px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-neutral-100">
                    {engineLabel(profile.login, e.name)}
                  </span>
                  <span className="ml-auto text-xs text-neutral-500">
                    {e.version_count}{' '}
                    {e.version_count === 1 ? 'version' : 'versions'}
                  </span>
                </div>
                {e.description && (
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {e.description}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">recent games</h2>
        {profile.games.length === 0 ? (
          <p className="text-neutral-500 text-sm italic">no games yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.games.map((g) => (
              <Link
                key={g.id}
                to={`/game/${g.id}`}
                className="block border border-neutral-800 hover:border-neutral-600 rounded px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{g.white_name}</span>
                  <span className="text-neutral-500">vs</span>
                  <span className="font-medium">{g.black_name}</span>
                  <span className="ml-auto font-mono text-xs text-neutral-400">
                    {g.result ?? '*'}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {new Date(g.created_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isOwn && <TokenSection />}
    </div>
  )
}
