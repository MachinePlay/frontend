import type { Game, Standing, TournamentParticipant } from './api'

// Standings computed on the client from the tournament's games, mirroring the
// backend. Deriving them here (rather than reading the server's snapshot) lets
// them update the instant a game_end arrives over SSE. Keyed by version id: a
// participant is an (engine, version) pair, so two versions of one engine stay
// on separate rows. W=1 / D=0.5 / L=0.
export function computeStandings(
  participants: TournamentParticipant[],
  games: Game[],
): Standing[] {
  const stat = new Map<string, { wins: number; draws: number; losses: number }>()
  for (const p of participants) {
    stat.set(p.version_id, { wins: 0, draws: 0, losses: 0 })
  }

  for (const g of games) {
    if (g.status !== 'ended') continue
    const w = g.white_version_id
    const b = g.black_version_id
    const sw = w ? stat.get(w) : undefined
    const sb = b ? stat.get(b) : undefined
    if (!sw || !sb) continue
    if (g.result === '1-0') {
      sw.wins++
      sb.losses++
    } else if (g.result === '0-1') {
      sb.wins++
      sw.losses++
    } else if (g.result === '1/2-1/2') {
      sw.draws++
      sb.draws++
    }
  }

  const rows: Standing[] = participants.map((p) => {
    const s = stat.get(p.version_id)!
    return {
      engine_id: p.engine_id,
      engine_name: p.engine_name,
      version_id: p.version_id,
      version: p.version,
      played: s.wins + s.draws + s.losses,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      score: s.wins + 0.5 * s.draws,
    }
  })
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.wins - a.wins ||
      a.engine_name.localeCompare(b.engine_name) ||
      a.version.localeCompare(b.version),
  )
  return rows
}
