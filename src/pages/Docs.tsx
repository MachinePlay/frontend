import { useEffect, useMemo, useRef } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router'
import { DOCS, renderMarkdown, type TocEntry } from '../docs'
import '../docs/figures/game-tree.js'
import 'highlight.js/styles/github-dark.css'
import NotFound from './NotFound'

function Toc({ toc }: { toc: TocEntry[] }) {
  return (
    <ul className="flex flex-col gap-0.5 border-l border-neutral-800">
      {toc.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className="block -ml-px border-l border-transparent pl-3 py-0.5 text-neutral-500 hover:text-neutral-200 hover:border-neutral-500"
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

function docLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'block rounded px-2 py-1 transition-colors',
    isActive ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-100',
  ].join(' ')
}

export default function Docs() {
  const { slug } = useParams()
  const doc = DOCS.find((d) => d.slug === slug)
  const rendered = useMemo(() => (doc ? renderMarkdown(doc.source) : null), [doc])
  const content = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { hash } = useLocation()

  // The content arrives as one innerHTML write, after the browser has already
  // tried to scroll to the hash, so do it again once it is there.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [rendered, hash])

  useEffect(() => {
    const nodes = content.current?.querySelectorAll<HTMLElement>('pre.mermaid')
    if (!nodes?.length) return
    void import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' })
      void mermaid.run({ nodes: [...nodes] })
    })
  }, [rendered])

  if (!doc || !rendered) return <NotFound />

  // Site-internal links in the markdown are plain <a href="/...">; route them
  // client-side instead of reloading the app.
  function onClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest('a')
    const href = a?.getAttribute('href')
    if (!href?.startsWith('/') || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    void navigate(href)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      <aside className="md:w-56 shrink-0 text-sm">
        <div className="md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto flex flex-col gap-4">
          <nav className="flex flex-col gap-0.5">
            <span className="px-2 pb-1 text-xs uppercase tracking-wide text-neutral-600">docs</span>
            {DOCS.map((d) => (
              <div key={d.slug}>
                <NavLink to={`/docs/${d.slug}`} className={docLinkClass}>
                  {d.title}
                </NavLink>
                {d === doc && rendered.toc.length > 0 && (
                  <>
                    <details className="md:hidden pl-2 pt-1 pb-2">
                      <summary className="cursor-pointer px-2 text-neutral-500">contents</summary>
                      <div className="pt-2 pl-2">
                        <Toc toc={rendered.toc} />
                      </div>
                    </details>
                    <div className="hidden md:block pl-2 pt-1 pb-2">
                      <Toc toc={rendered.toc} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <article className="min-w-0 flex-1 flex flex-col gap-6">
        {doc.draft && (
          <div className="rounded border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            <span className="font-semibold tracking-wide">DRAFT</span> — this page is still being
            written. Callouts marked TODO describe things that do not work yet.
          </div>
        )}
        <div
          ref={content}
          onClick={onClick}
          className="docs-prose prose prose-invert prose-neutral max-w-none"
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      </article>
    </div>
  )
}
