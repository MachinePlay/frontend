import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Config } from '@lichess-org/chessground/config'
import { Chessground } from '../Chessground'
import { cancelGame, runnerUrl, type GameStatus } from '../api'
import { useAuth } from '../auth-context'
import { formatClock } from '../format'
import { useGame } from '../useGame'
import { usePositions } from '../usePositions'

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
  return (
    <span className="cg-wrap captured-pieces">
      {pieces.map((p, i) => (
        <piece key={i} className={`${p.type} ${p.color}`} />
      ))}
    </span>
  )
}

/** The side's remaining time. While it is this side's turn the countdown runs
    on an interval owned *here*, so ten ticks a second re-render one span
    instead of the board and the whole move list. */
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
      className={`ml-auto font-mono tabular-nums px-1.5 py-0.5 rounded ${
        ticking
          ? 'bg-neutral-100 text-neutral-900'
          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
      }`}
    >
      {formatClock(seconds)}
    </span>
  )
}

/** One side's row above/below the board: color label, engine name + version,
    captured pieces, and the (possibly ticking) clock. */
function PlayerBar({
  color,
  name,
  version,
  pieces,
  clock,
  since,
  active,
}: {
  color: 'white' | 'black'
  name: string | null
  version: string | null
  pieces: CapturedPiece[]
  clock: number | null
  since: number
  active: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm max-w-[var(--board-size)]">
      <span className="text-neutral-500 uppercase tracking-wide text-xs">
        {color}
      </span>
      <span className="text-neutral-100 font-medium">{name ?? '—'}</span>
      {version && (
        <span className="text-neutral-500 text-xs font-mono">{version}</span>
      )}
      <CapturedPieces pieces={pieces} />
      {clock !== null && (
        <Clock base={clock} since={since} ticking={active} />
      )}
    </div>
  )
}

/** One numbered pair of plies. Memoized because a 400-ply game re-renders its
    list on every incoming move, and only the touched rows actually change. */
