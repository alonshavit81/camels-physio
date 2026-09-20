import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { UserGate } from './features/auth/UserGate'
import { CalendarPage } from './features/calendar/CalendarPage'
import { PlayersPage } from './features/players/PlayersPage'
import { PlayerProfilePage } from './features/players/PlayerProfilePage'
import { SessionsPage } from './features/sessions/SessionsPage'
import { SessionDetailPage } from './features/sessions/SessionDetailPage'
import { todayKey } from './lib/dates'
import { homeTarget } from './lib/sync'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated)
  const currentUserId = useAppStore((s) => s.currentUserId)

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-brand-600 text-white" aria-busy="true">
        <span className="text-5xl" role="img" aria-label="Loading">
          🐪
        </span>
      </div>
    )
  }
  if (!currentUserId) return <UserGate />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeRedirect />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:playerId" element={<PlayerProfilePage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Route>
    </Routes>
  )
}

/**
 * Landing screen: today's session on a training or game day (created on the
 * way if Apply has not run yet), otherwise the calendar. Only the index route
 * does this; the Calendar tab itself always shows the calendar.
 */
function HomeRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const store = useAppStore.getState()
    const target = homeTarget(store, todayKey())
    if (target.applyMonth) store.applyMonthlyAttendance(target.applyMonth)
    navigate(target.path, { replace: true })
  }, [navigate])
  return null
}
