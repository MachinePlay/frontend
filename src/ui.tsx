import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { ApiError, isUnreachable, type Rating, type RatingCategory } from './api'
import { RATING_CATEGORIES, formatDelta, formatRating } from './format'
import { type Outcome } from './games'
import { button, deltaTone, field, page } from './styles'
import { useCopy } from './useCopy'

export function Page({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <main className={`${page} ${className}`}>{children}</main>
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-title font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {children && (
        <div className="ml-auto flex items-center gap-3">{children}</div>
      )}
    </div>
  )
}

export function SectionHeader({
  title,
  count,
  children,
}: {
  title: ReactNode
  count?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 className="text-section font-semibold">
        {title}
        {count !== undefined && (
          <span className="font-normal text-faint"> {count}</span>
        )}
      </h2>
      {children && (
        <div className="ml-auto flex items-center gap-4 text-sm text-muted">
          {children}
        </div>
      )}
    </div>
  )
}

/** Muted one-liner for loading and empty states. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-faint">{children}</p>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-meta text-loss">{children}</p>
}

/** "We couldn't load this": unlike NotFound, no trustworthy answer came back. */
export function LoadError({
  what,
  error,
  onRetry,
}: {
  what: string
  error: unknown
  onRetry?: () => void
}) {
  const status = error instanceof ApiError ? error.status : null
  const detail = isUnreachable(error)
    ? 'The API is unreachable — the backend is probably down.'
    : status !== null
      ? `The API answered ${status}.`
      : 'Something went wrong.'
  return (
    <Page className="items-center">
      <div className="mt-16 flex w-full max-w-[480px] flex-col items-center gap-3 rounded-lg border border-line p-6 text-center">
        <p className="text-section font-semibold">Couldn't load {what}</p>
        <p className="text-sm text-muted">{detail}</p>
        {error instanceof Error && !isUnreachable(error) && (
          <p className="num text-xs text-faint">{error.message}</p>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className={button.small}>
            Try again
          </button>
        )}
      </div>
    </Page>
  )
}

