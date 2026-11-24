import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { button, link } from '../styles'
import { CommandLine, Page, PageHeader } from '../ui'

const STARTER = 'MachinePlay/python-chess-starter'
const STARTER_REPO = `https://github.com/${STARTER}`

// In order of preference: uv and pipx isolate the CLI, pip needs a venv.
const INSTALLERS = [
  {
    id: 'uv',
    command: 'uv tool install machineplay',
    note: 'Installs the CLI in its own environment and puts it on your PATH.',
  },
  {
    id: 'pipx',
    command: 'pipx install machineplay',
    note: 'Same idea as uv, if you already have pipx.',
  },
  {
    id: 'pip',
    command: 'python -m venv .venv && .venv/bin/pip install machineplay',
    note: 'A system-wide pip install is refused on most distros — use a virtualenv.',
  },
] as const

function Step({
  n,
  title,
  note,
  last = false,
  children,
}: {
  n: number
  title: string
  note?: string
  last?: boolean
  children: ReactNode
}) {
  return (
    <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-4">
      <div className="flex flex-col items-center">
        <span className="num flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-meta font-medium text-muted">
          {n}
        </span>
        {!last && <span className="my-1.5 w-px flex-1 bg-line" />}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 pb-7 pt-[3px]">
        <span className="text-md font-medium">{title}</span>
        {note && <span className="-mt-1 text-meta text-faint">{note}</span>}
        {children}
      </div>
    </li>
  )
}

const codeBox = 'rounded-md border border-line bg-surface px-3.5 py-2.5'

function InstallTabs() {
  const [active, setActive] = useState<string>(INSTALLERS[0].id)
  const installer = INSTALLERS.find((i) => i.id === active) ?? INSTALLERS[0]
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div role="tablist" className="flex border-b border-line font-mono text-meta">
        {INSTALLERS.map((i) => (
          <button
            key={i.id}
            type="button"
            role="tab"
            aria-selected={i.id === active}
            onClick={() => setActive(i.id)}
            className={`-mb-px border-b-2 px-3.5 py-2 transition-colors ${
              i.id === active
                ? 'border-fg bg-surface-2 text-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {i.id}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-1.5 px-3.5 py-3">
        <CommandLine command={installer.command} />
        <span className="text-xs text-faint">{installer.note}</span>
      </div>
    </div>
  )
}

export default function UploadInfo() {
  return (
    <Page className="!max-w-[720px] !gap-8 !pt-12">
      <PageHeader
        title="Upload an engine"
        subtitle={
          <span className="text-md text-muted">
            Engines are uploaded from the command line. Fork the starter, write
            your engine, then build and push it with the{' '}
            <span className="font-mono text-fg">machineplay</span> CLI.
          </span>
        }
      />

      <ol className="flex flex-col">
        <Step n={1} title="Fork the starter template">
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-line px-4 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{STARTER}</span>
              <span className="text-xs text-faint">
                A working Dockerfile and UCI loop to build on.
              </span>
            </div>
            <a
              href={`${STARTER_REPO}/fork`}
              target="_blank"
              rel="noreferrer"
              className={`${button.secondary} ml-auto h-[30px] px-3 text-meta`}
            >
              Fork on GitHub ↗
            </a>
          </div>
        </Step>
        <Step n={2} title="Install the CLI" note="Needs Python 3.12+ and Docker.">
          <InstallTabs />
        </Step>
        <Step n={3} title="Log in" note="Opens this site so you can create a token.">
          <div className={codeBox}>
            <CommandLine command="machineplay login" />
          </div>
        </Step>
        <Step n={4} title="Build and upload from your engine folder" last>
          <div className={codeBox}>
            <CommandLine command="machineplay upload" />
          </div>
        </Step>
      </ol>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">Never written an engine?</span>
          <span className="text-meta text-faint">
            The tutorial goes from first legal move to alpha-beta, one version per
            chapter.
          </span>
        </div>
        <Link to="/docs/engine-tutorial" className={`${link} ml-auto whitespace-nowrap text-sm`}>
          Engine tutorial →
        </Link>
      </div>

      <p className="text-meta text-faint">
        Need a token now?{' '}
        <Link
          to="/cli"
          className="text-fg underline decoration-line-strong underline-offset-[3px] hover:decoration-muted"
        >
          Generate one here.
        </Link>
      </p>
    </Page>
  )
}
