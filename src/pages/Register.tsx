import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  completeSignup,
  fetchPendingSignup,
  type PendingSignup,
} from '../api'
import { useAuth } from '../auth-context'
import { PrimaryButton } from '../components'

// Lands here from the GitHub OAuth callback when the account is new: the
// signup is parked server-side until the user picks a handle.
export default function Register() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState<PendingSignup | null>(null)
  const [checked, setChecked] = useState(false)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const user = await completeSignup(handle.trim())
      setUser(user)
      navigate(`/${user.login}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'registration failed')
    } finally {
      setBusy(false)
    }
  }

  if (!checked) {
    return <p className="max-w-md mx-auto px-4 py-8 text-neutral-500">…</p>
  }

  if (!pending) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 flex flex-col gap-3">
        <h1 className="text-xl font-semibold">No signup in progress</h1>
        <p className="text-neutral-400 text-sm">
          Sign in with GitHub first — you'll be sent back here to pick a
          username if your account is new.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {pending.avatar_url && (
          <img
            src={pending.avatar_url}
            alt=""
            className="h-12 w-12 rounded-full border border-neutral-700"
          />
        )}
        <div>
          <h1 className="text-xl font-semibold">Almost there</h1>
          <p className="text-neutral-400 text-sm">
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
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">username</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoFocus
            spellCheck={false}
            className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 font-mono text-neutral-100 focus:outline-none focus:border-neutral-600"
          />
        </label>
        <p className="text-neutral-500 text-xs">
          Lowercase letters, digits and single hyphens. This becomes your
          profile URL and the namespace your engines are published under — it
          can't be changed later.
        </p>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <PrimaryButton
          type="submit"
          disabled={busy || !handle.trim()}
          className="self-start px-4 py-1.5"
        >
          {busy ? 'creating…' : 'create account'}
        </PrimaryButton>
      </form>
    </div>
  )
}
