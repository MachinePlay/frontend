import { useMemo, useState } from 'react'
import type { Key } from '@lichess-org/chessground/types'
import { Chess } from 'chess.js'

/** A board after some number of plies, plus the squares the last move joined. */
export type Position = { fen: string; from?: Key; to?: Key }

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

type Cache = { moves: string[]; positions: Position[]; chess: Chess }

const freshCache = (): Cache => ({
  moves: [],
  positions: [{ fen: START_FEN }],
  chess: new Chess(),
})

/** `positions[ply]`, index 0 being the start. Extended in place as moves
    arrive: a full replay costs ~50ms by 400 plies. */
export function usePositions(moves: string[]): Position[] {
  const [cache] = useState(freshCache)

  return useMemo(() => {
    const reusable =
      moves.length >= cache.moves.length &&
      cache.moves.every((m, i) => m === moves[i])
    if (!reusable) Object.assign(cache, freshCache())

    for (let i = cache.moves.length; i < moves.length; i++) {
      let move
      try {
        move = cache.chess.move(moves[i])
      } catch {
        break // illegal SAN: stop extending, callers clamp to what we have
      }
      cache.moves.push(moves[i])
      cache.positions.push({
        fen: cache.chess.fen(),
        from: move.from,
        to: move.to,
      })
    }
    return cache.positions
  }, [moves, cache])
}
