import { useState } from 'react'
import { Link } from 'react-router'
import { createCliToken, profileUrl } from '../api'
import { useAuth } from '../auth-context'
import { button, panel } from '../styles'
import { ErrorText, FreshToken, Hint, Page, PageHeader } from '../ui'

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
      setError("Couldn't create a token")
    } finally {
      setBusy(false)
    }
  }

  const big = `${button.primary} h-[34px] px-4 self-start`

  return (
    <Page className="!max-w-[560px] !gap-7 sm:!pt-20">
      <PageHeader
        title="CLI token"
        subtitle={
          <span className="text-md text-muted">
            Generate a token, then paste it into the{' '}
            <span className="font-mono text-fg">machineplay login</span> prompt in
            your terminal.
          </span>
        }
      />

      <div className={`${panel} flex flex-col gap-4 p-5`}>
        {loading ? (
          <Hint>…</Hint>
        ) : !user ? (
          <button type="button" onClick={login} className={big}>
            Sign in with GitHub
          </button>
        ) : token ? (
          <FreshToken token={token} />
        ) : (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className={big}
          >
            {busy ? 'Generating…' : 'Generate token'}
          </button>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </div>

      {user && (
        <p className="text-meta text-faint">
          Manage or revoke tokens on{' '}
          <Link to={profileUrl(user.login)} className="text-fg hover:text-muted">
            your profile
          </Link>
          .
        </p>
      )}
    </Page>
  )
}
