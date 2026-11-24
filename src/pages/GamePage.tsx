import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Config } from '@lichess-org/chessground/config'
import { Chessground } from '../Chessground'
import {
  cancelGame,
  isNotFound,
  runnerUrl,
  tournamentUrl,
  type Rating,
  type RatingChange,
  type SearchInfo,
} from '../api'
import { useAuth } from '../auth-context'
import { EvalBar } from '../EvalBar'
import { evalsAt, formatEval, toWhite } from '../eval'
import {
  capitalize,
  formatClock,
  formatRating,
  formatResult,
} from '../format'
import { moveNumber } from '../games'
import { GameDebug } from '../GameDebug'
import { EngineSearch, EvalGraph } from '../GameLines'
import { MoreFromTournament } from '../MoreFromTournament'
import { panel } from '../styles'
import { formatTc, ratingCategory } from '../tc'
import {
  ColorChip,
  ConfirmButton,
  LiveDot,
  LoadError,
  Page,
  RatingDelta,
  Tabs,
} from '../ui'
import { useGame } from '../useGame'
import { usePositions } from '../usePositions'
import NotFound from './NotFound'

const TABS = [
  { value: 'moves', label: 'Moves' },
  { value: 'graph', label: 'Eval graph' },
  { value: 'log', label: 'UCI log' },
] as const
type Tab = (typeof TABS)[number]['value']

const PIECE_NAMES: Record<string, string> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
}

const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'] as const

type CapturedPiece = { type: string; color: 'white' | 'black' }

function captured(fen: string): {
  byWhite: CapturedPiece[]
  byBlack: CapturedPiece[]
} {
  const board = fen.split(' ')[0]
  const counts: Record<string, number> = {}
  for (const ch of board) {
    if (/[a-zA-Z]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1
  }
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
  const byWhite: CapturedPiece[] = []
  const byBlack: CapturedPiece[] = []
  for (const p of PIECE_ORDER) {
    const whiteCaptured = Math.max(0, start[p] - (counts[p] ?? 0))
    const blackCaptured = Math.max(0, start[p] - (counts[p.toUpperCase()] ?? 0))
    const net = whiteCaptured - blackCaptured
    if (net > 0) {
      for (let i = 0; i < net; i++)
        byWhite.push({ type: PIECE_NAMES[p], color: 'black' })
    } else if (net < 0) {
      for (let i = 0; i < -net; i++)
        byBlack.push({ type: PIECE_NAMES[p], color: 'white' })
    }
  }
  return { byWhite, byBlack }
}

function CapturedPieces({ pieces }: { pieces: CapturedPiece[] }) {
  if (pieces.length === 0) return null
  return (
    <span className="cg-wrap captured-pieces">
      {pieces.map((p, i) => (
        <piece key={i} className={`${p.type} ${p.color}`} />
      ))}
    </span>
  )
}

/** The ticking clock owns its interval, so ten ticks a second re-render one
    span, not the board and move list. */
function Clock({
  base,
  since,
  ticking,
}: {
  base: number
  since: number
  ticking: boolean
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ticking) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [ticking])

  const seconds = ticking
    ? Math.max(0, base - Math.max(0, (now - since) / 1000))
    : base
  return (
    <span
      className={`num ml-auto shrink-0 rounded border px-2.5 py-0.5 text-[22px] font-medium leading-7 ${
        ticking
          ? 'border-fg bg-fg text-bg'
          : 'border-line bg-surface text-muted'
      }`}
    >
      {formatClock(seconds)}
    </span>
  )
}

function PlayerBar({
  color,
  name,
  version,
  change,
  current,
  pieces,
  clock,
  since,
  active,
}: {
  color: 'white' | 'black'
  name: string | null
  version: string | null
  change: RatingChange | null
  current: Rating | null
  pieces: CapturedPiece[]
  clock: number | null
  since: number
  active: boolean
}) {
  return (
    <div className="flex w-[calc(var(--eval-bars)+var(--board-size))] min-h-8 items-center gap-2.5 pl-[var(--eval-bars)] text-md">
      <ColorChip color={color} />
      <span className="min-w-0 truncate font-medium">{name ?? '—'}</span>
      {version && (
        <span className="num shrink-0 text-xs text-faint">{version}</span>
      )}
      {change ? (
        <span className="shrink-0 text-meta tabular-nums text-muted">
          {Math.round(change.after)}{' '}
          <RatingDelta delta={change.after - change.before} />
        </span>
      ) : (
        current && (
          <span className="shrink-0 text-meta tabular-nums text-muted">
            {formatRating(current)}
          </span>
        )
      )}
      <CapturedPieces pieces={pieces} />
      {clock !== null && <Clock base={clock} since={since} ticking={active} />}
    </div>
  )
}

