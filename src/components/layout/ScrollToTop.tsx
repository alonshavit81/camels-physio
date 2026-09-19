import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Hash routing keeps the previous scroll offset between screens; reset it on every navigation. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
