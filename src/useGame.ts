import { useEffect, useRef, useState } from 'react'
import {
  fetchGame,
  gameStreamUrl,
  type GameStatus,
  type SearchInfo,
  type StreamEvent,
  type UciLine,
} from './api'

/** The search an engine is running right now, as it last reported it. Only one
    engine thinks at a time, so a single slot holds it; `ply` says which
    position it is about, which is how a stale one is spotted after a move. */
export type LiveSearch = {
  side: 'white' | 'black'
  ply: number
  info: SearchInfo
}

/** A transcript line with a stable identity. The buffer slides once it is
    full, so a line's index is not its own — and a key that moves re-renders
    every row under it on each batch. */
export type LoggedLine = UciLine & { seq: number }

/** How much of the UCI conversation the page keeps. The backend already caps
    what it replays; this bounds a long game watched from the first move. */
const UCI_LIMIT = 2000

/** Number the lines of one batch, continuing from the counter. */
function tag(
  lines: UciLine[],
  counter: { current: number },
): LoggedLine[] {
  const start = counter.current
  counter.current += lines.length
  return lines.map((line, i) => ({ ...line, seq: start + i }))
}

export type Clocks = { white: number; black: number; updatedAt: number }

export type ConnStatus = 'connecting' | 'connected' | 'error' | 'disconnected'

/** One game's live state: the initial fetch, then SSE updates while playing.

    Static facts (names, versions, tc, runner) come from the fetch; the stream
    keeps moves/clocks/result fresh and delivers the terminal status + reason. */
export function useGame(id: string | undefined) {
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting')
  const [whiteName, setWhiteName] = useState<string | null>(null)
  const [blackName, setBlackName] = useState<string | null>(null)
  // Which uploaded version each side plays; from the initial fetch only
  // (stream events don't carry it, and it never changes mid-game).
  const [whiteVersion, setWhiteVersion] = useState<string | null>(null)
  const [blackVersion, setBlackVersion] = useState<string | null>(null)
  const [tc, setTc] = useState<string | null>(null)
  const [runnerId, setRunnerId] = useState<string | null>(null)
  const [moves, setMoves] = useState<string[]>([])
  // Parallel to `moves`: what each mover's search reported. The live search and
  // the UCI transcript are stream-only; a finished game keeps the tail of the
  // transcript on its doc.
  const [evals, setEvals] = useState<(SearchInfo | null)[]>([])
  const [liveSearch, setLiveSearch] = useState<LiveSearch | null>(null)
  const [uciLines, setUciLines] = useState<LoggedLine[]>([])
  const nextSeq = useRef(0)
  const [result, setResult] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [status, setStatus] = useState<GameStatus | null>(null)
  const [clocks, setClocks] = useState<Clocks | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchGame(id)
      .then((g) => {
        if (cancelled) return
        setWhiteName(g.white_name)
        setBlackName(g.black_name)
        setWhiteVersion(g.white_version)
        setBlackVersion(g.black_version)
        setTc(g.tc ?? null)
        setRunnerId(g.runner_id ?? null)
        setMoves(g.moves)
        setEvals(g.evals ?? [])
        setUciLines(tag(g.uci_tail ?? [], nextSeq))
        setResult(g.result)
        setReason(g.reason ?? null)
        setStatus(g.status)
        setClocks({
          white: g.white_clock,
          black: g.black_clock,
          updatedAt: Date.now(),
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    if (status !== 'playing') return
    const es = new EventSource(gameStreamUrl(id))
    es.onopen = () => setConnStatus('connected')
    es.onerror = () =>
      setConnStatus(
        es.readyState === EventSource.CLOSED ? 'disconnected' : 'error',
      )
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)

      if (event.type === 'fen') {
        setWhiteName(event.white_name)
        setBlackName(event.black_name)
        setMoves(event.moves ?? [])
        setEvals(event.evals ?? [])
        setResult(event.result)
        setClocks({
          white: event.white_clock,
          black: event.black_clock,
          updatedAt: Date.now(),
        })
        setStatus(event.status)
      } else if (event.type === 'game_start') {
        setResult(null)
        setReason(null)
        setWhiteName(event.white_name)
        setBlackName(event.black_name)
        setMoves([])
        setEvals([])
        setUciLines([])
        nextSeq.current = 0
        setLiveSearch(null)
        setClocks(null)
        setStatus('playing')
      } else if (event.type === 'move') {
        setMoves((prev) => [...prev, event.san])
        setEvals((prev) => [...prev, event.analysis ?? null])
        setClocks({
          white: event.white_clock,
          black: event.black_clock,
          updatedAt: Date.now(),
        })
      } else if (event.type === 'engine_info') {
        setLiveSearch({ side: event.side, ply: event.ply, info: event.info })
      } else if (event.type === 'uci_log') {
        const batch = tag(event.lines, nextSeq)
        setUciLines((prev) => [...prev, ...batch].slice(-UCI_LIMIT))
      } else if (event.type === 'game_end') {
        setResult(event.result)
        setReason(event.reason ?? null)
        setStatus(event.status ?? 'ended')
        es.close()
        setConnStatus('disconnected')
      }
    }
    return () => es.close()
  }, [id, status])

  return {
    loadError,
    connStatus,
    whiteName,
    blackName,
    whiteVersion,
    blackVersion,
    tc,
    runnerId,
    moves,
    evals,
    liveSearch,
    uciLines,
    result,
    reason,
    status,
    clocks,
  }
}
