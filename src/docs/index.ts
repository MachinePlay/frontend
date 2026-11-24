import { Marked, type Tokens } from 'marked'
import markedAlert from 'marked-alert'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import ini from 'highlight.js/lib/languages/ini'
import python from 'highlight.js/lib/languages/python'
import engineTutorial from './engine-tutorial.md?raw'
import addRunner from './add-runner.md?raw'
import about from './about.md?raw'

export type Doc = {
  slug: string
  title: string
  source: string
  // Shown with a banner: the page is published but parts of it are marked TODO.
  draft: boolean
}

export const DOCS: Doc[] = [
  { slug: 'engine-tutorial', title: 'Engine Tutorial', source: engineTutorial, draft: true },
  { slug: 'add-runner', title: 'Add runner', source: addRunner, draft: true },
  { slug: 'about', title: 'About MachinePlay.org', source: about, draft: true },
]

// Only the languages the docs use; a fence without one (UCI transcripts) stays plain.
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash) // also `sh`
hljs.registerLanguage('ini', ini)

export type TocEntry = { id: string; text: string; depth: number }

// The markdown refers to figures as `figures/fig-*.svg`, which is also how they
// sit next to it on disk; map those to the hashed URLs Vite emits.
const FIGURES = import.meta.glob<string>('./figures/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function renderMarkdown(source: string): { html: string; toc: TocEntry[] } {
  const headings: TocEntry[] = []
  const seen = new Map<string, number>()

  const marked = new Marked(
    markedAlert({ variants: [{ type: 'todo', icon: '', title: 'TODO' }] }),
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight: (code, lang) =>
        hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : code,
    }),
    {
      renderer: {
        heading({ tokens, depth, text }: Tokens.Heading) {
          const plain = text.replace(/`/g, '')
          const base = slugify(plain)
          const n = seen.get(base) ?? 0
          seen.set(base, n + 1)
          const id = n ? `${base}-${n}` : base
          headings.push({ id, text: plain, depth })
          return `<h${depth} id="${id}"><a href="#${id}">${this.parser.parseInline(tokens)}</a></h${depth}>\n`
        },
      },
    },
  )

  const html = (marked.parse(source, { async: false }) as string).replace(
    /src="figures\/([\w.-]+\.svg)"/g,
    (match, name: string) => {
      const url = FIGURES[`./figures/${name}`]
      return url ? `src="${url}"` : match
    },
  )

  // A multi-chapter doc (several `#`) lists its chapters; a single-page doc
  // lists its sections. The first `#` is the page title either way.
  const h1 = headings.filter((h) => h.depth === 1)
  const toc = h1.length > 1 ? h1.slice(1) : headings.filter((h) => h.depth === 2)
  return { html, toc }
}
