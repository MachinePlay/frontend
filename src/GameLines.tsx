import { memo, useMemo } from 'react'
import type { SearchInfo } from './api'
import { barFill, formatEval, pvSan, toWhite, type Side } from './eval'
import { SideChip } from './ui'

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

export type SearchView = {
  name: string | null
  info: SearchInfo | null
  // The position it searched.
  fen: string | null
  startPly: number
  thinking: boolean
}

/** One engine's latest search, always on screen beside the board. */
export const EngineSearch = memo(function EngineSearch({
  side,
  name,
  info,
  fen,
  startPly,
  thinking,
}: SearchView & { side: Side }) {
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
    <div className="flex flex-col gap-1.5 border-b border-line px-4 py-3.5">
      <div className="flex items-center gap-2 text-sm">
        <SideChip side={side} wide />
        <span className="min-w-0 truncate">{name ?? '—'}</span>
        <span
          className={`shrink-0 text-xs text-accent transition-opacity ${thinking ? '' : 'opacity-0'}`}
        >
          thinking
        </span>
        <span className="num ml-auto shrink-0 text-md font-medium">
          {formatEval(value)}
        </span>
      </div>
      {info ? (
        <>
          <span className="num text-xs text-faint">
            {stats.join(' · ') || 'No search info'}
          </span>
          {line.length > 0 && (
            <span className="num line-clamp-2 text-meta/5 text-muted">
              {pvText(line, startPly)}
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-faint">Nothing reported</span>
      )}
    </div>
  )
})

/** Every eval in White's frame, one line per engine: where they diverge, the
    engines disagree. */
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
      <p className="p-3 text-xs text-faint">
        No evaluations yet. Engines that report a score in their UCI info lines
        get graphed here.
      </p>
    )
  }

  const markerX = plies > 0 ? (Math.min(activePly, plies) / plies) * W : 0
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-4 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="4">
            <line x1="0" y1="2" x2="14" y2="2" stroke="#f0eee9" strokeWidth="2" />
          </svg>
          White engine
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="4">
            <line
              x1="0"
              y1="2"
              x2="14"
              y2="2"
              stroke="#a39f97"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
          </svg>
          Black engine
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="min-h-0 w-full flex-1 cursor-pointer rounded bg-bg"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const share = (e.clientX - box.left) / box.width
          onJump(Math.round(share * plies))
        }}
      >
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#3a3733" strokeWidth="0.5" />
        {paths.white && (
          <path
            d={paths.white}
            fill="none"
            stroke="#f0eee9"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {paths.black && (
          <path
            d={paths.black}
            fill="none"
            stroke="#a39f97"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <line
          x1={markerX}
          y1="0"
          x2={markerX}
          y2={H}
          stroke="#857f77"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
})
