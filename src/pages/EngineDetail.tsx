import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  fetchEngineByName,
  profileUrl,
  type EngineDetail as EngineDetailT,
} from '../api'
import NotFound from './NotFound'

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

// Mounted at /{login}/{engineName}, GitHub-style.
export default function EngineDetail() {
  const { login = '', engineName = '' } = useParams()
  const [engine, setEngine] = useState<EngineDetailT | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchEngineByName(login, engineName)
      .then((d) => {
        if (!cancelled) setEngine(d)
      })
      .catch(() => {
        if (!cancelled) setError('engine not found')
      })
    return () => {
      cancelled = true
    }
  }, [login, engineName])

  if (error) {
    return <NotFound />
  }
  if (!engine) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-neutral-500 text-sm italic">
        loading…
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
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
        {engine.description && (
          <p className="text-neutral-400 text-sm">{engine.description}</p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">
          versions
        </h2>
        {engine.versions.length === 0 ? (
          <p className="text-neutral-500 text-sm italic">no versions uploaded</p>
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm uppercase tracking-wide text-neutral-500">
          recent games
        </h2>
        {engine.games.length === 0 ? (
          <p className="text-neutral-500 text-sm italic">no games yet</p>
        ) : (
          <div className="flex flex-col gap-1">
            {engine.games.map((g) => (
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
    </div>
  )
}