const MoveRow = memo(function MoveRow({
  number,
  white,
  black,
  activeSide,
  bookPlies,
  onJump,
}: {
  number: number
  white: string
  black: string | undefined
  activeSide: 'white' | 'black' | null
  bookPlies: number
  onJump: (ply: number) => void
}) {
  // Book moves are dimmed, so they aren't mistaken for an engine's choice.
  const cell = (ply: number, san: string, tone: string) => (
    <button
      type="button"
      onClick={() => onJump(ply)}
      title={ply <= bookPlies ? 'From the opening book' : undefined}
      className={`min-w-0 truncate rounded-[3px] px-1.5 py-0.5 text-left transition-colors ${
        activeSide === (ply % 2 ? 'white' : 'black')
          ? 'bg-fg text-bg'
          : `hover:bg-surface-2 ${ply <= bookPlies ? 'text-faint' : tone}`
      }`}
    >
      {san}
    </button>
  )
  return (
    <li
      data-active={activeSide !== null}
      className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1"
    >
      <span className="pr-1 text-right text-faint">{number}.</span>
      {cell(number * 2 - 1, white, 'text-fg')}
      {black !== undefined && cell(number * 2, black, 'text-muted')}
    </li>
  )
})

/** Its own component, so a ticking clock doesn't re-render it. */
const MoveList = memo(function MoveList({
  moves,
  activePly,
  bookPlies,
  onJump,
}: {
  moves: string[]
  activePly: number
  bookPlies: number
  onJump: (ply: number) => void
}) {
  const listRef = useRef<HTMLOListElement | null>(null)

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activePly, moves.length])

  if (moves.length === 0) {
    return <p className="p-3 text-sm text-faint">No moves yet</p>
  }
  return (
    <ol
      ref={listRef}
      className="num grid h-full grid-cols-1 content-start gap-x-3 gap-y-0.5 overflow-y-auto px-2.5 py-2 text-sm sm:grid-cols-2"
    >
      {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
        <MoveRow
          key={i}
          number={i + 1}
          white={moves[i * 2]}
          black={moves[i * 2 + 1]}
          bookPlies={bookPlies}
          activeSide={
            activePly === i * 2 + 1
              ? 'white'
              : activePly === i * 2 + 2
                ? 'black'
                : null
          }
          onJump={onJump}
        />
      ))}
    </ol>
  )
})

function Chevron({ dir, double }: { dir: 'left' | 'right'; double?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={dir === 'right' ? 'rotate-180' : undefined}
    >
      <path d="M15 18l-6-6 6-6" />
      {double && <path d="M9 18l-6-6 6-6" />}
    </svg>
  )
}

/** Start / back / forward / end, like the arrow keys. */
function MoveNav({
  activePly,
  plies,
  onJump,
}: {
  activePly: number
  plies: number
  onJump: (ply: number) => void
}) {
  const atStart = activePly <= 0
  const atEnd = activePly >= plies
  const steps = [
    { to: 0, title: 'Game start (↑)', off: atStart, icon: <Chevron dir="left" double /> },
    { to: activePly - 1, title: 'Previous move (←)', off: atStart, icon: <Chevron dir="left" /> },
    { to: activePly + 1, title: 'Next move (→)', off: atEnd, icon: <Chevron dir="right" /> },
    { to: plies, title: 'Game end (↓)', off: atEnd, icon: <Chevron dir="right" double /> },
  ]
  return (
    <div className="flex border-t border-line text-muted">
      {steps.map((s) => (
        <button
          key={s.title}
          type="button"
          title={s.title}
          aria-label={s.title}
          disabled={s.off}
          onClick={() => onJump(s.to)}
          className="flex flex-1 items-center justify-center py-2.5 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
        >
          {s.icon}
        </button>
      ))}
    </div>
  )
}

function FlipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

const Dot = () => <span className="text-faint">·</span>