const MoveRow = memo(function MoveRow({
  number,
  white,
  black,
  activeSide,
  onJump,
}: {
  number: number
  white: string
  black: string | undefined
  activeSide: 'white' | 'black' | null
  onJump: (ply: number) => void
}) {
  return (
    <li data-active={activeSide !== null} className="flex gap-2">
      <span className="text-neutral-500 w-6 shrink-0 text-right">{number}.</span>
      <button
        type="button"
        onClick={() => onJump(number * 2 - 1)}
        className={`w-14 shrink-0 text-left px-1 rounded ${
          activeSide === 'white'
            ? 'bg-neutral-100 text-neutral-900'
            : 'text-neutral-100 hover:bg-neutral-800'
        }`}
      >
        {white}
      </button>
      {black !== undefined && (
        <button
          type="button"
          onClick={() => onJump(number * 2)}
          className={`flex-1 text-left px-1 rounded ${
            activeSide === 'black'
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          {black}
        </button>
      )}
    </li>
  )
})

/** The scrollable move list, kept out of the page's own render so a ticking
    clock doesn't touch it. */
const MoveList = memo(function MoveList({
  moves,
  activePly,
  onJump,
}: {
  moves: string[]
  activePly: number
  onJump: (ply: number) => void
}) {
  const listRef = useRef<HTMLOListElement | null>(null)

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activePly, moves.length])

  return (
    <ol
      ref={listRef}
      className="flex-1 min-h-0 overflow-y-auto text-sm font-mono p-2 space-y-0.5"
    >
      {moves.length === 0 ? (
        <li className="text-neutral-600 italic">no moves yet</li>
      ) : (
        Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
          <MoveRow
            key={i}
            number={i + 1}
            white={moves[i * 2]}
            black={moves[i * 2 + 1]}
            activeSide={
              activePly === i * 2 + 1
                ? 'white'
                : activePly === i * 2 + 2
                  ? 'black'
                  : null
            }
            onJump={onJump}
          />
        ))
      )}
    </ol>
  )
})

/** A single or double chevron, pointing left unless flipped. */
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

/** Start / back / forward / end, under the move list — the same jumps the
    arrow, up and down keys make. */
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
    { to: 0, title: 'game start (↑)', off: atStart, icon: <Chevron dir="left" double /> },
    { to: activePly - 1, title: 'previous move (←)', off: atStart, icon: <Chevron dir="left" /> },
    { to: activePly + 1, title: 'next move (→)', off: atEnd, icon: <Chevron dir="right" /> },
    { to: plies, title: 'game end (↓)', off: atEnd, icon: <Chevron dir="right" double /> },
  ]
  return (
    <div className="flex border-t border-neutral-800">
      {steps.map((s) => (
        <button
          key={s.title}
          type="button"
          title={s.title}
          aria-label={s.title}
          disabled={s.off}
          onClick={() => onJump(s.to)}
          className="flex-1 flex items-center justify-center py-1.5 text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent"
        >
          {s.icon}
        </button>
      ))}
    </div>
  )
}

/** Terminal state under the move list: result + termination reason, or a
    cancel control while the game is playing (logged-in users only). */
function GameStatusPanel({
  gameId,
  status,
  result,
  reason,
}: {
  gameId: string
  status: GameStatus | null
  result: string | null
  reason: string | null
}) {
  const { user } = useAuth()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Disarm the confirm step after a moment so a stray click can't linger.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const doCancel = async () => {
    setBusy(true)
    setError(null)
    try {
      await cancelGame(gameId)
      // The game's SSE stream delivers the aborted game_end; no local state.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  if (status === 'playing') {
    return (
      <div className="flex flex-col items-center gap-1 text-sm">
        <span className="text-neutral-500 italic">playing</span>
        {user && (
          <button
            type="button"
            disabled={busy}
            onClick={() => (armed ? void doCancel() : setArmed(true))}
            className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
              armed
                ? 'border-red-700 text-red-400 hover:bg-red-950'
                : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            {busy ? 'cancelling…' : armed ? 'really cancel?' : 'cancel game'}
          </button>
        )}
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </div>
    )
  }

  if (status === null) return null

  // "normal" is fastchess's Termination for a plain finish — noise, hide it.
  const detail = reason && reason !== 'normal' ? reason : null
  return (
    <div className="flex flex-col items-center gap-0.5 text-sm">
      {status === 'aborted' ? (
        <span className="text-amber-500/90 font-medium">aborted</span>
      ) : (
        <span className="text-neutral-100 font-medium">{result ?? '*'}</span>
      )}
      {detail && <span className="text-neutral-500 text-xs">{detail}</span>}
    </div>
  )
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>()
  const {
    loadError,
    connStatus,
    whiteName,
    blackName,
    whiteVersion,
    blackVersion,
    tc,
    runnerId,
    moves,
    result,
    reason,
    status: gameStatus,
    clocks,
  } = useGame(id)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [viewPly, setViewPly] = useState<number | null>(null)

  const effectiveViewPly = viewPly ?? moves.length
  const following = viewPly === null && gameStatus === 'playing'
  const isClockTicking = gameStatus === 'playing' && following

  // A move that failed to parse leaves the line short, so clamp rather than
  // indexing past the end.
  const positions = usePositions(moves)
  const shown = positions[Math.min(effectiveViewPly, positions.length - 1)]
  const displayFen = shown.fen

  // One config object per actual change: Chessground's `set` redraws the board
  // whenever this identity moves, and a new literal each render redraws it on
  // every unrelated state change.
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
        jumpTo(effectiveViewPly - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        jumpTo(effectiveViewPly + 1)
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
  }, [effectiveViewPly, moves.length, jumpTo])

  const { byWhite, byBlack } = captured(displayFen)
  const sideToMove: 'white' | 'black' =
    displayFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const whiteBar = {
    color: 'white',
    name: whiteName,
    version: whiteVersion,
    pieces: byWhite,
    clock: clocks?.white ?? null,
    since: clocks?.updatedAt ?? 0,
    active: isClockTicking && sideToMove === 'white',
  } as const
  const blackBar = {
    color: 'black',
    name: blackName,
    version: blackVersion,
    pieces: byBlack,
    clock: clocks?.black ?? null,
    since: clocks?.updatedAt ?? 0,
    active: isClockTicking && sideToMove === 'black',
  } as const
  const topIsBlack = orientation === 'white'
  const top = topIsBlack ? blackBar : whiteBar
  const bottom = topIsBlack ? whiteBar : blackBar

  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-center flex flex-col gap-3">
        <p className="text-red-400">{loadError}</p>
        <Link to="/" className="text-neutral-400 hover:text-neutral-100 text-sm">
          ← back to home
        </Link>
      </div>
    )
  }

  const showFollowToggle = gameStatus === 'playing'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col items-center gap-4 sm:gap-6">
      <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[auto_auto] sm:gap-x-3">
        <div className="sm:col-start-1 sm:row-start-1">
          <PlayerBar {...top} />
        </div>
        <div className="relative sm:col-start-1 sm:row-start-2">
          <Chessground config={cgConfig} />
          <button
            type="button"
            onClick={() =>
              setOrientation((o) => (o === 'white' ? 'black' : 'white'))
            }
            aria-label="flip board"
            title="flip board"
            className="absolute -top-2 -right-2 bg-neutral-900 border border-neutral-700 text-neutral-200 hover:bg-neutral-800 rounded-full p-1.5 leading-none shadow"
          >
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
          </button>
        </div>
        <div className="sm:col-start-1 sm:row-start-3">
          <PlayerBar {...bottom} />
        </div>
        <div className="flex flex-col w-full h-32 sm:w-48 sm:h-[var(--board-size)] sm:col-start-2 sm:row-start-2 bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
          <MoveList
            moves={moves}
            activePly={effectiveViewPly}
            onJump={jumpTo}
          />
          <MoveNav
            activePly={effectiveViewPly}
            plies={moves.length}
            onJump={jumpTo}
          />
          {showFollowToggle && (
            <button
              type="button"
              onClick={() => jumpTo(moves.length)}
              disabled={following}
              title={
                following
                  ? 'following live moves'
                  : 'click to follow the live game'
              }
              className={`mx-1 mb-1 px-2 py-1 text-xs rounded border flex items-center justify-center gap-1.5 transition-colors ${
                following
                  ? 'border-green-700 text-green-400 cursor-default'
                  : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800 cursor-pointer'
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  following ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'
                }`}
              />
              {following ? 'following' : 'not following'}
            </button>
          )}
        </div>
        <div className="text-center sm:col-start-2 sm:row-start-3">
          {id && (
            <GameStatusPanel
              gameId={id}
              status={gameStatus}
              result={result}
              reason={reason}
            />
          )}
        </div>
      </div>

      <div className="text-xs text-neutral-500 flex items-center gap-4">
        {gameStatus === 'playing' && (
          <span
            aria-label={connStatus}
            title={connStatus}
            className={`inline-block w-2 h-2 rounded-full ${
              connStatus === 'connected'
                ? 'bg-green-500'
                : connStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-red-500'
            }`}
          />
        )}
        <span>
          move {Math.max(1, Math.ceil(effectiveViewPly / 2))}
          {effectiveViewPly < moves.length ? ` / ${Math.ceil(moves.length / 2)}` : ''}
        </span>
        {tc && <span className="font-mono">{tc}</span>}
        {runnerId && (
          <Link
            to={runnerUrl(runnerId)}
            className="hover:text-neutral-300 transition-colors"
          >
            runner
          </Link>
        )}
      </div>
    </div>
  )
}
