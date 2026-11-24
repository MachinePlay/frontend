import { Chess } from 'chess.js'
import type { SearchInfo } from './api'

export type Side = 'white' | 'black'

/** A score in White's frame (UCI's own is the mover's). Exactly one of `cp`
    and `mate` is set; `mate` is negative when Black mates. */
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

/** Unsigned, for the 24px eval bar, whose end already says who is better. */
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

/** White's share of an eval bar, 0–1, through the usual logistic squash. */
export function barFill(e: Eval | null): number {
  if (!e) return 0.5
  if (e.mate !== null) return e.mate < 0 ? 0 : 1
  return 1 / (1 + Math.exp(-0.00368208 * (e.cp ?? 0)))
}

/** The PV as SAN from `fen`, cut at the first illegal move (engines do report
    junk PVs). */
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

/** A search and its ply; the PV plays out from the board *before* that ply. */
export type SidedEval = { info: SearchInfo; ply: number }

/** Each engine's latest search at `ply`: White's evals are the even indices. */
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