function GameView({ id }: { id: string }) {
  const { user } = useAuth()
  const {
    loadError,
    detail,
    connStatus,
    whiteName,
    blackName,
    whiteVersion,
    blackVersion,
    whiteRating,
    blackRating,
    tc,
    runnerId,
    bookPlies,
    moves,
    evals,
    liveSearch,
    uciLines,
    result,
    reason,
    status: gameStatus,
    clocks,
    endedAt,
  } = useGame(id)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [viewPly, setViewPly] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('moves')
  const boardRef = useRef<HTMLDivElement | null>(null)

  const effectiveViewPly = viewPly ?? moves.length
  const following = viewPly === null && gameStatus === 'playing'
  const isClockTicking = gameStatus === 'playing' && following

  // A move that failed to parse leaves the line short.
  const positions = usePositions(moves)
  const shown = positions[Math.min(effectiveViewPly, positions.length - 1)]
  const displayFen = shown.fen

  // Chessground redraws whenever this identity changes.
  const cgConfig = useMemo(
    (): Config => ({
      viewOnly: true,
      coordinates: true,
      orientation,
      fen: shown.fen,
      lastMove: shown.from && shown.to ? [shown.from, shown.to] : undefined,
    }),
    [orientation, shown],
  )

  const jumpTo = useCallback(
    (targetPly: number) => {
      const clamped = Math.max(0, Math.min(moves.length, targetPly))
      const live = clamped === moves.length && gameStatus === 'playing'
      setViewPly(live ? null : clamped)
    },
    [moves.length, gameStatus],
  )

  const step = useCallback(
    (delta: number) => {
      setViewPly((current) => {
        const next = Math.max(
          0,
          Math.min(moves.length, (current ?? moves.length) + delta),
        )
        return next === moves.length && gameStatus === 'playing' ? null : next
      })
    },
    [moves.length, gameStatus],
  )

  // Wheel over the board walks the game, as on lichess. Native and non-passive:
  // React's `onWheel` is passive and can't stop the page scrolling.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    let last = 0
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY) return
      e.preventDefault()
      // A trackpad flick is dozens of events; a mouse notch should be one ply.
      if (e.timeStamp - last < 30) return
      last = e.timeStamp
      step(e.deltaY > 0 ? 1 : -1)
    }
    board.addEventListener('wheel', onWheel, { passive: false })
    return () => board.removeEventListener('wheel', onWheel)
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      } else if (e.key === 'ArrowUp' || e.key === 'Home') {
        e.preventDefault()
        jumpTo(0)
      } else if (e.key === 'ArrowDown' || e.key === 'End') {
        e.preventDefault()
        jumpTo(moves.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moves.length, jumpTo, step])

  if (loadError) {
    return isNotFound(loadError) ? (
      <NotFound />
    ) : (
      <LoadError what="this game" error={loadError} />
    )
  }

  // The running search if it's this side's turn live, else its last move's.
  const stored = evalsAt(evals, effectiveViewPly)
  const liveIsCurrent =
    liveSearch !== null && following && liveSearch.ply === moves.length
  const searchFor = (
    side: 'white' | 'black',
  ): { info: SearchInfo | null; fen: string | null; startPly: number } => {
    if (liveIsCurrent && liveSearch.side === side) {
      return { info: liveSearch.info, fen: displayFen, startPly: moves.length }
    }
    const found = stored[side]
    if (!found) return { info: null, fen: null, startPly: 0 }
    return {
      info: found.info,
      fen: positions[Math.min(found.ply, positions.length - 1)].fen,
      startPly: found.ply,
    }
  }
  const whiteSearch = searchFor('white')
  const blackSearch = searchFor('black')
  const whiteEval = toWhite(whiteSearch.info, 'white')
  const blackEval = toWhite(blackSearch.info, 'black')

  const { byWhite, byBlack } = captured(displayFen)
  const sideToMove: 'white' | 'black' =
    displayFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const whiteBar = {
    color: 'white',
    name: whiteName,
    version: whiteVersion,
    change: whiteRating,
    current: detail?.white_current ?? null,
    pieces: byWhite,
    clock: clocks?.white ?? null,
    since: clocks?.updatedAt ?? 0,
    active: isClockTicking && sideToMove === 'white',
  } as const
  const blackBar = {
    color: 'black',
    name: blackName,
    version: blackVersion,
    change: blackRating,
    current: detail?.black_current ?? null,
    pieces: byBlack,
    clock: clocks?.black ?? null,
    since: clocks?.updatedAt ?? 0,
    active: isClockTicking && sideToMove === 'black',
  } as const
  const top = orientation === 'white' ? blackBar : whiteBar
  const bottom = orientation === 'white' ? whiteBar : blackBar

  const evalTitle = (side: string, name: string | null, info: SearchInfo | null) =>
    `${side} engine${name ? ` (${name})` : ''}: ${formatEval(toWhite(info, side === 'White' ? 'white' : 'black'))}${
      info?.depth ? ` at depth ${info.depth}` : ''
    }`

  const tournamentId = detail?.tournament_id ?? null

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-meta text-muted">
        {gameStatus === 'playing' && (
          <>
            <LiveDot />
            <span className="text-accent">
              {connStatus === 'error' ? 'Reconnecting…' : 'Live'}
            </span>
            <Dot />
          </>
        )}
        {gameStatus === 'ended' && (
          <>
            <span className="num font-medium text-fg">{formatResult(result)}</span>
            {reason && <span>{capitalize(reason)}</span>}
            <Dot />
          </>
        )}
        {gameStatus === 'aborted' && (
          <>
            <span className="text-loss">Aborted{reason ? ` · ${reason}` : ''}</span>
            <Dot />
          </>
        )}
        {tournamentId && detail?.tournament_name ? (
          <>
            <Link
              to={tournamentUrl(tournamentId)}
              className="text-fg transition-colors hover:text-muted"
            >
              {detail.tournament_name}
            </Link>
            {detail.tournament_seq != null && (
              <span>Game {detail.tournament_seq + 1}</span>
            )}
          </>
        ) : (
          detail && <span>Casual</span>
        )}
        {tc && (
          <>
            <Dot />
            <span>{detail?.rated ? `rated ${ratingCategory(tc)}` : 'unrated'}</span>
            <Dot />
            <span className="num">{formatTc(tc)}</span>
          </>
        )}
        {runnerId && (
          <>
            <Dot />
            <Link to={runnerUrl(runnerId)} className="transition-colors hover:text-fg">
              runner {detail?.runner_name ?? ''}
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-2.5">
          <PlayerBar {...top} />
          <div className="flex gap-3">
            <div className="flex gap-1">
              <EvalBar
                side="white"
                title={evalTitle('White', whiteName, whiteSearch.info)}
                value={whiteEval}
                flipped={orientation === 'black'}
              />
              <EvalBar
                side="black"
                title={evalTitle('Black', blackName, blackSearch.info)}
                value={blackEval}
                flipped={orientation === 'black'}
              />
            </div>
            <div ref={boardRef} className="relative">
              <Chessground config={cgConfig} />
              <button
                type="button"
                onClick={() =>
                  setOrientation((o) => (o === 'white' ? 'black' : 'white'))
                }
                aria-label="Flip board"
                title="Flip board"
                className="absolute -right-2.5 -top-2.5 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line-strong bg-surface text-fg transition-colors hover:bg-surface-2"
              >
                <FlipIcon />
              </button>
            </div>
          </div>
          <PlayerBar {...bottom} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:pt-10">
          <div className={`${panel} flex flex-col overflow-hidden`}>
            <EngineSearch
              side="white"
              name={whiteName}
              thinking={liveIsCurrent && liveSearch.side === 'white'}
              {...whiteSearch}
            />
            <EngineSearch
              side="black"
              name={blackName}
              thinking={liveIsCurrent && liveSearch.side === 'black'}
              {...blackSearch}
            />
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
            <div className="flex h-60 flex-col">
              {tab === 'moves' && (
                <MoveList
                  moves={moves}
                  bookPlies={bookPlies}
                  activePly={effectiveViewPly}
                  onJump={jumpTo}
                />
              )}
              {tab === 'graph' && (
                <EvalGraph
                  evals={evals}
                  activePly={effectiveViewPly}
                  onJump={jumpTo}
                />
              )}
              {tab === 'log' && (
                <GameDebug lines={uciLines} live={gameStatus === 'playing'} />
              )}
            </div>
            <MoveNav
              activePly={effectiveViewPly}
              plies={moves.length}
              onJump={jumpTo}
            />
            {gameStatus === 'playing' && (
              <div className="px-2 pb-2">
                <button
                  type="button"
                  onClick={() => jumpTo(moves.length)}
                  disabled={following}
                  className={`flex h-[30px] w-full items-center justify-center gap-2 rounded border text-meta transition-colors ${
                    following
                      ? 'cursor-default border-accent/45 text-accent'
                      : 'border-line-strong text-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  {following && <LiveDot />}
                  {following ? 'Following live' : 'Back to live'}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-meta text-muted">
            <span>
              Move {moveNumber(effectiveViewPly)}
              {effectiveViewPly < moves.length && ` / ${moveNumber(moves.length)}`}
              {gameStatus === 'playing' && following && ` · ${sideToMove} to move`}
            </span>
            {gameStatus === 'playing' && user && (
              <span className="ml-auto">
                <ConfirmButton
                  label="Cancel game"
                  confirmLabel="Really cancel?"
                  busyLabel="Cancelling…"
                  // The SSE stream delivers the aborted game_end.
                  onConfirm={() => cancelGame(id)}
                />
              </span>
            )}
          </div>
        </div>
      </div>

      {tournamentId && (
        <MoreFromTournament
          tournamentId={tournamentId}
          gameId={id}
          plies={moves.length}
          endedAt={endedAt}
        />
      )}
    </Page>
  )
}

/** Keyed on the id, so moving to another game starts from a clean slate. */
export default function GamePage() {
  const { id = '' } = useParams()
  return <GameView key={id} id={id} />
}
