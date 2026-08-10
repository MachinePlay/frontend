import {
  useEffect,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { Chessground } from './Chessground'
import {
  ApiError,
  engineUrl,
  gameUrl,
  isUnreachable,
  runnerUrl,
  tournamentUrl,
  type Engine,
  type Game,
  type Runner,
  type RunnerLive,
  type Tournament,
  type TournamentStatus,
} from './api'
import { formatLabel, relativeTime } from './format'

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

/** Full-page "we couldn't load this" state. Distinct from NotFound, which
    means the backend said the thing doesn't exist — this one means we never
    got an answer we could trust. */
export function LoadError({
  what,
  error,
  onRetry,
}: {
  what: string
  error: unknown
  onRetry?: () => void
}) {
  const status = error instanceof ApiError ? error.status : null
  const detail = isUnreachable(error)
    ? 'the API is unreachable — the backend is probably down.'
    : status !== null
      ? `the API answered ${status}.`
      : 'something went wrong.'
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center gap-3 text-center">
      <p className="text-xl font-semibold text-neutral-100">
        couldn't load {what}
      </p>
      <p className="text-neutral-400 text-sm">{detail}</p>
      {error instanceof Error && !isUnreachable(error) && (
        <p className="text-neutral-600 text-xs font-mono">{error.message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800 transition-colors"
        >
          try again
        </button>
      )}
    </div>
  )
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

/** A destructive action in two clicks: the first arms the button, the second
    runs it. Failures render beside the button and disarm it, so the backend's
    refusal ("… games pending or playing") is what the user reads. */
export function ConfirmButton({
  label,
  confirmLabel,
  busyLabel,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  busyLabel: string
  onConfirm: () => Promise<unknown>
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Disarm the confirm step after a moment so a stray click can't linger.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-red-400 text-xs">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => (armed ? void run() : setArmed(true))}
        className={`shrink-0 text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
          armed
            ? 'border-red-700 text-red-400 hover:bg-red-950'
            : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
        }`}
      >
        {busy ? busyLabel : armed ? confirmLabel : label}
      </button>
    </span>
  )
}

const cardClass =
  'block border border-neutral-800 hover:border-neutral-600 rounded px-3 py-2 transition-colors'

const iconButtonClass =
  'inline-flex shrink-0 items-center justify-center rounded p-1 text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800 transition-colors disabled:opacity-40'

const fieldClass =
  'bg-neutral-900 border border-neutral-800 focus:border-neutral-600 rounded px-2 py-1 text-sm text-neutral-100 outline-none font-normal'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-3.5 w-3.5',
} as const

const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z" />
  </svg>
)

const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="m5 13 4 4L19 7" />
  </svg>
)

const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

/** Edit-in-place for one field: the value reads as plain text with a pencil
    beside it, and turns into an input with save/cancel icons on click.
    `children` is the display rendering (inline content — this sits inside
    headings and paragraphs); `value` is the raw string being edited. Enter
    saves (⌘/Ctrl+Enter when `multiline`), Escape cancels. */
export function InlineEdit({
  value,
  onSave,
  label,
  editable = false,
  multiline = false,
  placeholder,
  hint,
  inputClass = '',
  children,
}: {
  value: string
  onSave: (next: string) => Promise<unknown>
  label: string
  editable?: boolean
  multiline?: boolean
  placeholder?: string
  hint?: string
  inputClass?: string
  children: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    if (draft === value) return cancel()
    setBusy(true)
    try {
      await onSave(draft)
      setEditing(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') cancel()
    else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void save()
    }
  }

  if (!editable) return <>{children}</>

  if (!editing) {
    return (
      <span
        className={`inline-flex gap-1 ${multiline ? 'items-start' : 'items-center'}`}
      >
        {children}
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => {
            setDraft(value)
            setError(null)
            setEditing(true)
          }}
          className={iconButtonClass}
        >
          <PencilIcon />
        </button>
      </span>
    )
  }

  // The field stays enabled while saving: disabling it blurs the element, so a
  // rejected save would leave the caret (and Escape) nowhere.
  const field = multiline ? (
    <textarea
      autoFocus
      rows={3}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${fieldClass} w-full resize-y ${inputClass}`}
    />
  ) : (
    <input
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${fieldClass} ${inputClass}`}
    />
  )

  const actions = (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label="save"
        title="save"
        disabled={busy}
        onClick={() => void save()}
        className={`${iconButtonClass} hover:text-green-400`}
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        aria-label="cancel"
        title="cancel"
        disabled={busy}
        onClick={cancel}
        className={`${iconButtonClass} hover:text-red-400`}
      >
        <CloseIcon />
      </button>
      {error ? (
        <span className="text-red-400 text-xs font-normal">{error}</span>
      ) : (
        hint && <span className="text-neutral-600 text-xs font-normal">{hint}</span>
      )}
    </span>
  )

  return multiline ? (
    <span className="flex flex-col items-start gap-1 w-full max-w-xl">
      {field}
      {actions}
    </span>
  ) : (
    <span className="inline-flex flex-wrap items-center gap-1">
      {field}
      {actions}
    </span>
  )
}

/** Keyword pills — an engine's tags. */
export function TagPills({ tags }: { tags: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-400"
        >
          {tag}
        </span>
      ))}
    </span>
  )
}

