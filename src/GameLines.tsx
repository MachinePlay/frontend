import { memo, useMemo } from 'react'
import type { SearchInfo } from './api'
import { barFill, formatEval, pvSan, toWhite, type Side } from './eval'

const compact = (n: number | null | undefined): string | null => {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

/** The PV as "12. Nf3 Nc6 13. Bb5", numbered from the ply it starts at. */
function pvText(san: string[], startPly: number): string {
  return san
    .map((move, i) => {
      const ply = startPly + i
      const number = Math.floor(ply / 2) + 1
      if (ply % 2 === 0) return `${number}. ${move}`
      return i === 0 ? `${number}… ${move}` : move
    })
    .join(' ')
}

/** One engine's last search: its score, how deep it got, and the line it
    intended to play. `fen` is the position it was searching, which is what the
    PV plays out from. */
const EngineSearch = memo(function EngineSearch({
  side,
  name,
  info,
  fen,
  startPly,
  thinking,
}: {
  side: Side
  name: string | null
  info: SearchInfo | null
  fen: string | null
  startPly: number
  thinking: boolean
}) {
  const value = toWhite(info, side)
  const line = useMemo(
    () => (info && fen ? pvSan(fen, info.pv ?? []) : []),
    [info, fen],
  )
  const stats = [
    info?.depth != null
      ? `depth ${info.depth}${info.seldepth ? `/${info.seldepth}` : ''}`
      : null,
    compact(info?.nodes) && `${compact(info?.nodes)} nodes`,
    compact(info?.nps) && `${compact(info?.nps)} nps`,
    info?.time_ms != null ? `${(info.time_ms / 1000).toFixed(1)}s` : null,
  ].filter(Boolean)

  return (
    <div className="border-b border-neutral-800 px-2 py-1.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className={`w-4 text-center text-[10px] leading-4 rounded-sm font-medium shrink-0 ${
            side === 'white'
              ? 'bg-neutral-200 text-neutral-900'
              : 'bg-neutral-950 text-neutral-300 border border-neutral-700'
          }`}
        >
          {side === 'white' ? 'W' : 'B'}
        </span>
        <span className="text-neutral-300 truncate">{name ?? '—'}</span>
        {thinking && (
          <span className="text-[10px] text-green-500 animate-pulse shrink-0">
            thinking
          </span>
        )}
        <span
          className={`ml-auto font-mono tabular-nums shrink-0 ${
            barFill(value) >= 0.5 ? 'text-neutral-100' : 'text-neutral-400'
          }`}
        >
          {formatEval(value)}
        </span>
      </div>
      {info ? (
        <>
          <div className="text-[10px] text-neutral-500 font-mono">
            {stats.join(' · ') || 'no search info'}
          </div>
          {line.length > 0 && (
            <div className="text-[11px] font-mono text-neutral-400 leading-snug">
              {pvText(line, startPly)}
            </div>
          )}
        </>
      ) : (
        <div className="text-[10px] text-neutral-600 italic">
          nothing reported
        </div>
      )}
    </div>
  )
})

/** Every eval in the game on one axis, White's frame, one line per engine.

    Both engines score the same game from opposite sides, so the two lines
    diverging is the interesting part: it is the disagreement between them. */
export const EvalGraph = memo(function EvalGraph({
  evals,
  activePly,
  onJump,
}: {
  evals: (SearchInfo | null)[]
  activePly: number
  onJump: (ply: number) => void
}) {
  const W = 100
  const H = 40
  const plies = evals.length

  const paths = useMemo(() => {
    const build = (parity: number): string => {
      const points: string[] = []
      for (let i = parity; i < evals.length; i += 2) {
        const value = toWhite(evals[i], parity === 0 ? 'white' : 'black')
        if (!value) continue
        const x = plies > 1 ? ((i + 1) / plies) * W : W / 2
        const y = H - barFill(value) * H
        points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
      }
      return points.length > 1 ? `M${points.join(' L')}` : ''
    }
    return { white: build(0), black: build(1) }
  }, [evals, plies])

  if (!paths.white && !paths.black) {
    return (
      <div className="px-2 py-3 text-[10px] text-neutral-600 italic">
        no evaluations yet — engines that report `score` in their UCI `info`
        lines get graphed here
      </div>
    )
  }

  const markerX = plies > 0 ? (Math.min(activePly, plies) / plies) * W : 0
  return (
    <div className="px-2 py-2 flex flex-col gap-1">
      <div className="flex items-center gap-3 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1">
          <svg width="14" height="4">
            <line
              x1="0"
              y1="2"
              x2="14"
              y2="2"
              stroke="#e5e5e5"
              strokeWidth="2"
            />
          </svg>
          white engine
        </span>
        <span className="flex items-center gap-1">
          <svg width="14" height="4">
            <line
              x1="0"
              y1="2"
              x2="14"
              y2="2"
              stroke="#a3a3a3"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
          </svg>
          black engine
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-16 bg-neutral-950 rounded cursor-pointer"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const share = (e.clientX - box.left) / box.width
          onJump(Math.round(share * plies))
        }}
      >
        <line
          x1="0"
          y1={H / 2}
          x2={W}
          y2={H / 2}
          stroke="#404040"
          strokeWidth="0.5"
        />
        {paths.white && (
          <path
            d={paths.white}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {paths.black && (
          <path
            d={paths.black}
            fill="none"
            stroke="#a3a3a3"
            strokeWidth="1"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <line
          x1={markerX}
          y1="0"
          x2={markerX}
          y2={H}
          stroke="#22c55e"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
})

/** The "lines" tab: what each engine last said about the position on screen,
    then the whole game's evals as a graph. */
export function GameLines({
  white,
  black,
  evals,
  activePly,
  onJump,
}: {
  white: {
    name: string | null
    info: SearchInfo | null
    fen: string | null
    startPly: number
    thinking: boolean
  }
  black: {
    name: string | null
    info: SearchInfo | null
    fen: string | null
    startPly: number
    thinking: boolean
  }
  evals: (SearchInfo | null)[]
  activePly: number
  onJump: (ply: number) => void
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <EngineSearch side="white" {...white} />
      <EngineSearch side="black" {...black} />
      <EvalGraph evals={evals} activePly={activePly} onJump={onJump} />
    </div>
  )
}
