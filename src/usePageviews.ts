import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

declare global {
  interface Window {
    goatcounter?: { count: (vars?: { referrer?: () => string }) => void }
  }
}

// count.js counts the landing page on load; this counts client-side navigation.
export function usePageviews() {
  const { pathname, search } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    // A blank string falls back to document.referrer, which would credit every
    // navigation to the site the visitor arrived from.
    window.goatcounter?.count({ referrer: () => '' })
  }, [pathname, search])
}
