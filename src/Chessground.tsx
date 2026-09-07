import { useEffect, useRef } from 'react'
import { Chessground as NativeChessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'

type Props = {
  config?: Config
  className?: string
}

/** Chessground in a div. The board follows `config`, and `set` redraws on
    every new object, so callers must hand over a memoized one. */
export function Chessground({ config, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const apiRef = useRef<Api | null>(null)

  useEffect(() => {
    if (!ref.current) return
    apiRef.current = NativeChessground(ref.current, config)
    return () => apiRef.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    apiRef.current?.set(config ?? {})
  }, [config])

  return (
    <div
      ref={ref}
      className={className ? `cg-wrap ${className}` : 'cg-wrap'}
    />
  )
}
