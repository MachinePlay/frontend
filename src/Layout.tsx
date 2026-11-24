import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context'
import { profileUrl } from './api'
import { button } from './styles'
import { usePageviews } from './usePageviews'

const NAV = [
  { to: '/', label: 'Watch' },
  { to: '/engine', label: 'Engines' },
  { to: '/tournament', label: 'Tournaments' },
  { to: '/runners', label: 'Runners' },
  { to: '/docs', label: 'Docs' },
]

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const item =
    'block w-full px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded pl-1 pr-2.5 transition-colors hover:bg-surface-2"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-6 w-6 rounded-full border border-line-strong"
          />
        ) : (
          <span className="h-6 w-6 rounded-full border border-line-strong bg-track" />
        )}
        <span className="hidden sm:inline">{user.login}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1"
        >
          <Link role="menuitem" to={profileUrl(user.login)} onClick={close} className={item}>
            Your profile
          </Link>
          <Link role="menuitem" to="/engine/upload" onClick={close} className={item}>
            Upload an engine
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close()
              void logout()
            }}
            className={`${item} border-t border-line`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function AuthSlot() {
  const { user, loading, login } = useAuth()
  if (loading) return <span className="text-xs text-faint">…</span>
  if (user) return <UserMenu />
  return (
    <button type="button" onClick={login} className={button.primary}>
      <GitHubMark />
      <span className="hidden sm:inline">Sign in with GitHub</span>
      <span className="sm:hidden">Sign in</span>
    </button>
  )
}

export default function Layout() {
  usePageviews()
  const { pathname } = useLocation()
  // Watch covers the game pages it links to.
  const watching = pathname === '/' || pathname.startsWith('/game/')

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1160px] items-center gap-4 px-4 text-sm sm:gap-7 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 text-md font-semibold"
          >
            <img src="/favicon.svg" alt="" className="h-[22px] w-[22px]" />
            <span className="hidden md:inline">MachinePlay</span>
          </Link>
          <nav className="-my-2 flex min-w-0 gap-4 overflow-x-auto py-2 text-muted sm:gap-5 [scrollbar-width:none]">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `shrink-0 transition-colors hover:text-fg ${
                    (to === '/' ? watching : isActive) ? 'text-fg' : ''
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <AuthSlot />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
