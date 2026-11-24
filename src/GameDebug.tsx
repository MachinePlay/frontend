import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { LoggedLine } from './useGame'

/** Lines rendered before asking; mounting the whole buffer stutters. */
const WINDOW = 400

type Filters = { white: boolean; black: boolean; sent: boolean; info: boolean }

const ALL: Filters = { white: true, black: true, sent: true, info: true }

/** `info string` is the engine's own debug output, not search chatter. */
const isSearchInfo = (text: string): boolean =>
  text.startsWith('info') && !text.startsWith('info string')

function keep(line: LoggedLine, f: Filters): boolean {
  if (!(line.side === 'white' ? f.white : f.black)) return false
  if (!f.sent && line.sent) return false
  if (!f.info && isSearchInfo(line.text)) return false
  return true
}

const lineColor = (line: LoggedLine): string => {
  if (line.sent) return 'text-faint'
  if (line.text.startsWith('bestmove')) return 'text-fg font-medium'
  if (line.text.startsWith('info string')) return 'text-muted italic'
  if (line.text.startsWith('info')) return 'text-muted'
  return 'text-fg'
}

/** Memoized, so a batch mounts only its own rows; inline flow, not flex, since
    hundreds are on screen. */
const LogRow = memo(function LogRow({ line }: { line: LoggedLine }) {
  return (
    <div className="whitespace-pre">
      <span
        className={
          line.side === 'white' ? 'text-fg' : 'text-faint'
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
      className="flex items-center gap-1 cursor-pointer select-none hover:text-fg"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3 h-3 accent-[#a39f97]"
      />
      {label}
    </label>
  )
}

/** The "debug" tab: the UCI conversation as fastchess logged it, thinned by
    the runner. A finished game keeps only the tail. */
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

  // Follow the tail unless scrolled up. Keyed on the last line: the count
  // stops moving once the window is full.
  const lastSeq = shown.at(-1)?.seq
  useEffect(() => {
    const box = boxRef.current
    if (box && pinned.current) box.scrollTop = box.scrollHeight
  }, [lastSeq])

  const set = (key: keyof Filters) => (value: boolean) =>
    setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-line text-xs text-faint">
        <Toggle
          label="W"
          title="White engine"
          checked={filters.white}
          onChange={set('white')}
        />
        <Toggle
          label="B"
          title="Black engine"
          checked={filters.black}
          onChange={set('black')}
        />
        <Toggle
          label="sent"
          title="Commands sent to the engines"
          checked={filters.sent}
          onChange={set('sent')}
        />
        <Toggle
          label="info"
          title="Search info lines (info string always shows)"
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
        className="flex-1 min-h-0 overflow-auto px-3 py-1.5 font-mono text-[11px] leading-relaxed"
      >
        {shown.length === 0 ? (
          <p className="font-sans text-xs text-faint">
            {lines.length > 0
              ? 'Nothing matches those filters'
              : live
                ? 'Waiting for the engines to say something…'
                : 'No transcript kept for this game'}
          </p>
        ) : (
          <>
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mb-1 text-faint hover:text-fg underline decoration-dotted"
              >
                Show {hidden} earlier lines
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
