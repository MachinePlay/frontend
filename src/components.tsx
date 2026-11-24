import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Config } from '@lichess-org/chessground/config'
import { Chessground } from './Chessground'
import { gameUrl, type Game, type TournamentStatus } from './api'
import { barFill } from './eval'
import { formatClock } from './format'
import { finishedMeta, moveNumber, resultText } from './games'
import { formatTc } from './tc'
import { Hint, LiveDot } from './ui'

/** Fields shared by `Game` and the lean `TournamentGameRow`. */
type GameRowData = Pick<
  Game,
  | 'id'
  | 'white_name'
  | 'black_name'
  | 'status'
  | 'result'
  | 'reason'
  | 'created_at'
  | 'ended_at'
>

function defaultMeta(game: GameRowData): ReactNode {
  if (game.status === 'playing') return 'In progress'
  if (game.status === 'pending') return 'Pending'
  if (game.status === 'aborted') {
    return (
      <>
        <span className="text-loss">Aborted</span> · {finishedMeta(game)}
      </>
    )
  }
  return finishedMeta(game)
}

/** "white – black", a meta line and the result: one hairline row. */
export function GameRow({
  game,
  meta,
  active = false,
  showResult = true,
}: {
  game: GameRowData
  meta?: ReactNode
  active?: boolean
  showResult?: boolean
}) {
  return (
    <Link
      to={gameUrl(game.id)}
      className={`flex items-center gap-2 border-b border-line-row py-[9px] text-sm transition-colors ${
        active ? '-mx-2 rounded bg-accent/10 px-2' : 'hover:bg-surface'
      }`}
    >
      <span className="min-w-0 truncate">{game.white_name}</span>
      <span className="text-faint">–</span>
      <span className="min-w-0 truncate">{game.black_name}</span>
      <span
        className={`ml-auto shrink-0 whitespace-nowrap pl-2 text-xs ${active ? 'text-accent' : 'text-faint'}`}
      >
        {meta ?? defaultMeta(game)}
      </span>
      {showResult && (
        <span className="num w-11 shrink-0 text-right text-meta font-medium">
          {resultText(game)}
        </span>
      )}
    </Link>
  )
}

export function GameList({
  games,
  empty = 'No games yet',
}: {
  games: GameRowData[]
  empty?: string
}) {
  if (games.length === 0) return <Hint>{empty}</Hint>
  return (
    <div className="flex flex-col">
      {games.map((g) => (
        <GameRow key={g.id} game={g} />
      ))}
    </div>
  )
}

/** A thin vertical eval bar, White's share filled from the bottom. */
function MiniEvalBar({ game }: { game: Game }) {
  const fill = barFill(game.score ?? null)
  return (
    <div className="relative w-1.5 shrink-0 overflow-hidden rounded-sm bg-track">
      <div
        className="absolute inset-x-0 bottom-0 bg-fg transition-[height] duration-300"
        style={{ height: `${fill * 100}%` }}
      />
    </div>
  )
}

function CardPlayer({
  name,
  clock,
  toMove,
}: {
  name: string
  clock: number
  toMove: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className={`num shrink-0 text-meta ${toMove ? 'text-fg' : 'text-muted'}`}>
        {formatClock(clock)}
      </span>
    </div>
  )
}

/** A live game's board preview, on the home and tournament pages. */
export function LiveGameCard({ game }: { game: Game }) {
  // A fresh config would redraw the board on every render.
  const config = useMemo(
    (): Config => ({
      fen: game.fen,
      viewOnly: true,
      coordinates: false,
      drawable: { enabled: false },
    }),
    [game.fen],
  )
  const whiteToMove = game.fen.split(' ')[1] !== 'b'
  return (
    <Link to={gameUrl(game.id)} className="group flex min-w-0 flex-col gap-2">
      <CardPlayer
        name={game.black_name}
        clock={game.black_clock}
        toMove={!whiteToMove}
      />
      <div className="flex gap-1.5">
        <MiniEvalBar game={game} />
        <div className="min-w-0 flex-1 transition-opacity group-hover:opacity-90">
          <Chessground className="!w-full" config={config} />
        </div>
      </div>
      <CardPlayer
        name={game.white_name}
        clock={game.white_clock}
        toMove={whiteToMove}
      />
      <span className="truncate text-xs text-faint">
        {game.tournament_name ?? 'Casual'} · move {moveNumber(game.moves.length)}
        {game.tc && (
          <>
            {' · '}
            <span className="num">{formatTc(game.tc)}</span>
          </>
        )}
      </span>
    </Link>
  )
}

export function LiveGameGrid({
  games,
  columns = 4,
}: {
  games: Game[]
  columns?: 2 | 4
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-5 ${columns === 4 ? 'md:grid-cols-3 lg:grid-cols-4 lg:gap-6' : ''}`}
    >
      {games.map((g) => (
        <LiveGameCard key={g.id} game={g} />
      ))}
    </div>
  )
}

const STATUS_LABEL: Record<TournamentStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  aborted: 'Aborted',
}

export function TournamentStatusPill({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${
        status === 'running'
          ? 'border-accent/45 text-accent'
          : status === 'aborted'
            ? 'border-line-strong text-loss'
            : 'border-line-strong text-muted'
      }`}
    >
      {status === 'running' && <LiveDot />}
      {STATUS_LABEL[status]}
    </span>
  )
}

/** The status as plain coloured text, where a pill would be too loud. */
export function TournamentStatusText({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={`text-xs ${
        status === 'running'
          ? 'text-accent'
          : status === 'aborted'
            ? 'text-loss'
            : 'text-muted'
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
