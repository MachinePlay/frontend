// Time controls offered across the new-game and new-tournament forms
// ("base+inc" in seconds). Shared so both forms stay in sync.
export const TC_PRESETS = [
  { value: '10+0.1', label: '10s + 0.1' },
  { value: '30+0.3', label: '30s + 0.3' },
  { value: '60+1', label: '1m + 1' },
  { value: '180+2', label: '3m + 2' },
  { value: '300+3', label: '5m + 3' },
]

export const DEFAULT_TC = '30+0.3'

// Mirrors `estimate_game_seconds` in backend/app/tournaments.py. Duplicated
// because the new-tournament form needs the estimate before the tournament
// exists, while the tournament page reads the backend's own (which knows how
// many games are actually left).
const ETA_MOVES_PER_SIDE = 40
const ETA_STARTUP_SECONDS = 10

/** Roughly how long one game at this time control takes, wallclock. Engines at
    a fixed control spend most of their allowance, so a game costs about both
    sides' budget over ETA_MOVES_PER_SIDE moves, plus image pull/startup. */
export function estimateGameSeconds(tc: string): number {
  const [base, inc] = tc.split('+')
  return (
    2 * (Number(base) + ETA_MOVES_PER_SIDE * Number(inc ?? 0)) +
    ETA_STARTUP_SECONDS
  )
}

/** Wallclock for `games` games sharing `slots` runner slots. */
export function estimateTournamentSeconds(
  games: number,
  tc: string,
  slots: number,
): number | null {
  if (games <= 0 || slots <= 0) return null
  return (games * estimateGameSeconds(tc)) / slots
}