export function Loading() {
  return (
    <Page>
      <Hint>Loading…</Hint>
    </Page>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 gap-0.5 rounded border border-line p-0.5 text-meta"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-[3px] px-3 py-1 transition-colors ${
            o.value === value ? 'bg-line text-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-[34px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-fg' : 'bg-line-strong'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-[left] ${
          checked ? 'left-4' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-xs font-semibold peer-focus-visible:outline peer-focus-visible:outline-muted ${
          checked ? 'border-fg bg-fg text-bg' : 'border-line-strong'
        }`}
      >
        {checked && '✓'}
      </span>
      {children}
    </label>
  )
}

/** A native select drawn like the text inputs. */
export function Select({
  className = '',
  leading,
  ...rest
}: ComponentProps<'select'> & { leading?: ReactNode }) {
  return (
    <span className={`relative inline-flex min-w-0 ${className}`}>
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          {leading}
        </span>
      )}
      <select
        {...rest}
        className={`${field} w-full min-w-0 cursor-pointer appearance-none pr-7 ${leading ? 'pl-6' : ''}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11.5px] text-faint">
        ▼
      </span>
    </span>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" className="flex border-b border-line px-2 text-meta">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={`-mb-px border-b-2 px-2.5 py-2.5 transition-colors ${
            t.value === value
              ? 'border-fg text-fg'
              : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Static: the accent alone says "now". */
export function LiveDot() {
  return (
    <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
  )
}

export function StatusDot({
  online,
  size = 8,
}: {
  online: boolean
  size?: number
}) {
  return (
    <span
      aria-label={online ? 'online' : 'offline'}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 rounded-full ${online ? 'bg-win' : 'bg-[#4a4640]'}`}
    />
  )
}

export function TagPills({
  tags,
  small = false,
}: {
  tags: string[]
  small?: boolean
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`rounded-full border border-line text-muted ${
            small ? 'px-2 py-px text-[11.5px]' : 'px-2.5 py-0.5 text-xs'
          }`}
        >
          {tag}
        </span>
      ))}
    </span>
  )
}

export function RatingChip({
  category,
  rating,
}: {
  category: RatingCategory
  rating: Rating
}) {
  return (
    <span
      title={`${rating.games} rated ${rating.games === 1 ? 'game' : 'games'}`}
      className="inline-flex items-baseline gap-[5px] rounded border border-line bg-surface px-[7px] py-0.5 text-xs"
    >
      <span className="text-faint">{category}</span>
      <span className="num">{formatRating(rating)}</span>
      <span className="num text-faint">±{Math.round(rating.phi)}</span>
    </span>
  )
}

/** One chip per category the version has rated games in. */
export function RatingChips({
  ratings,
}: {
  ratings: { [key in RatingCategory]?: Rating }
}) {
  const rated = RATING_CATEGORIES.filter((c) => ratings[c])
  if (rated.length === 0) return <span className="text-xs text-faint">Unrated</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {rated.map((c) => (
        <RatingChip key={c} category={c} rating={ratings[c]!} />
      ))}
    </span>
  )
}

export function RatingDelta({
  delta,
  className = '',
}: {
  delta: number
  className?: string
}) {
  return (
    <span className={`tabular-nums ${deltaTone(delta)} ${className}`}>
      {formatDelta(delta)}
    </span>
  )
}

const OUTCOME_STYLE: Record<Outcome, string> = {
  W: 'bg-win/16 text-win',
  D: 'bg-line text-muted',
  L: 'bg-loss/16 text-loss',
  live: 'bg-accent/18 text-accent',
}

export function ResultBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className={`num flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-xs font-semibold ${OUTCOME_STYLE[outcome]}`}
    >
      {outcome === 'live' ? '•' : outcome}
    </span>
  )
}

/** The small square that says which colour a player has. */
export function ColorChip({ color }: { color: 'white' | 'black' }) {
  return (
    <span
      aria-label={color}
      className={`h-2.5 w-2.5 shrink-0 rounded-[2px] border border-faint ${
        color === 'white' ? 'bg-[#f5f5f5]' : 'bg-[#141414]'
      }`}
    />
  )
}

/** "W"/"B" label for an engine's eval bar and search. */
export function SideChip({
  side,
  wide = false,
}: {
  side: 'white' | 'black'
  wide?: boolean
}) {
  return (
    <span
      className={`shrink-0 rounded-[2px] border border-line-strong text-center text-[10px] font-medium leading-4 ${
        wide ? 'w-4' : 'w-3.5'
      } ${side === 'white' ? 'bg-[#e5e5e5] text-[#171717]' : 'bg-bg text-[#d4d4d4]'}`}
    >
      {side === 'white' ? 'W' : 'B'}
    </span>
  )
}

/** A thin single-fill bar, for list rows. */
export function ThinProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="h-[3px] min-w-8 flex-1 overflow-hidden rounded-sm bg-track">
        <div
          className="h-full bg-muted"
          style={{ width: `${total ? (100 * done) / total : 0}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs tabular-nums text-faint">
        {done}/{total}
      </span>
    </div>
  )
}

/** A labelled 0–100% bar; `detail` replaces the "NN%" readout. */
export function Meter({
  label,
  percent,
  detail,
  accent = false,
  large = false,
}: {
  label: string
  percent: number
  detail?: string
  accent?: boolean
  large?: boolean
}) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${large ? 'gap-2' : 'gap-1.5'}`}>
      <div className={`flex justify-between gap-2 ${large ? 'text-meta' : 'text-xs'}`}>
        <span className="text-faint">{label}</span>
        <span className="num truncate">{detail ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className={`overflow-hidden rounded-full bg-track ${large ? 'h-1.5' : 'h-1'}`}>
        <div
          className={`h-full transition-[width] duration-500 ${accent ? 'bg-accent' : 'bg-muted'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** A destructive action in two clicks. Failures render beside the button, so
    the user reads the backend's refusal. */
export function ConfirmButton({
  label,
  confirmLabel,
  busyLabel,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  busyLabel: string
  onConfirm: () => Promise<unknown>
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-loss">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => (armed ? void run() : setArmed(true))}
        className={armed ? button.danger : button.small}
      >
        {busy ? busyLabel : armed ? confirmLabel : label}
      </button>
    </span>
  )
}

/** ConfirmButton's heavier sibling: a bordered row whose "Delete…" opens a
    confirmation gated on typing `phrase` back. */
export function DangerZone({
  title,
  summary,
  phrase,
  label,
  busyLabel,
  onConfirm,
  children,
}: {
  title: string
  summary: string
  phrase: string
  label: string
  busyLabel: string
  onConfirm: () => Promise<unknown>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const armed = typed.trim().toLowerCase() === phrase.toLowerCase()

  const close = () => {
    setOpen(false)
    setTyped('')
    setError(null)
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      // Left busy: callers navigate away from what they deleted.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{title}</span>
          <span className="text-xs text-faint">{summary}</span>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${button.small} ml-auto !text-loss`}
          >
            Delete…
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          {children}
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={phrase}
              aria-label={`Type ${phrase} to confirm`}
              className={`${field} font-mono`}
            />
            <button
              type="button"
              disabled={!armed || busy}
              onClick={() => void run()}
              className={button.danger}
            >
              {busy ? busyLabel : label}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className={button.small}
            >
              Cancel
            </button>
            {!armed && (
              <span className="text-xs text-faint">
                Type <span className="font-mono">{phrase}</span> to enable
              </span>
            )}
          </div>
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      )}
    </div>
  )
}

const iconButtonClass =
  'inline-flex shrink-0 items-center justify-center rounded p-1 text-faint hover:text-fg hover:bg-surface-2 transition-colors disabled:opacity-40'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-3.5 w-3.5',
} as const

const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z" />
  </svg>
)

const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="m5 13 4 4L19 7" />
  </svg>
)

const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

/** Edit-in-place for one field. `children` is the inline display, `value` the
    raw string. Enter saves (⌘/Ctrl+Enter when `multiline`), Escape cancels. */
export function InlineEdit({
  value,
  onSave,
  label,
  editable = false,
  multiline = false,
  placeholder,
  hint,
  inputClass = '',
  children,
}: {
  value: string
  onSave: (next: string) => Promise<unknown>
  label: string
  editable?: boolean
  multiline?: boolean
  placeholder?: string
  hint?: string
  inputClass?: string
  children: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    if (draft === value) return cancel()
    setBusy(true)
    try {
      await onSave(draft)
      setEditing(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') cancel()
    else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void save()
    }
  }

  if (!editable) return <>{children}</>

  if (!editing) {
    return (
      <span
        className={`inline-flex gap-1 ${multiline ? 'items-start' : 'items-center'}`}
      >
        {children}
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => {
            setDraft(value)
            setError(null)
            setEditing(true)
          }}
          className={iconButtonClass}
        >
          <PencilIcon />
        </button>
      </span>
    )
  }

  // Not disabled while saving: that would blur it, stranding a rejected save.
  const input = multiline ? (
    <textarea
      autoFocus
      rows={3}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${field} h-auto w-full resize-y py-2 text-sm font-normal ${inputClass}`}
    />
  ) : (
    <input
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${field} text-sm font-normal ${inputClass}`}
    />
  )

  const actions = (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label="Save"
        title="Save"
        disabled={busy}
        onClick={() => void save()}
        className={`${iconButtonClass} hover:text-win`}
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        aria-label="Cancel"
        title="Cancel"
        disabled={busy}
        onClick={cancel}
        className={`${iconButtonClass} hover:text-loss`}
      >
        <CloseIcon />
      </button>
      {error ? (
        <span className="text-xs font-normal text-loss">{error}</span>
      ) : (
        hint && <span className="text-xs font-normal text-faint">{hint}</span>
      )}
    </span>
  )

  return multiline ? (
    <span className="flex w-full max-w-xl flex-col items-start gap-1">
      {input}
      {actions}
    </span>
  ) : (
    <span className="inline-flex flex-wrap items-center gap-1">
      {input}
      {actions}
    </span>
  )
}

/** A shell command with a prompt and a Copy button. */
export function CommandLine({ command }: { command: string }) {
  const [copied, copy] = useCopy()
  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span className="text-faint">$</span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre">{command}</code>
      <button
        type="button"
        onClick={() => void copy(command)}
        className="font-sans text-xs text-muted transition-colors hover:text-fg"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/** A freshly minted API token: shown once, with a copy button. */
export function FreshToken({ token }: { token: string }) {
  const [copied, copy] = useCopy()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <code className="num min-w-0 flex-1 break-all rounded border border-line-strong bg-bg px-3.5 py-2.5 text-sm">
          {token}
        </code>
        <button
          type="button"
          onClick={() => void copy(token)}
          className={`${button.primary} h-auto min-h-[42px] px-4`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-meta text-accent">
        Copy it now — it won't be shown again.
      </p>
    </div>
  )
}

/** A native modal dialog: Escape and a backdrop click close it. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[560px] rounded-lg border border-line bg-bg p-0 text-fg backdrop:bg-black/60"
    >
      {open && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-center">
            <h2 className="text-section font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`${iconButtonClass} ml-auto`}
            >
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
