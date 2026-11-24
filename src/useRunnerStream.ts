import { useEffect, useState } from 'react'
import { runnerStreamUrl, type RunnerLive } from './api'

// runner_id -> latest live status, from the runners SSE feed.
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
