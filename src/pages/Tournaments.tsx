import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { fetchTournaments } from '../api'
import { Hint, TournamentList } from '../components'

export default function Tournaments() {
  const { data: tournaments, error } = useQuery({
    queryKey: ['tournaments'],
    queryFn: fetchTournaments,
    refetchInterval: 5_000,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-neutral-100">tournaments</h1>
        <Link
          to="/tournament/new"
          className="ml-auto text-sm text-neutral-400 hover:text-neutral-100"
        >
          new tournament →
        </Link>
      </div>
      {error ? (
        <p className="text-red-400 text-sm">failed to load tournaments</p>
      ) : tournaments === undefined ? (
        <Hint>loading…</Hint>
      ) : (
        <TournamentList tournaments={tournaments} />
      )}
    </div>
  )
}
