import { useState } from 'react'
import { Link } from 'react-router'

const STARTER_REPO = 'https://github.com/MachinePlay/python-chess-starter'

function Code({ children }: { children: string }) {
  return (
    <code className="block bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm font-mono text-neutral-200">
      {children}
    </code>
  )
}

// Installers in the order we recommend them: uv and pipx both put the CLI in
// its own environment, plain pip needs a virtualenv to do the same.
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

function InstallTabs() {
  const [active, setActive] = useState<string>(INSTALLERS[0].id)
  const installer = INSTALLERS.find((i) => i.id === active) ?? INSTALLERS[0]
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
      <div role="tablist" className="flex border-b border-neutral-800">
        {INSTALLERS.map((i) => (
          <button
            key={i.id}
            type="button"
            role="tab"
            aria-selected={i.id === active}
            onClick={() => setActive(i.id)}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              i.id === active
                ? 'text-neutral-100 bg-neutral-800'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {i.id}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-1 px-3 py-2">
        <code className="text-sm font-mono text-neutral-200 whitespace-pre overflow-x-auto">
          {installer.command}
        </code>
        <span className="text-xs text-neutral-500">{installer.note}</span>
      </div>
    </div>
  )
}

export default function UploadInfo() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-neutral-100">upload an engine</h1>
      <p className="text-neutral-400 text-sm">
        Engines are uploaded from the command line. Fork the starter template,
        write your engine, then build &amp; push it with the{' '}
        <span className="font-mono">machineplay</span> CLI.
      </p>

      <ol className="flex flex-col gap-3 text-sm text-neutral-300">
        <li className="flex flex-col gap-1">
          <span>1. Fork the starter template:</span>
          <a
            href={`${STARTER_REPO}/fork`}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-100 underline hover:text-white break-all"
          >
            {STARTER_REPO}
          </a>
        </li>
        <li className="flex flex-col gap-1">
          <span>2. Install the CLI (needs Python 3.12+ and Docker):</span>
          <InstallTabs />
        </li>
        <li className="flex flex-col gap-1">
          <span>3. Log in (opens this site for a token):</span>
          <Code>machineplay login</Code>
        </li>
        <li className="flex flex-col gap-1">
          <span>4. From your engine folder, build &amp; upload:</span>
          <Code>machineplay upload</Code>
        </li>
      </ol>

      <p className="text-neutral-500 text-xs">
        Need a token now?{' '}
        <Link to="/cli" className="underline hover:text-neutral-300">
          Generate one here.
        </Link>
      </p>
    </div>
  )
}
