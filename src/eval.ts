import { Chess } from 'chess.js'
import type { SearchInfo } from './api'

export type Side = 'white' | 'black'

/** A score in White's frame: UCI reports from the searching side's point of
    view, so Black's numbers are negated on the way in. Exactly one of `cp`
    (centipawns) and `mate` (moves to mate, negative when Black mates) is set. */
export type Eval = { cp: number | null; mate: number | null }

export function toWhite(
  info: SearchInfo | null | undefined,
  side: Side,
): Eval | null {
  if (!info) return null
  const sign = side === 'white' ? 1 : -1
  if (info.score_mate != null) return { cp: null, mate: sign * info.score_mate }
  if (info.score_cp != null) return { cp: sign * info.score_cp, mate: null }
  return null
}

/** The same score with no sign, for the eval bar — which end of the bar the
    number sits at already says who is better, and the bar is 24px wide. */
export function formatEvalShort(e: Eval | null): string {
  if (!e) return '·'
  if (e.mate !== null) return `M${Math.abs(e.mate)}`
  return (Math.abs(e.cp ?? 0) / 100).toFixed(1)
}

export function formatEval(e: Eval | null): string {
  if (!e) return '—'
  if (e.mate !== null) return `${e.mate < 0 ? '-' : ''}M${Math.abs(e.mate)}`
  const pawns = (e.cp ?? 0) / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`
}

/** How much of an eval bar belongs to White, 0–1.

    Centipawns are unbounded but the interesting range is small, so they go
    through the usual logistic squash: ±1 pawn already moves the bar visibly,
    ±10 pawns pins it. An unknown score sits at the halfway mark. */
export function barFill(e: Eval | null): number {
  if (!e) return 0.5
  if (e.mate !== null) return e.mate < 0 ? 0 : 1
  return 1 / (1 + Math.exp(-0.00368208 * (e.cp ?? 0)))
}

/** The principal variation as SAN, played out from `fen`. Stops at the first
    move that doesn't fit the position — engines do report junk PVs, and one
    bad move shouldn't cost the whole line. */
export function pvSan(fen: string, pv: string[]): string[] {
  const chess = new Chess(fen)
  const san: string[] = []
  for (const uci of pv) {
    try {
      san.push(chess.move(uci).san)
    } catch {
      break
    }
  }
  return san
}

/** One engine's search, and the ply it was about — the position it searched is
    the board *before* that move, which is what its PV plays out from. */
export type SidedEval = { info: SearchInfo; ply: number }

/** Each engine's most recent search at `ply`, from the per-move evals.

    `evals[i]` is what the mover reported for `moves[i]`, so White's are the
    even indices and Black's the odd ones. */
export function evalsAt(
  evals: (SearchInfo | null)[],
  ply: number,
): { white: SidedEval | null; black: SidedEval | null } {
  const latest = (parity: number): SidedEval | null => {
    for (let i = Math.min(ply, evals.length) - 1; i >= 0; i--) {
      const info = evals[i]
      if (i % 2 === parity && info) return { info, ply: i }
    }
    return null
  }
  return { white: latest(0), black: latest(1) }
}
