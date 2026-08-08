import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { fetchRunner, profileUrl, updateRunner } from '../api'
import { Hint, InlineEdit, Meter, Section, StatusDot } from '../components'
import { useAuth } from '../auth-context'
import { useRunnerStream } from '../useRunnerStream'
import { formatBytes, relativeTime } from '../format'
import NotFound from './NotFound'

// Mounted at /runners/:id.
export default function RunnerDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: runner, error } = useQuery({
    queryKey: ['runner', id],
    queryFn: () => fetchRunner(id),
    staleTime: 5_000,
  })
  const liveMap = useRunnerStream()

  // Owner-only edits; the patched runner lands in the cache directly so the
  // field stops flickering back to its old value while the refetch is in
  // flight. The list view is only invalidated.
  const patch = async (body: { name?: string; description?: string }) => {
    const updated = await updateRunner(id, body)
    queryClient.setQueryData(['runner', id], updated)
    await queryClient.invalidateQueries({ queryKey: ['runners'] })
  }

  if (error) {
    return <NotFound />
  }
  if (!runner) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Hint>loading…</Hint>
      </div>
    )
  }

  const isOwner = user?.login === runner.owner_login
  // Prefer live status when the SSE feed has it; fall back to the polled row.
  const live = liveMap.get(runner.runner_id)
  const online = live?.online ?? runner.online
  const activeGames = live?.active_games ?? runner.active_games
  const telemetry = live?.telemetry ?? runner.telemetry
  const hw = runner.hardware

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
          <StatusDot online={online} />
          <InlineEdit
            editable={isOwner}
            value={runner.name}
            label="edit name"
            inputClass="w-56"
            onSave={(name) => patch({ name })}
          >
            <span>{runner.name}</span>
          </InlineEdit>
        </h1>
        <p className="text-sm text-neutral-400">
          owned by{' '}
          <Link
            to={profileUrl(runner.owner_login)}
            className="text-neutral-300 hover:text-neutral-100 transition-colors"
          >
            {runner.owner_login}
          </Link>
        </p>
        {(runner.description || isOwner) && (
          <div className="mt-1 text-neutral-400 text-sm">
            <InlineEdit
              editable={isOwner}
              value={runner.description}
              label="edit description"
              multiline
              placeholder="describe this runner"
              hint="⌘/ctrl+enter to save"
              onSave={(description) => patch({ description })}
            >
              <span
                className={runner.description ? '' : 'text-neutral-600 italic'}
              >
                {runner.description || 'add a description'}
              </span>
            </InlineEdit>
          </div>
        )}
      </div>

      <Section title="status">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-neutral-500">state</dt>
          <dd className="text-neutral-200">{online ? 'online' : 'offline'}</dd>
          <dt className="text-neutral-500">capacity</dt>
          <dd className="text-neutral-200">
            {activeGames}/{runner.max_games} games
          </dd>
          <dt className="text-neutral-500">last seen</dt>
          <dd className="text-neutral-200">
            {runner.last_seen_at ? relativeTime(runner.last_seen_at) : '—'}
          </dd>
        </dl>
      </Section>

      <Section title="hardware">
        {hw ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-neutral-500">cpu</dt>
            <dd className="text-neutral-200">{hw.cpu_model}</dd>
            <dt className="text-neutral-500">cores</dt>
            <dd className="text-neutral-200">
              {hw.cpu_physical_cores} physical / {hw.cpu_logical_cores} logical
            </dd>
            <dt className="text-neutral-500">memory</dt>
            <dd className="text-neutral-200">
              {formatBytes(hw.ram_total_bytes)}
            </dd>
          </dl>
        ) : (
          <Hint>hardware not reported yet</Hint>
        )}
      </Section>

      <Section title="utilization">
        {online && telemetry ? (
          <div className="flex flex-col gap-3 max-w-md">
            <Meter label="cpu" percent={telemetry.cpu_percent} />
            <Meter
              label="ram"
              percent={telemetry.ram_percent}
              detail={
                hw
                  ? `${formatBytes(telemetry.ram_used_bytes)} / ${formatBytes(
                      hw.ram_total_bytes,
                    )} · ${telemetry.ram_percent.toFixed(0)}%`
                  : `${formatBytes(telemetry.ram_used_bytes)} · ${telemetry.ram_percent.toFixed(0)}%`
              }
            />
          </div>
        ) : online ? (
          <Hint>waiting for telemetry…</Hint>
        ) : (
          <Hint>offline</Hint>
        )}
      </Section>
    </div>
  )
}
