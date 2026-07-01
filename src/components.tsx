import { useState, type ComponentProps, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  engineUrl,
  gameUrl,
  runnerUrl,
  type Engine,
  type Game,
  type Runner,
} from './api'
import { relativeTime } from './format'

export function Section({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Muted one-liner for loading / empty states. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-neutral-500 text-sm italic">{children}</p>
}

export function PrimaryButton({
  className = '',
  ...rest
}: ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      className={`bg-neutral-100 text-neutral-900 rounded px-3 py-1 text-sm disabled:opacity-40 ${className}`}
    />
  )
}

const cardClass =
  'block border border-neutral-800 hover:border-neutral-600 rounded px-3 py-2 transition-colors'

export function GameRow({ game }: { game: Game }) {
  return (
    <Link to={gameUrl(game.id)} className={cardClass}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{game.white_name}</span>
        <span className="text-neutral-500">vs</span>
        <span className="font-medium">{game.black_name}</span>
        <span className="ml-auto font-mono text-xs text-neutral-400">
          {game.result ?? '*'}
        </span>
      </div>
      <div className="text-xs text-neutral-500 mt-0.5">
        {relativeTime(game.ended_at ?? game.created_at)}
      </div>
    </Link>
  )
}

export function GameList({ games }: { games: Game[] }) {
  if (games.length === 0) return <Hint>no games yet</Hint>
  return (
    <div className="flex flex-col gap-2">
      {games.map((g) => (
        <GameRow key={g.id} game={g} />
      ))}
    </div>
  )
}

export function EngineRow({ engine }: { engine: Engine }) {
  return (
    <Link to={engineUrl(engine)} className={cardClass}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-neutral-100">
          {engine.owner_login}/{engine.name}
        </span>
        <span className="ml-auto text-xs text-neutral-500">
          {engine.version_count}{' '}
          {engine.version_count === 1 ? 'version' : 'versions'}
        </span>
      </div>
      {engine.description && (
        <div className="text-xs text-neutral-500 mt-0.5">
          {engine.description}
        </div>
      )}
    </Link>
  )
}

export function EngineList({ engines }: { engines: Engine[] }) {
  if (engines.length === 0) return <Hint>no engines yet</Hint>
  return (
    <div className="flex flex-col gap-2">
      {engines.map((e) => (
        <EngineRow key={e.id} engine={e} />
      ))}
    </div>
  )
}

/** Small green/grey dot indicating a runner's online status. */
export function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        online ? 'bg-green-500' : 'bg-neutral-600'
      }`}
      aria-label={online ? 'online' : 'offline'}
    />
  )
}

export function RunnerRow({ runner }: { runner: Runner }) {
  return (
    <Link to={runnerUrl(runner.runner_id)} className={cardClass}>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot online={runner.online} />
        <span className="font-medium text-neutral-100">{runner.name}</span>
        <span className="text-xs text-neutral-500">{runner.owner_login}</span>
        <span className="ml-auto text-xs text-neutral-500">
          {runner.online
            ? `${runner.active_games}/${runner.max_games} games`
            : runner.last_seen_at
              ? `seen ${relativeTime(runner.last_seen_at)}`
              : 'offline'}
        </span>
      </div>
      {runner.description && (
        <div className="text-xs text-neutral-500 mt-0.5">
          {runner.description}
        </div>
      )}
    </Link>
  )
}

export function RunnerList({ runners }: { runners: Runner[] }) {
  if (runners.length === 0) return <Hint>no runners registered</Hint>
  return (
    <div className="flex flex-col gap-2">
      {runners.map((r) => (
        <RunnerRow key={r.runner_id} runner={r} />
      ))}
    </div>
  )
}

/** A freshly minted API token: shown once, with a copy button. */
export function FreshToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm font-mono text-neutral-200 break-all">
          {token}
        </code>
        <PrimaryButton onClick={() => void copy()} className="px-3 py-2 shrink-0">
          {copied ? 'copied' : 'copy'}
        </PrimaryButton>
      </div>
      <p className="text-amber-500/80 text-xs">
        Copy it now — for security it won't be shown again.
      </p>
    </div>
  )
}
