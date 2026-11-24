import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { engineUrl, fetchEngines, type Engine, type RatingCategory } from '../api'
import {
  RATING_CATEGORIES,
  capitalize,
  formatRating,
  relativeTime,
} from '../format'
import { busiestCategory } from '../games'
import { button, field, row, tableHead } from '../styles'
import { Hint, Page, PageHeader, Segmented, Select, TagPills } from '../ui'

type Sort = 'rating' | 'newest' | 'games'

const SORTS = [
  { value: 'rating', label: 'Rating' },
  { value: 'newest', label: 'Newest' },
  { value: 'games', label: 'Most games' },
] as const

const TOP_TAGS = 5

const grid =
  'grid grid-cols-[28px_minmax(0,1fr)_96px] gap-3 sm:grid-cols-[36px_minmax(0,1.6fr)_minmax(0,1fr)_110px_70px_70px_90px]'

function sortEngines(engines: Engine[], sort: Sort, cat: RatingCategory): Engine[] {
  const byName = (a: Engine, b: Engine) =>
    `${a.owner_login}/${a.name}`.localeCompare(`${b.owner_login}/${b.name}`)
  return [...engines].sort((a, b) => {
    if (sort === 'newest') return b.created_at.localeCompare(a.created_at)
    if (sort === 'games') {
      return (b.games_played ?? 0) - (a.games_played ?? 0) || byName(a, b)
    }
    const ra = a.ratings?.[cat]?.mu ?? -Infinity
    const rb = b.ratings?.[cat]?.mu ?? -Infinity
    return rb - ra || byName(a, b)
  })
}

function matches(e: Engine, query: string, tag: string | null): boolean {
  if (tag && !e.tags.includes(tag)) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    e.name.includes(q) ||
    e.owner_login.toLowerCase().includes(q) ||
    e.tags.some((t) => t.includes(q))
  )
}

function topTags(engines: Engine[]): string[] {
  const counts = new Map<string, number>()
  for (const e of engines) {
    for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_TAGS)
    .map(([t]) => t)
}

function EngineTableRow({
  engine: e,
  rank,
  cat,
}: {
  engine: Engine
  rank: number
  cat: RatingCategory
}) {
  const rating = e.ratings?.[cat]
  return (
    <Link
      to={engineUrl(e)}
      className={`${grid} ${row} items-center py-3 text-sm tabular-nums transition-colors hover:bg-surface`}
    >
      <span className="num text-faint">{rank}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate">
          <span className="text-faint">{e.owner_login}/</span>
          <span className="font-medium">{e.name}</span>
        </span>
        {e.description && (
          <span className="truncate text-xs text-faint">{e.description}</span>
        )}
      </div>
      <div className="hidden sm:block">
        <TagPills tags={e.tags} small />
      </div>
      <span className="num text-right">
        {rating ? (
          <>
            {formatRating(rating)}{' '}
            <span className="text-xs text-faint">±{Math.round(rating.phi)}</span>
          </>
        ) : (
          <span className="text-faint">—</span>
        )}
      </span>
      <span className="hidden text-right text-muted sm:block">{e.games_played}</span>
      <span className="hidden text-right text-muted sm:block">
        {e.version_count || <span className="text-loss">0</span>}
      </span>
      <span className="hidden text-right text-meta text-faint sm:block">
        {e.last_game_at ? relativeTime(e.last_game_at) : '—'}
      </span>
    </Link>
  )
}

export default function Engines() {
  const [params, setParams] = useSearchParams()
  const sort = (SORTS.find((s) => s.value === params.get('sort'))?.value ??
    'rating') as Sort
  const query = params.get('q') ?? ''
  const tag = params.get('tag')
  const { data: engines, error } = useQuery({
    queryKey: ['engines'],
    queryFn: fetchEngines,
  })

  const set = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const all = engines ?? []
  const fallbackCat = busiestCategory(all)
  const cat = RATING_CATEGORIES.find((c) => c === params.get('cat')) ?? fallbackCat
  const owners = new Set(all.map((e) => e.owner_login)).size
  const shown = sortEngines(
    all.filter((e) => matches(e, query, tag)),
    sort,
    cat,
  )

  return (
    <Page>
      <PageHeader
        title="Engines"
        subtitle={
          engines &&
          `${all.length} ${all.length === 1 ? 'engine' : 'engines'} by ${owners} ${owners === 1 ? 'person' : 'people'}`
        }
      >
        <Link to="/engine/upload" className={button.primary}>
          Upload an engine
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-meta text-faint">
            Sort
            <Segmented
              label="Sort engines"
              value={sort}
              onChange={(v) => set('sort', v === 'rating' ? null : v)}
              options={SORTS}
            />
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => set('q', e.target.value || null)}
            placeholder="Filter by name, owner or tag"
            className={`${field} w-full sm:w-[300px]`}
          />
          <div className="flex flex-wrap gap-1.5">
            {topTags(all).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => set('tag', tag === t ? null : t)}
                className={`rounded-full border px-2.5 py-[3px] text-xs transition-colors ${
                  tag === t
                    ? 'border-muted text-fg'
                    : 'border-line text-muted hover:text-fg'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Select
            aria-label="Rating category"
            value={cat}
            onChange={(e) => set('cat', e.target.value === fallbackCat ? null : e.target.value)}
            className="ml-auto"
          >
            {RATING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Rating: {capitalize(c)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col">
          <div className={`${grid} ${tableHead}`}>
            <span>#</span>
            <span>Engine</span>
            <span className="hidden sm:block">Tags</span>
            <span className="text-right">Rating</span>
            <span className="hidden text-right sm:block">Games</span>
            <span className="hidden text-right sm:block">Versions</span>
            <span className="hidden text-right sm:block">Last game</span>
          </div>
          {error ? (
            <div className="py-3">
              <Hint>Couldn't load engines</Hint>
            </div>
          ) : engines === undefined ? (
            <div className="py-3">
              <Hint>Loading…</Hint>
            </div>
          ) : shown.length === 0 ? (
            <div className="py-3">
              <Hint>{all.length ? 'No engines match' : 'No engines yet'}</Hint>
            </div>
          ) : (
            shown.map((e, i) => (
              <EngineTableRow key={e.id} engine={e} rank={i + 1} cat={cat} />
            ))
          )}
        </div>
      </div>
    </Page>
  )
}
