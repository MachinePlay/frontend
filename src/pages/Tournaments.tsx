import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { fetchTournaments, tournamentUrl, type TournamentStatus } from '../api'
import { useAuth } from '../auth-context'
import { TournamentStatusPill } from '../components'
import { formatLabel, relativeTime } from '../format'
import { button, row, tableHead } from '../styles'
import { formatTc } from '../tc'
import { Hint, Page, PageHeader, Segmented, Switch, ThinProgress } from '../ui'

type Filter = 'all' | TournamentStatus

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'aborted', label: 'Aborted' },
] as const

const grid =
  'grid grid-cols-[minmax(0,1fr)_100px] gap-3 sm:grid-cols-[minmax(0,1.5fr)_120px_80px_minmax(0,1fr)_110px_90px]'

export default function Tournaments() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [mine, setMine] = useState(false)
  const { data: tournaments, error } = useQuery({
    queryKey: ['tournaments'],
    queryFn: fetchTournaments,
    refetchInterval: 5_000,
  })

  const all = tournaments ?? []
  const count = (s: TournamentStatus) => all.filter((t) => t.status === s).length
  const shown = all.filter(
    (t) =>
      (filter === 'all' || t.status === filter) &&
      (!mine || t.created_by === user?.login),
  )

  return (
    <Page>
      <PageHeader
        title="Tournaments"
        subtitle={tournaments && `${count('running')} running · ${count('completed')} completed`}
      >
        <Link to="/tournament/new" className={button.primary}>
          New tournament
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Status"
            value={filter}
            onChange={setFilter}
            options={FILTERS}
          />
          {user && (
            <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-meta text-muted">
              Only mine
              <Switch checked={mine} onChange={setMine} label="Only mine" />
            </label>
          )}
        </div>

        <div className="flex flex-col">
          <div className={`${grid} ${tableHead}`}>
            <span>Name</span>
            <span className="hidden sm:block">Format</span>
            <span className="hidden text-right sm:block">Engines</span>
            <span className="hidden sm:block">Progress</span>
            <span>Status</span>
            <span className="hidden text-right sm:block">Created</span>
          </div>
          {error ? (
            <div className="py-3">
              <Hint>Couldn't load tournaments</Hint>
            </div>
          ) : tournaments === undefined ? (
            <div className="py-3">
              <Hint>Loading…</Hint>
            </div>
          ) : shown.length === 0 ? (
            <div className="py-3">
              <Hint>{all.length ? 'No tournaments match' : 'No tournaments yet'}</Hint>
            </div>
          ) : (
            shown.map((t) => (
              <Link
                key={t.id}
                to={tournamentUrl(t.id)}
                className={`${grid} ${row} items-center py-3.5 text-sm transition-colors hover:bg-surface`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="truncate text-xs text-faint">
                    <span className="num">{formatTc(t.tc)}</span> ·{' '}
                    {t.rated ? `rated ${t.rating_category}` : 'unrated'} · by{' '}
                    {t.created_by}
                  </span>
                </div>
                <span className="hidden text-muted sm:block">{formatLabel(t.format)}</span>
                <span className="hidden text-right text-muted sm:block">
                  {t.participant_count}
                </span>
                <span className="hidden sm:block">
                  <ThinProgress done={t.games_completed} total={t.games_total} />
                </span>
                <span>
                  <TournamentStatusPill status={t.status} />
                </span>
                <span className="hidden text-right text-meta text-faint sm:block">
                  {relativeTime(t.created_at)}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </Page>
  )
}
