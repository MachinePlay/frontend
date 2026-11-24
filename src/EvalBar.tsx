import { barFill, type Eval } from './eval'
import { SideChip } from './ui'

/** One engine's eval beside the board. Both bars read in White's frame, so the
    engines compare at a glance. */
export function EvalBar({
  side,
  title,
  value,
  flipped,
}: {
  side: 'white' | 'black'
  title: string
  value: Eval | null
  flipped: boolean
}) {
  return (
    <div
      className="flex h-[var(--board-size)] flex-col items-center gap-1"
      title={title}
    >
      <SideChip side={side} />
      <div
        className={`relative w-3.5 flex-1 overflow-hidden rounded-sm bg-track ${
          value ? '' : 'opacity-40'
        }`}
      >
        <div
          className="absolute inset-x-0 bg-fg transition-[height] duration-300"
          style={{
            height: `${barFill(value) * 100}%`,
            [flipped ? 'top' : 'bottom']: 0,
          }}
        />
      </div>
    </div>
  )
}
