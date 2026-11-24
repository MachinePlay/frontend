import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  checkHandle,
  completeSignup,
  fetchPendingSignup,
  type PendingSignup,
} from '../api'
import { useAuth } from '../auth-context'
import { capitalize } from '../format'
import { button } from '../styles'
import { ErrorText, Hint, Page } from '../ui'

const CHECK_DELAY_MS = 300

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

// The OAuth callback lands a new account here to pick a handle.
export default function Register() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState<PendingSignup | null>(null)
  const [checked, setChecked] = useState(false)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const typed = handle.trim().toLowerCase()
  const settled = useDebounced(typed, CHECK_DELAY_MS)
  const { data: availability } = useQuery({
    queryKey: ['handle', settled],
    queryFn: () => checkHandle(settled),
    enabled: pending !== null && settled !== '',
    staleTime: 10_000,
  })
  // A stale answer for an earlier spelling says nothing.
  const verdict = settled === typed ? availability : undefined

  useEffect(() => {
    let cancelled = false
    fetchPendingSignup()
      .then((p) => {
        if (cancelled) return
        setPending(p)
        if (p) setHandle(p.suggested_login)
      })
      .catch(() => {
        if (!cancelled) setPending(null)
      })
      .finally(() => {
        if (!cancelled) setChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const user = await completeSignup(typed)
      setUser(user)
      navigate(`/${user.login}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  const narrow = '!max-w-[480px] !gap-7 sm:!pt-24'

  if (!checked) {
    return (
      <Page className={narrow}>
        <Hint>…</Hint>
      </Page>
    )
  }

  if (!pending) {
    return (
      <Page className={narrow}>
        <div className="flex flex-col gap-3">
          <h1 className="text-title font-semibold">No signup in progress</h1>
          <p className="text-sm text-muted">
            Sign in with GitHub first — you'll be sent back here to pick a
            username if your account is new.
          </p>
        </div>
      </Page>
    )
  }

  return (
    <Page className={narrow}>
      <div className="flex items-center gap-4">
        {pending.avatar_url ? (
          <img
            src={pending.avatar_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full border border-line-strong"
          />
        ) : (
          <span className="h-14 w-14 shrink-0 rounded-full border border-line-strong bg-track" />
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-semibold">Almost there</h1>
          <p className="text-sm text-muted">
            Pick a username to finish creating your account
            {pending.name ? `, ${pending.name}` : ''}.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex flex-col gap-7"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="handle" className="text-sm text-muted">
            Username
          </label>
          <div className="flex h-[42px] items-center rounded border border-line bg-surface px-3 font-mono text-md transition-colors focus-within:border-muted">
            <span className="text-faint">machineplay.org/</span>
            <input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
          {verdict &&
            (verdict.available ? (
              <span className="text-meta text-win">Available</span>
            ) : (
              <span className="text-meta text-loss">
                {capitalize(verdict.reason ?? 'unavailable')}
              </span>
            ))}
          <span className="text-meta/5 text-faint">
            Lowercase letters, digits and single hyphens. This becomes your
            profile URL and the namespace your engines are published under. It
            can't be changed later.
          </span>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <button
          type="submit"
          disabled={busy || !typed || verdict?.available === false}
          className={`${button.primary} h-[34px] self-start px-4`}
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </Page>
  )
}
