import { useEffect, useRef, useState } from 'react'
import {
  fetchGame,
  gameStreamUrl,
  type GameDetail,
  type GameStatus,
  type RatingChange,
  type SearchInfo,
  type StreamEvent,
  type UciLine,
} from './api'

/** The search in progress; `ply` reveals a stale one after a move. */
export type LiveSearch = {
  side: 'white' | 'black'
  ply: number
  info: SearchInfo
}

/** A stable key: the buffer slides, so an index would re-render every row. */
export type LoggedLine = UciLine & { seq: number }

/** Bounds a long game watched from the first move. */
const UCI_LIMIT = 2000

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

/** One game's live state: the initial fetch, then SSE updates while playing. */
export function useGame(id: string | undefined) {
  const [loadError, setLoadError] = useState<unknown>(null)
  // The fetch as it came: fields the stream never changes.
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting')
  const [whiteName, setWhiteName] = useState<string | null>(null)
  const [blackName, setBlackName] = useState<string | null>(null)
  // Fetch-only: stream events don't carry versions.
  const [whiteVersion, setWhiteVersion] = useState<string | null>(null)
  const [blackVersion, setBlackVersion] = useState<string | null>(null)
  const [tc, setTc] = useState<string | null>(null)
  // Fetch-only too: a game is rated after its end event.
  const [whiteRating, setWhiteRating] = useState<RatingChange | null>(null)
  const [blackRating, setBlackRating] = useState<RatingChange | null>(null)
  const [runnerId, setRunnerId] = useState<string | null>(null)
  const [bookPlies, setBookPlies] = useState(0)
  const [moves, setMoves] = useState<string[]>([])
  // Parallel to `moves`.
  const [evals, setEvals] = useState<(SearchInfo | null)[]>([])
  const [liveSearch, setLiveSearch] = useState<LiveSearch | null>(null)
  const [uciLines, setUciLines] = useState<LoggedLine[]>([])
  const nextSeq = useRef(0)
  const [result, setResult] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [status, setStatus] = useState<GameStatus | null>(null)
  const [clocks, setClocks] = useState<Clocks | null>(null)
  // When the stream reported the end: the page watched it happen.
  const [endedAt, setEndedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchGame(id)
      .then((g) => {
        if (cancelled) return
        setDetail(g)
        setWhiteName(g.white_name)
        setBlackName(g.black_name)
        setWhiteVersion(g.white_version)
        setBlackVersion(g.black_version)
        setTc(g.tc ?? null)
        setWhiteRating(g.white_rating ?? null)
        setBlackRating(g.black_rating ?? null)
        setRunnerId(g.runner_id ?? null)
        setBookPlies(g.book_plies ?? 0)
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
        if (!cancelled) setLoadError(e)
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
        setEndedAt(Date.now())
        es.close()
        setConnStatus('disconnected')
      }
    }
    return () => es.close()
  }, [id, status])

  return {
    loadError,
    detail,
    connStatus,
    whiteName,
    blackName,
    whiteVersion,
    blackVersion,
    whiteRating,
    blackRating,
    tc,
    runnerId,
    bookPlies,
    moves,
    evals,
    liveSearch,
    uciLines,
    result,
    reason,
    status,
    clocks,
    endedAt,
  }
}
