import { Link } from 'react-router'
import { fetchEngines } from '../api'
import { EngineList, Hint } from '../components'
import { useFetch } from '../hooks'

export default function Engines() {
  const { data: engines, error } = useFetch(fetchEngines, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-neutral-100">engines</h1>
        <Link
          to="/engine/upload"
          className="ml-auto text-sm text-neutral-400 hover:text-neutral-100"
        >
          upload an engine →
        </Link>
      </div>
      {error ? (
        <p className="text-red-400 text-sm">failed to load engines</p>
      ) : engines === null ? (
        <Hint>loading…</Hint>
      ) : (
        <EngineList engines={engines} />
      )}
    </div>
  )
}
