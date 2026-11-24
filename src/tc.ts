// "base+inc" in seconds, shared by the new-game and new-tournament forms.
export const TC_PRESETS = [
  { value: '10+0.1', label: '10s + 0.1' },
  { value: '30+0.3', label: '30s + 0.3' },
  { value: '60+1', label: '1m + 1' },
  { value: '180+2', label: '3m + 2' },
  { value: '300+3', label: '5m + 3' },
]

export const DEFAULT_TC = '30+0.3'

// Mirrors `estimate_game_seconds` in backend/app/tournaments.py, for the form
// that runs before the tournament exists.
const ETA_MOVES_PER_SIDE = 40
const ETA_STARTUP_SECONDS = 10

export function estimateGameSeconds(tc: string): number {
  const [base, inc] = tc.split('+')
  return (
    2 * (Number(base) + ETA_MOVES_PER_SIDE * Number(inc ?? 0)) +
    ETA_STARTUP_SECONDS
  )
}

export function estimateTournamentSeconds(
  games: number,
  tc: string,
  slots: number,
): number | null {
  if (games <= 0 || slots <= 0) return null
  return (games * estimateGameSeconds(tc)) / slots
}
