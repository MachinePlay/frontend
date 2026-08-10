import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCliToken,
  deleteAccount,
  DELETED_LOGIN,
  fetchTokens,
  fetchUserProfile,
  isNotFound,
  revokeToken,
  type ApiToken,
} from '../api'
import { useAuth } from '../auth-context'
import {
  EngineList,
  FreshToken,
  GameList,
  Hint,
  LoadError,
  PrimaryButton,
  Section,
} from '../components'
import NotFound from './NotFound'

function TokenSection() {
  const queryClient = useQueryClient()
  const { data: tokens, error: loadError } = useQuery({
    queryKey: ['tokens'],
    queryFn: fetchTokens,
  })
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const error = actionError ?? (loadError ? 'failed to load tokens' : null)

  const generate = async () => {
    setBusy(true)
    setActionError(null)
    try {
      setFresh(await createCliToken())
      await queryClient.invalidateQueries({ queryKey: ['tokens'] })
    } catch (e) {
      setActionError(
        `could not create a token (${e instanceof Error ? e.message : e})`,
      )
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setActionError(null)
    try {
      await revokeToken(id)
      queryClient.setQueryData<ApiToken[]>(['tokens'], (t) =>
        t?.filter((tok) => tok.id !== id),
      )
    } catch (e) {
      setActionError(
        `could not revoke the token (${e instanceof Error ? e.message : e})`,
      )
    }
  }

  return (
    <Section
      title={
        <span className="flex items-center gap-3">
          API tokens
          <PrimaryButton
            onClick={() => void generate()}
            disabled={busy}
            className="ml-auto normal-case tracking-normal"
          >
            {busy ? 'generating…' : 'generate token'}
          </PrimaryButton>
        </span>
      }
    >
      <p className="text-neutral-500 text-xs">
        Used by <span className="font-mono">machineplay login</span> to upload
        engines from your terminal.
      </p>

      {fresh && <FreshToken token={fresh} />}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {tokens === undefined ? (
        <Hint>loading…</Hint>
      ) : tokens.length === 0 ? (
        <Hint>no tokens yet</Hint>
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
    </Section>
  )
}

/** Account deletion, gated on typing the handle out. Deliberately heavier than
    the two-click ConfirmButton used for engines: this one ends every game and
    tournament the account has running and can't be undone. */
function DangerZone({ login }: { login: string }) {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const armed = typed.trim().toLowerCase() === login.toLowerCase()

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount(typed.trim())
      // The backend cleared the session cookie; drop the client's copy of the
      // user too, so the header stops offering a profile that no longer exists.
      setUser(null)
      void navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Section title="delete account">
      <div className="flex flex-col gap-3 rounded border border-red-900/60 bg-red-950/20 p-3">
        <p className="text-neutral-300 text-sm">
          Deletes your engines, every version you uploaded, their registry
          images and your runners. Anything still running — games, tournaments —
          ends immediately. This can't be undone.
        </p>
        <p className="text-neutral-500 text-xs">
          Games and tournaments you already played stay in the public history,
          credited to <span className="font-mono">{DELETED_LOGIN}</span>. Signing
          in with GitHub again creates a brand-new account, and the handle{' '}
          <span className="font-mono">{login}</span> is free for anyone to take.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={login}
            aria-label={`type ${login} to confirm`}
            className="bg-neutral-900 border border-neutral-800 focus:border-neutral-600 rounded px-2 py-1 text-sm font-mono text-neutral-100 outline-none"
          />
          <button
            type="button"
            disabled={!armed || busy}
            onClick={() => void run()}
            className="rounded border border-red-800 px-3 py-1 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            {busy ? 'deleting…' : 'delete account'}
          </button>
          {!armed && (
            <span className="text-neutral-600 text-xs">
              type your handle to enable
            </span>
          )}
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </Section>
  )
}

export default function UserProfile() {
  const { login = '' } = useParams()
  const { user } = useAuth()
  const {
    data: profile,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile', login],
    queryFn: () => fetchUserProfile(login),
  })

  if (error) {
    return isNotFound(error) ? (
      <NotFound />
    ) : (
      <LoadError
        what="this profile"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }
  if (profile === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Hint>loading…</Hint>
      </div>
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

      <Section title="engines">
        <EngineList engines={profile.engines} />
      </Section>

      <Section title="recent games">
        <GameList games={profile.games} />
      </Section>

      {isOwn && <TokenSection />}
      {isOwn && <DangerZone login={profile.login} />}
    </div>
  )
}
