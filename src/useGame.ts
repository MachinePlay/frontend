import { useEffect, useState } from 'react'
import {
  fetchGame,
  gameStreamUrl,
  type GameStatus,
  type StreamEvent,
} from './api'

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
        setClocks(null)
        setStatus('playing')
      } else if (event.type === 'move') {
        setMoves((prev) => [...prev, event.san])
        setClocks({
          white: event.white_clock,
          black: event.black_clock,
          updatedAt: Date.now(),
        })
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
    result,
    reason,
    status,
    clocks,
  }
}
