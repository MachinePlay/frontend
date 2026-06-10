import { START_FEN, type Game, type LiveStreamEvent } from './api'

function freshGame(id: string, partial: Partial<Game>): Game {
  return {
    id,
    white_id: '',
    black_id: '',
    white_name: '',
    black_name: '',
    white_version: null,
    black_version: null,
    status: 'playing',
    result: null,
    moves: [],
    fen: START_FEN,
    pgn: null,
    white_clock: 0,
    black_clock: 0,
    created_at: new Date().toISOString(),
    ended_at: null,
    ...partial,
  }
}

function replaceAt(games: Game[], idx: number, game: Game): Game[] {
  const next = [...games]
  next[idx] = game
  return next
}

/** Merge one /stream/live event into the home page's game list. */
export function applyLiveEvent(
  games: Game[],
  { game_id, event }: LiveStreamEvent,
): Game[] {
  const idx = games.findIndex((g) => g.id === game_id)

  if (event.type === 'game_start') {
    const names = {
      white_name: event.white_name ?? games[idx]?.white_name ?? '',
      black_name: event.black_name ?? games[idx]?.black_name ?? '',
    }
    if (idx < 0) return [freshGame(game_id, names), ...games]
    return replaceAt(games, idx, {
      ...games[idx],
      ...names,
      status: 'playing',
      result: null,
      ended_at: null,
    })
  }

  if (event.type === 'fen') {
    const update: Partial<Game> = {
      white_name: event.white_name ?? games[idx]?.white_name ?? '',
      black_name: event.black_name ?? games[idx]?.black_name ?? '',
      fen: event.fen,
      moves: event.moves,
      status: event.status === 'ended' ? 'ended' : 'playing',
      result: event.result,
      white_clock: event.white_clock,
      black_clock: event.black_clock,
    }
    if (idx < 0) return [freshGame(game_id, update), ...games]
    return replaceAt(games, idx, { ...games[idx], ...update })
  }

  if (idx < 0) return games

  if (event.type === 'move') {
    return replaceAt(games, idx, {
      ...games[idx],
      fen: event.fen,
      moves: [...games[idx].moves, event.san],
      white_clock: event.white_clock,
      black_clock: event.black_clock,
    })
  }

  if (event.type === 'game_end') {
    return replaceAt(games, idx, {
      ...games[idx],
      status: 'ended',
      result: event.result,
      ended_at: new Date().toISOString(),
    })
  }

  return games
}
