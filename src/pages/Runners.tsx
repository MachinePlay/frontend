import { useQuery } from '@tanstack/react-query'
import { fetchRunners } from '../api'
import { Hint, RunnerList } from '../components'

export default function Runners() {
  const { data: runners, error } = useQuery({
    queryKey: ['runners'],
    queryFn: fetchRunners,
    staleTime: 5_000,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-100">runners</h1>
      {error ? (
        <p className="text-red-400 text-sm">failed to load runners</p>
      ) : runners === undefined ? (
        <Hint>loading…</Hint>
      ) : (
        <RunnerList runners={runners} />
      )}
    </div>
  )
}
