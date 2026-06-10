import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { fetchEngineByName, profileUrl } from '../api'
import { GameList, Hint, Section } from '../components'
import { formatBytes } from '../format'
import NotFound from './NotFound'

// Mounted at /{login}/{engineName}, GitHub-style.
export default function EngineDetail() {
  const { login = '', engineName = '' } = useParams()
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