export function GameRow({ game }: { game: Game }) {
  // fastchess reports "normal" for a plain finish — noise, hide it.
  const reason =
    game.reason && game.reason !== 'normal' ? game.reason : null
  return (
    <Link to={gameUrl(game.id)} className={cardClass}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{game.white_name}</span>
        <span className="text-neutral-500">vs</span>
        <span className="font-medium">{game.black_name}</span>
        {game.status === 'aborted' ? (
          <span
            className="ml-auto text-xs text-amber-500/80"
            title={reason ?? undefined}
          >
            aborted
          </span>
        ) : (
          <span className="ml-auto font-mono text-xs text-neutral-400">
            {game.status === 'playing' ? '…' : (game.result ?? '*')}
          </span>
        )}
      </div>
      <div className="text-xs text-neutral-500 mt-0.5">
        {relativeTime(game.ended_at ?? game.created_at)}
        {reason && game.status !== 'aborted' && <> · {reason}</>}
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

/** A live game as a board preview with names + move counter — the dashboard
    card, reused on the tournament page. */
export function LiveGameCard({ game }: { game: Game }) {
  const moveNo = Math.max(1, Math.ceil(game.moves.length / 2))
  return (
    <Link
      to={gameUrl(game.id)}
      className="group flex flex-col gap-2 rounded-lg border border-neutral-800 hover:border-neutral-600 bg-neutral-900/60 p-3 transition-colors"
    >
      <Chessground
        className="!w-full"
        config={{
          fen: game.fen,
          viewOnly: true,
          coordinates: false,
          drawable: { enabled: false },
        }}
      />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium truncate">{game.white_name}</span>
        <span className="text-neutral-500">vs</span>
        <span className="font-medium truncate">{game.black_name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          live
        </span>
        <span className="ml-auto">move {moveNo}</span>
      </div>
    </Link>
  )
}

/** Responsive grid of live game cards (the dashboard's live section). */
export function LiveGameGrid({ games }: { games: Game[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {games.map((g) => (
        <LiveGameCard key={g.id} game={g} />
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
        {engine.version_count === 0 ? (
          // Nothing to play: it can't be entered into a game or tournament
          // until something is uploaded.
          <span className="ml-auto text-xs text-amber-500/80">no versions</span>
        ) : (
          <span className="ml-auto text-xs text-neutral-500">
            {engine.version_count}{' '}
            {engine.version_count === 1 ? 'version' : 'versions'}
          </span>
        )}
      </div>
      {engine.description && (
        <div className="text-xs text-neutral-500 mt-0.5">
          {engine.description}
        </div>
      )}
      {engine.tags.length > 0 && (
        <div className="mt-1.5">
          <TagPills tags={engine.tags} />
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

/** A labeled utilization bar (0–100%). `detail` overrides the "NN%" readout. */
export function Meter({
  label,
  percent,
  detail,
}: {
  label: string
  percent: number
  detail?: string
}) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      <div className="flex justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="text-neutral-300 tabular-nums">
          {detail ?? `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full bg-green-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// A runner joined with its latest live status (fresher than the polled row when
// present). Live events win for online/telemetry/active_games.
export function RunnerRow({
  runner,
  live,
}: {
  runner: Runner
  live?: RunnerLive
}) {
  const online = live?.online ?? runner.online
  const activeGames = live?.active_games ?? runner.active_games
  const telemetry = live?.telemetry ?? runner.telemetry
  return (
    <Link to={runnerUrl(runner.runner_id)} className={cardClass}>
      <div className="flex items-center gap-2 text-sm">
        <StatusDot online={online} />
        <span className="font-medium text-neutral-100">{runner.name}</span>
        <span className="text-xs text-neutral-500">{runner.owner_login}</span>
        <span className="ml-auto text-xs text-neutral-500">
          {online
            ? `${activeGames}/${runner.max_games} games`
            : runner.last_seen_at
              ? `seen ${relativeTime(runner.last_seen_at)}`
              : 'offline'}
        </span>
      </div>
      {online && telemetry && (
        <div className="flex gap-4 mt-2">
          <Meter label="cpu" percent={telemetry.cpu_percent} />
          <Meter label="ram" percent={telemetry.ram_percent} />
        </div>
      )}
      {runner.description && (
        <div className="text-xs text-neutral-500 mt-0.5">
          {runner.description}
        </div>
      )}
    </Link>
  )
}

export function RunnerList({
  runners,
  live,
}: {
  runners: Runner[]
  live?: Map<string, RunnerLive>
}) {
  if (runners.length === 0) return <Hint>no runners registered</Hint>
  return (
    <div className="flex flex-col gap-2">
      {runners.map((r) => (
        <RunnerRow key={r.runner_id} runner={r} live={live?.get(r.runner_id)} />
      ))}
    </div>
  )
}

const STATUS_STYLES: Record<TournamentStatus, string> = {
  running: 'text-green-400 border-green-800',
  completed: 'text-neutral-300 border-neutral-700',
  aborted: 'text-amber-500/90 border-amber-800',
}

/** Small outlined pill for a tournament's status. */
export function TournamentStatusPill({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[status]}`}
    >
      {status === 'running' && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      )}
      {status}
    </span>
  )
}

export function TournamentRow({ tournament: t }: { tournament: Tournament }) {
  return (
    <Link to={tournamentUrl(t.id)} className={cardClass}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-neutral-100 truncate">{t.name}</span>
        <span className="text-xs text-neutral-500">{formatLabel(t.format)}</span>
        <span className="ml-auto shrink-0">
          <TournamentStatusPill status={t.status} />
        </span>
      </div>
      <div className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
        <span>{t.participant_count} engines</span>
        <span>·</span>
        <span className="tabular-nums">
          {t.games_completed}/{t.games_total} games
        </span>
        <span className="ml-auto">
          {relativeTime(t.ended_at ?? t.created_at)}
        </span>
      </div>
    </Link>
  )
}

export function TournamentList({ tournaments }: { tournaments: Tournament[] }) {
  if (tournaments.length === 0) return <Hint>no tournaments yet</Hint>
  return (
    <div className="flex flex-col gap-2">
      {tournaments.map((t) => (
        <TournamentRow key={t.id} tournament={t} />
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
