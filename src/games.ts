import type { Engine, Game, Rating, RatingCategory } from './api'
import { RATING_CATEGORIES, capitalize, formatResult, relativeTime } from './format'

export type Outcome = 'W' | 'D' | 'L' | 'live'

/** How `engineId` fared in `game`; null for an aborted or unfinished one. */
export function outcomeFor(
  game: Pick<Game, 'white_id' | 'black_id' | 'status' | 'result'>,
  engineId: string,
): Outcome | null {
  if (game.status === 'playing') return 'live'
  if (game.status !== 'ended') return null
  if (game.result === '1/2-1/2') return 'D'
  const won =
    (game.result === '1-0' && game.white_id === engineId) ||
    (game.result === '0-1' && game.black_id === engineId)
  const lost =
    (game.result === '0-1' && game.white_id === engineId) ||
    (game.result === '1-0' && game.black_id === engineId)
  return won ? 'W' : lost ? 'L' : null
}

/** "Checkmate · 4m ago" for a list row. */
export function finishedMeta(
  game: Pick<Game, 'reason' | 'created_at' | 'ended_at'>,
): string {
  const ago = relativeTime(game.ended_at ?? game.created_at)
  return game.reason ? `${capitalize(game.reason)} · ${ago}` : capitalize(ago)
}

export const resultText = (game: Pick<Game, 'status' | 'result'>): string =>
  game.status === 'ended' ? formatResult(game.result) : ''

export const moveNumber = (plies: number): number =>
  Math.max(1, Math.ceil(plies / 2))

/** The best-rated category, for showing one rating where there's room for one. */
export function primaryRating(ratings: {
  [key in RatingCategory]?: Rating
}): [RatingCategory, Rating] | null {
  let best: [RatingCategory, Rating] | null = null
  for (const [cat, r] of Object.entries(ratings) as [RatingCategory, Rating][]) {
    if (!best || r.games > best[1].games) best = [cat, r]
  }
  return best
}

/** Rated engines in `category`, best first. */
export function leaderboard(engines: Engine[], category: RatingCategory): Engine[] {
  return engines
    .filter((e) => e.ratings?.[category])
    .sort((a, b) => b.ratings![category]!.mu - a.ratings![category]!.mu)
}

/** The category most engines are rated in. */
export function busiestCategory(engines: Engine[]): RatingCategory {
  const rated = (c: RatingCategory) => engines.filter((e) => e.ratings?.[c]).length
  return [...RATING_CATEGORIES].sort((a, b) => rated(b) - rated(a))[0]
}
