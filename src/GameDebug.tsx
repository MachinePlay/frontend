import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { LoggedLine } from './useGame'

/** How many lines the view renders before asking. The buffer holds thousands;
    mounting all of them is what made opening this tab stutter, and every
    arriving batch then re-rendered the lot. */
const WINDOW = 400

type Filters = { white: boolean; black: boolean; sent: boolean; info: boolean }

const ALL: Filters = { white: true, black: true, sent: true, info: true }

/** `info string` is where an engine prints its own debug messages, so it counts
    as engine output rather than search chatter and stays when `info` is off. */
const isSearchInfo = (text: string): boolean =>
  text.startsWith('info') && !text.startsWith('info string')

function keep(line: LoggedLine, f: Filters): boolean {
  if (!(line.side === 'white' ? f.white : f.black)) return false
  if (!f.sent && line.sent) return false
  if (!f.info && isSearchInfo(line.text)) return false
  return true
}

const lineColor = (line: LoggedLine): string => {
  if (line.sent) return 'text-neutral-500'
  if (line.text.startsWith('bestmove')) return 'text-green-400'
  if (line.text.startsWith('info string')) return 'text-amber-500/80'
  if (line.text.startsWith('info')) return 'text-neutral-400'
  return 'text-neutral-300'
}

/** One transcript line: a prefix saying who spoke and which way, then what was
    said. Memoized on the line object, which never changes once it has arrived,
    so a new batch only mounts its own rows. Plain inline flow rather than a
    flex row — hundreds of these are on screen and each layout box is paid for.
    */
const LogRow = memo(function LogRow({ line }: { line: LoggedLine }) {
  return (
    <div className="whitespace-pre">
      <span
        className={
          line.side === 'white' ? 'text-neutral-200' : 'text-neutral-500'
        }
        title={`${line.side} engine, ply ${line.ply}`}
      >
        {line.side === 'white' ? 'W' : 'B'}
        {line.sent ? '→ ' : '← '}
      </span>
      <span className={lineColor(line)}>{line.text}</span>
    </div>
  )
})

function Toggle({
  label,
  title,
  checked,
  onChange,
}: {
  label: string
  title: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      title={title}
      className="flex items-center gap-1 cursor-pointer select-none hover:text-neutral-300"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3 h-3 accent-neutral-400"
      />
      {label}
    </label>
  )
}

/** The "debug" tab: the UCI conversation, as fastchess logged it.

    Search chatter is thinned on the runner (one `info` line per depth, and no
    two in the same breath) and capped per search, so an engine that prints per
    node stays readable. While a game is live this is the whole conversation;
    afterwards only its tail survives on the game. */
export function GameDebug({
  lines,
  live,
}: {
  lines: LoggedLine[]
  live: boolean
}) {
  const [filters, setFilters] = useState<Filters>(ALL)
  const [showAll, setShowAll] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)

  const matching = useMemo(
    () => lines.filter((line) => keep(line, filters)),
    [lines, filters],
  )
  const hidden = showAll ? 0 : Math.max(0, matching.length - WINDOW)
  const shown = hidden ? matching.slice(-WINDOW) : matching

  // Follow the tail, but only while the reader hasn't scrolled up to read
  // something older. Keyed on the last line rather than the count, which stops
  // moving once the window is full.
  const lastSeq = shown.at(-1)?.seq
  useEffect(() => {
    const box = boxRef.current
    if (box && pinned.current) box.scrollTop = box.scrollHeight
  }, [lastSeq])

  const set = (key: keyof Filters) => (value: boolean) =>
    setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-neutral-800 text-[10px] text-neutral-500">
        <Toggle
          label="W"
          title="white engine"
          checked={filters.white}
          onChange={set('white')}
        />
        <Toggle
          label="B"
          title="black engine"
          checked={filters.black}
          onChange={set('black')}
        />
        <Toggle
          label="sent"
          title="commands sent to the engines"
          checked={filters.sent}
          onChange={set('sent')}
        />
        <Toggle
          label="info"
          title="search info lines (info string always shows)"
          checked={filters.info}
          onChange={set('info')}
        />
        <span className="ml-auto tabular-nums">{matching.length}</span>
      </div>
      <div
        ref={boxRef}
        onScroll={(e) => {
          const box = e.currentTarget
          pinned.current =
            box.scrollHeight - box.scrollTop - box.clientHeight < 24
        }}
        className="flex-1 min-h-0 overflow-auto px-2 py-1 font-mono text-[10px] leading-relaxed"
      >
        {shown.length === 0 ? (
          <p className="text-neutral-600 italic">
            {lines.length > 0
              ? 'nothing matches those filters'
              : live
                ? 'waiting for the engines to say something…'
                : 'no transcript kept for this game'}
          </p>
        ) : (
          <>
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mb-1 text-neutral-500 hover:text-neutral-300 underline decoration-dotted"
              >
                show {hidden} earlier lines
              </button>
            )}
            {shown.map((line) => (
              <LogRow key={line.seq} line={line} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
