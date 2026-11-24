import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCliToken,
  deleteAccount,
  DELETED_LOGIN,
  engineUrl,
  fetchTokens,
  fetchUserProfile,
  isNotFound,
  revokeToken,
  runnerUrl,
  type ApiToken,
  type Engine,
} from '../api'
import { useAuth } from '../auth-context'
import { GameList } from '../components'
import { formatDate, formatRating, relativeTime } from '../format'
import { primaryRating } from '../games'
import { button, link, panel, row } from '../styles'
import {
  DangerZone,
  ErrorText,
  FreshToken,
  Hint,
  Loading,
  LoadError,
  Page,
  SectionHeader,
  StatusDot,
  TagPills,
} from '../ui'
import NotFound from './NotFound'

function lastUsed(iso: string | null | undefined): string {
  if (!iso) return 'never used'
  const today = new Date(iso).toDateString() === new Date().toDateString()
  return today ? 'used today' : `used ${formatDate(iso)}`
}

function TokensPanel() {
  const queryClient = useQueryClient()
  const { data: tokens, error: loadError } = useQuery({
    queryKey: ['tokens'],
    queryFn: fetchTokens,
  })
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const error = actionError ?? (loadError ? "Couldn't load tokens" : null)

  const generate = async () => {
    setBusy(true)
    setActionError(null)
    try {
      setFresh(await createCliToken())
      await queryClient.invalidateQueries({ queryKey: ['tokens'] })
    } catch (e) {
      setActionError(`Couldn't create a token (${e instanceof Error ? e.message : e})`)
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
      setActionError(`Couldn't revoke the token (${e instanceof Error ? e.message : e})`)
    }
  }

  return (
    <div className={`${panel} flex flex-col gap-3.5 p-5`}>
      <div className="flex items-center">
        <span className="text-md font-semibold">API tokens</span>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className={`${button.primary} ml-auto h-7 px-3 text-meta`}
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      <span className="text-meta/5 text-muted">
        Used by <span className="font-mono text-fg">machineplay login</span> to
        upload engines from your terminal.
      </span>
      {fresh && <FreshToken token={fresh} />}
      {error && <ErrorText>{error}</ErrorText>}
      {tokens === undefined ? (
        <Hint>Loading…</Hint>
      ) : tokens.length === 0 ? (
        <Hint>No tokens yet</Hint>
      ) : (
        <div className="flex flex-col">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2.5 border-t border-line py-2.5 text-meta"
            >
              <code className="num">{t.prefix}…</code>
              <span className="truncate text-xs text-faint">
                {formatDate(t.created_at)} · {lastUsed(t.last_used_at)}
              </span>
              <button
                type="button"
                onClick={() => void revoke(t.id)}
                className="ml-auto text-muted transition-colors hover:text-loss"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeleteAccount({ login }: { login: string }) {
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const run = async () => {
    await deleteAccount()
    // The backend already cleared the session.
    setUser(null)
    void navigate('/', { replace: true })
  }

  return (
    <DangerZone
      title="Delete account"
      summary="Removes your engines, versions and runners. Played games stay in history."
      phrase={login}
      label="Delete account"
      busyLabel="Deleting…"
      onConfirm={run}
    >
      <p className="text-sm">
        Deletes your engines, every version you uploaded, their registry images
        and your runners. Anything still running — games, tournaments — ends
        immediately. This can't be undone.
      </p>
      <p className="text-xs text-faint">
        Games and tournaments you already played stay in the public history,
        credited to <span className="font-mono">{DELETED_LOGIN}</span>. Signing
        in with GitHub again creates a brand-new account, and the handle{' '}
        <span className="font-mono">{login}</span> is free for anyone to take.
      </p>
    </DangerZone>
  )
}

function EngineRows({ engines }: { engines: Engine[] }) {
  if (engines.length === 0) return <Hint>No engines yet</Hint>
  return (
    <div className="flex flex-col">
      {engines.map((e) => {
        const rated = primaryRating(e.ratings ?? {})
        return (
          <Link
            key={e.id}
            to={engineUrl(e)}
            className={`${row} grid grid-cols-[minmax(0,1fr)_90px] items-center gap-4 py-3 text-sm transition-colors hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto_110px_70px]`}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{e.name}</span>
              {e.description && (
                <span className="truncate text-xs text-faint">{e.description}</span>
              )}
            </div>
            <span className="hidden sm:block">
              <TagPills tags={e.tags} small />
            </span>
            <span className="num text-right" title={rated?.[0]}>
              {rated ? (
                <>
                  {formatRating(rated[1])}{' '}
                  <span className="text-xs text-faint">±{Math.round(rated[1].phi)}</span>
                </>
              ) : (
                <span className="text-faint">—</span>
              )}
            </span>
            <span className="hidden text-right text-meta text-muted sm:block">
              {e.version_count} ver.
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="num text-[23px] font-medium leading-[30px]">{n}</span>
      <span className="text-xs text-faint">{label}</span>
    </div>
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
      <LoadError what="this profile" error={error} onRetry={() => void refetch()} />
    )
  }
  if (profile === undefined) return <Loading />

  const isOwn = user !== null && user.login.toLowerCase() === profile.login.toLowerCase()
  const runners = profile.runners
  const plural = (n: number, one: string) => (n === 1 ? one : `${one}s`)

  return (
    <Page className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex flex-wrap items-center gap-5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-[72px] w-[72px] shrink-0 rounded-full border border-line-strong"
            />
          ) : (
            <span className="h-[72px] w-[72px] shrink-0 rounded-full border border-line-strong bg-track" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-title font-semibold">{profile.login}</h1>
            <span className="text-sm text-muted">
              {profile.name && `${profile.name} · `}joined {formatDate(profile.created_at)}
            </span>
          </div>
          <div className="ml-auto flex gap-8">
            <Count n={profile.engines.length} label={plural(profile.engines.length, 'engine')} />
            <Count n={runners.length} label={plural(runners.length, 'runner')} />
            <Count
              n={profile.tournament_count}
              label={plural(profile.tournament_count, 'tournament')}
            />
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <SectionHeader title="Engines">
            {isOwn && (
              <Link to="/engine/upload" className={link}>
                Upload an engine →
              </Link>
            )}
          </SectionHeader>
          <EngineRows engines={profile.engines} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader title="Recent games" />
          <GameList games={profile.games} />
        </section>
      </div>

      {(isOwn || runners.length > 0) && (
        <aside className="flex flex-col gap-6 pt-2">
          {isOwn && <TokensPanel />}
          {(isOwn || runners.length > 0) && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-line p-5">
              <span className="text-md font-semibold">Runners</span>
              {runners.length === 0 ? (
                <Hint>No runners yet</Hint>
              ) : (
                runners.map((r) => (
                  <Link
                    key={r.runner_id}
                    to={runnerUrl(r.runner_id)}
                    className="flex items-center gap-2.5 text-sm transition-colors hover:text-muted"
                  >
                    <StatusDot online={r.online} />
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-faint">
                      {r.online
                        ? `${r.active_games}/${r.max_games} games`
                        : r.last_seen_at
                          ? `Seen ${relativeTime(r.last_seen_at)}`
                          : 'Offline'}
                    </span>
                  </Link>
                ))
              )}
              {isOwn && (
                <Link to="/docs/add-runner" className={`${link} text-meta`}>
                  Add a runner →
                </Link>
              )}
            </div>
          )}
          {isOwn && <DeleteAccount login={profile.login} />}
        </aside>
      )}
    </Page>
  )
}
