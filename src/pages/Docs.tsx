import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router'
import { DOCS, docPath, renderMarkdown, type TocEntry } from '../docs'
import '../docs/figures/game-tree.js'
import 'highlight.js/styles/github-dark.css'
import { Page } from '../ui'
import NotFound from './NotFound'

/** The id of the last heading scrolled past the top of the viewport. */
function useActiveHeading(toc: TocEntry[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current: string | null = toc[0]?.id ?? null
      for (const h of toc) {
        const el = document.getElementById(h.id)
        if (el && el.getBoundingClientRect().top <= 96) current = h.id
        else break
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [toc])

  return active
}

function Toc({ toc, active }: { toc: TocEntry[]; active: string | null }) {
  return (
    <ul className="my-1.5 ml-2.5 flex flex-col border-l border-line text-meta">
      {toc.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className={`-ml-px block border-l px-3 py-1 transition-colors ${
              h.id === active
                ? 'border-accent text-fg'
                : 'border-transparent text-faint hover:text-fg'
            }`}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function Docs() {
  const { slug } = useParams()
  const doc = DOCS.find((d) => d.slug === (slug ?? ''))
  const rendered = useMemo(() => (doc ? renderMarkdown(doc.source) : null), [doc])
  const navigate = useNavigate()
  const { hash } = useLocation()
  const active = useActiveHeading(rendered?.toc ?? [])

  // The content lands after the browser tried to scroll to the hash.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [rendered, hash])

  if (!doc || !rendered) return <NotFound />

  // Route the markdown's internal <a href="/..."> links client-side.
  function onClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest('a')
    const href = a?.getAttribute('href')
    if (!href?.startsWith('/') || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    void navigate(href)
  }

  return (
    <Page className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:items-start md:gap-14">
      <aside className="text-sm md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto">
        <nav className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-2 text-xs text-faint">Docs</span>
          {DOCS.map((d) => (
            <div key={d.slug}>
              <NavLink
                to={docPath(d)}
                end
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 rounded px-2.5 py-1.5 transition-colors ${
                    isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'
                  }`
                }
              >
                {d.title}
                {d.draft && <span className="text-[11.5px] text-accent">Draft</span>}
              </NavLink>
              {d === doc && rendered.toc.length > 0 && (
                <>
                  <details className="md:hidden">
                    <summary className="cursor-pointer px-2.5 py-1 text-meta text-faint">
                      Contents
                    </summary>
                    <Toc toc={rendered.toc} active={active} />
                  </details>
                  <div className="hidden md:block">
                    <Toc toc={rendered.toc} active={active} />
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <article className="flex min-w-0 max-w-[680px] flex-col gap-6">
        {doc.draft && (
          <div className="flex flex-col gap-1 rounded-md border border-line bg-surface px-[18px] py-3.5">
            <span className="text-xs font-semibold tracking-[0.06em] text-accent">
              DRAFT
            </span>
            <span className="text-md">
              This page is still being written. Callouts marked TODO describe
              things that don't work yet.
            </span>
          </div>
        )}
        <div
          onClick={onClick}
          className="docs-prose prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      </article>
    </Page>
  )
}
