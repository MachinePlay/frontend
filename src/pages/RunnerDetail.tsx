import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import {
  fetchRunner,
  isNotFound,
  profileUrl,
  updateRunner,
  type RunnerDetail as RunnerDetailData,
} from '../api'
import { GameList, GameRow } from '../components'
import { useAuth } from '../auth-context'
import { useRunnerStream } from '../useRunnerStream'
import { formatBytes, formatCount, relativeTime } from '../format'
import { moveNumber } from '../games'
import { button, panel } from '../styles'
import {
  Hint,
  InlineEdit,
  LiveDot,
  Loading,
  LoadError,
  Meter,
  Page,
  SectionHeader,
  StatusDot,
} from '../ui'
import NotFound from './NotFound'

function Facts({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <div className={`${panel} flex flex-col gap-4 p-5`}>
      <span className="text-md font-semibold">{title}</span>
      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-faint">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function RunnerDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const {
    data: runner,
    error,
    refetch,
  } = useQuery({
    queryKey: ['runner', id],
    queryFn: () => fetchRunner(id),
    staleTime: 5_000,
    refetchInterval: (q) => (q.state.data?.online ? 5_000 : false),
  })
  const liveMap = useRunnerStream()

  // Written straight into the cache so the field doesn't flicker back.
  const patch = async (body: { name?: string; description?: string }) => {
    const updated = await updateRunner(id, body)
    queryClient.setQueryData<RunnerDetailData>(['runner', id], (prev) =>
      prev ? { ...prev, ...updated } : prev,
    )
    await queryClient.invalidateQueries({ queryKey: ['runners'] })
  }

  if (error) {
    return isNotFound(error) ? (
      <NotFound />
    ) : (
      <LoadError what="this runner" error={error} onRetry={() => void refetch()} />
    )
  }
  if (!runner) return <Loading />

  const isOwner = user?.login === runner.owner_login
  const live = liveMap.get(runner.runner_id)
  const online = live?.online ?? runner.online
  const activeGames = live?.active_games ?? runner.active_games ?? 0
  const telemetry = online ? (live?.telemetry ?? runner.telemetry) : null
  const hw = runner.hardware

  return (
    <Page className="!gap-8">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusDot online={online} size={10} />
            <h1 className="text-title font-semibold">
              <InlineEdit
                editable={editing}
                value={runner.name}
                label="Rename runner"
                inputClass="w-56"
                onSave={(name) => patch({ name })}
              >
                <span>{runner.name}</span>
              </InlineEdit>
            </h1>
            <span className={`text-meta ${online ? 'text-win' : 'text-faint'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="text-md text-muted">
            Owned by{' '}
            <Link
              to={profileUrl(runner.owner_login)}
              className="text-fg transition-colors hover:text-muted"
            >
              {runner.owner_login}
            </Link>
            {(runner.description || editing) && (
              <>
                {' · '}
                <InlineEdit
                  editable={editing}
                  value={runner.description}
                  label="Edit description"
                  multiline
                  placeholder="Describe this runner"
                  hint="⌘/Ctrl+Enter to save"
                  onSave={(description) => patch({ description })}
                >
                  <span className={runner.description ? '' : 'text-faint'}>
                    {runner.description || 'Add a description'}
                  </span>
                </InlineEdit>
              </>
            )}
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={`${button.secondary} ml-auto`}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className={`${panel} p-5`}>
          <Meter
            large
            accent
            label="Games"
            percent={runner.max_games ? (100 * activeGames) / runner.max_games : 0}
            detail={`${activeGames} / ${runner.max_games}`}
          />
        </div>
        <div className={`${panel} p-5`}>
          <Meter
            large
            label="CPU"
            percent={telemetry?.cpu_percent ?? 0}
            detail={telemetry ? undefined : '—'}
          />
        </div>
        <div className={`${panel} p-5`}>
          <Meter
            large
            label="RAM"
            percent={telemetry?.ram_percent ?? 0}
            detail={
              telemetry
                ? `${formatBytes(telemetry.ram_used_bytes)}${hw ? ` / ${formatBytes(hw.ram_total_bytes)}` : ''} · ${telemetry.ram_percent.toFixed(0)}%`
                : '—'
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionHeader title="Playing now">
            <span className="text-meta text-faint">
              {runner.playing.length} {runner.playing.length === 1 ? 'game' : 'games'}
            </span>
          </SectionHeader>
          {runner.playing.length === 0 ? (
            <Hint>{online ? 'Idle' : 'Offline'}</Hint>
          ) : (
            <div className="flex flex-col">
              {runner.playing.map((g) => (
                <GameRow
                  key={g.id}
                  game={g}
                  showResult={false}
                  meta={
                    <span className="inline-flex items-center gap-2">
                      {g.tournament_name ?? 'Casual'} · move {moveNumber(g.moves.length)}
                      <LiveDot />
                    </span>
                  }
                />
              ))}
            </div>
          )}
          <div className="mt-6">
            <SectionHeader title="Recently finished">
              <span className="text-meta text-faint">
                {formatCount(runner.games_played ?? 0)} games total
              </span>
            </SectionHeader>
          </div>
          <GameList games={runner.recent} />
        </div>

        <div className="flex flex-col gap-5">
          <Facts
            title="Status"
            rows={[
              ['State', online ? 'Online' : 'Offline'],
              ['Capacity', `${activeGames} / ${runner.max_games} games`],
              [
                'Last seen',
                online ? 'Now' : runner.last_seen_at ? relativeTime(runner.last_seen_at) : '—',
              ],
              [
                'Runner ID',
                <span className="num text-meta text-muted">{runner.runner_id}</span>,
              ],
            ]}
          />
          {hw ? (
            <Facts
              title="Hardware"
              rows={[
                ['CPU', hw.cpu_model],
                ['Cores', `${hw.cpu_physical_cores} physical / ${hw.cpu_logical_cores} logical`],
                ['Memory', formatBytes(hw.ram_total_bytes)],
              ]}
            />
          ) : (
            <div className={`${panel} p-5`}>
              <Hint>Hardware not reported yet</Hint>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
