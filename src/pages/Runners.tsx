import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { fetchRunners, runnerUrl, type Runner, type RunnerLive } from '../api'
import { formatBytes, relativeTime } from '../format'
import { link, panel } from '../styles'
import { Hint, Meter, Page, PageHeader, StatusDot } from '../ui'
import { useRunnerStream } from '../useRunnerStream'

function hardwareLine(runner: Runner): string | null {
  const hw = runner.hardware
  if (!hw) return null
  return `${hw.cpu_model} · ${hw.cpu_physical_cores} cores / ${hw.cpu_logical_cores} threads · ${formatBytes(hw.ram_total_bytes)}`
}

// Live status, when present, wins over the polled row.
function RunnerCard({ runner, live }: { runner: Runner; live?: RunnerLive }) {
  const online = live?.online ?? runner.online
  const active = live?.active_games ?? runner.active_games ?? 0
  const telemetry = online ? (live?.telemetry ?? runner.telemetry) : null
  const hw = hardwareLine(runner)
  return (
    <Link
      to={runnerUrl(runner.runner_id)}
      className={`${panel} flex flex-col gap-4 p-5 transition-colors hover:border-line-strong ${online ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-2.5 text-md">
        <StatusDot online={online} />
        <span className="min-w-0 truncate font-medium">{runner.name}</span>
        <span className="shrink-0 text-meta text-faint">{runner.owner_login}</span>
        <span className="ml-auto shrink-0 text-meta text-muted">
          {online
            ? 'Online'
            : runner.last_seen_at
              ? `Seen ${relativeTime(runner.last_seen_at)}`
              : 'Offline'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-5">
        <Meter
          label="Games"
          accent
          percent={runner.max_games ? (100 * active) / runner.max_games : 0}
          detail={`${active}/${runner.max_games}`}
        />
        <Meter label="CPU" percent={telemetry?.cpu_percent ?? 0} />
        <Meter label="RAM" percent={telemetry?.ram_percent ?? 0} />
      </div>
      {hw && <span className="num truncate text-xs text-faint">{hw}</span>}
      {runner.description && (
        <span className="-mt-2 text-xs text-faint">{runner.description}</span>
      )}
    </Link>
  )
}

export default function Runners() {
  const { data: runners, error } = useQuery({
    queryKey: ['runners'],
    queryFn: fetchRunners,
    staleTime: 5_000,
  })
  const live = useRunnerStream()
  const online = (runners ?? []).filter(
    (r) => live.get(r.runner_id)?.online ?? r.online,
  ).length

  return (
    <Page>
      <PageHeader
        title="Runners"
        subtitle={
          runners &&
          `Machines that play the games. ${online} of ${runners.length} online.`
        }
      >
        <Link to="/docs/add-runner" className={`${link} text-sm`}>
          Add a runner →
        </Link>
      </PageHeader>
      {error ? (
        <Hint>Couldn't load runners</Hint>
      ) : runners === undefined ? (
        <Hint>Loading…</Hint>
      ) : runners.length === 0 ? (
        <Hint>No runners registered</Hint>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {runners.map((r) => (
            <RunnerCard key={r.runner_id} runner={r} live={live.get(r.runner_id)} />
          ))}
        </div>
      )}
    </Page>
  )
}
