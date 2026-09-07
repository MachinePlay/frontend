import { barFill, formatEvalShort, type Eval } from './eval'

/** One engine's opinion of the position, as a bar beside the board.

    Both bars read in White's frame — White's share fills from the bottom, or
    from the top when the board is flipped — so the two engines can be compared
    at a glance even though UCI scores come from each mover's own side. */
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
  const fill = barFill(value)
  const whiteAhead = fill >= 0.5
  // The readout sits at the winning end, which is White's end of the bar when
  // White is ahead — the same end the fill grows from.
  const atBoardBottom = whiteAhead !== flipped

  return (
    <div
      className="flex flex-col items-center gap-1 h-[var(--board-size)]"
      title={title}
    >
      <span
        className={`w-6 text-center text-[10px] leading-4 rounded-sm font-medium ${
          side === 'white'
            ? 'bg-neutral-200 text-neutral-900'
            : 'bg-neutral-950 text-neutral-300 border border-neutral-700'
        }`}
      >
        {side === 'white' ? 'W' : 'B'}
      </span>
      <div
        className={`relative flex-1 w-6 rounded-sm overflow-hidden bg-neutral-800 ${
          value ? '' : 'opacity-30'
        }`}
      >
        <div
          className="absolute inset-x-0 bg-neutral-100 transition-[height] duration-300"
          style={{ height: `${fill * 100}%`, [flipped ? 'top' : 'bottom']: 0 }}
        />
        <span
          className={`absolute inset-x-0 text-center text-[9px] leading-none font-mono tabular-nums ${
            whiteAhead ? 'text-neutral-600' : 'text-neutral-300'
          }`}
          style={{ [atBoardBottom ? 'bottom' : 'top']: '3px' }}
        >
          {formatEvalShort(value)}
        </span>
      </div>
    </div>
  )
}
