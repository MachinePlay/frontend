import { useState } from 'react'
import { createCliToken } from '../api'
import { useAuth } from '../auth-context'
import { FreshToken, Hint, PrimaryButton } from '../components'

export default function CliToken() {
  const { user, loading, login } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      setToken(await createCliToken())
    } catch {
      setError('could not create a token')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-neutral-100">CLI token</h1>
      <p className="text-neutral-400 text-sm">
        Generate a token, then paste it into the{' '}
        <span className="font-mono">machineplay login</span> prompt in your
        terminal.
      </p>

      {loading ? (
        <Hint>…</Hint>
      ) : !user ? (
        <PrimaryButton onClick={login} className="self-start">
          sign in with GitHub
        </PrimaryButton>
      ) : token ? (
        <FreshToken token={token} />
      ) : (
        <PrimaryButton
          onClick={() => void generate()}
          disabled={busy}
          className="self-start"
        >
          {busy ? 'generating…' : 'generate token'}
        </PrimaryButton>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
