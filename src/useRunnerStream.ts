import { useEffect, useState } from 'react'
import { runnerStreamUrl, type RunnerLive } from './api'

// Subscribes to the runners SSE feed and returns a map of runner_id -> latest
// live status (online flag + telemetry), updated in realtime. Mirrors the
// EventSource pattern used for the games live stream in Home.tsx. The map is
// keyed by id, so the initial snapshot and subsequent live events just overwrite.
export function useRunnerStream(): Map<string, RunnerLive> {
  const [live, setLive] = useState<Map<string, RunnerLive>>(new Map())

  useEffect(() => {
    const es = new EventSource(runnerStreamUrl())
    es.onmessage = (e) => {
      const event: RunnerLive = JSON.parse(e.data)
      setLive((prev) => {
        const next = new Map(prev)
        next.set(event.runner_id, event)
        return next
      })
    }
    return () => es.close()
  }, [])

  return live
}
