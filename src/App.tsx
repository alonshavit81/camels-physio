import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { UserGate } from './features/auth/UserGate'
import { CalendarPage } from './features/calendar/CalendarPage'
import { PlayersPage } from './features/players/PlayersPage'
import { PlayerProfilePage } from './features/players/PlayerProfilePage'
import { SessionsPage } from './features/sessions/SessionsPage'
import { SessionDetailPage } from './features/sessions/SessionDetailPage'
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
        <Route index element={<Navigate to="/calendar" replace />} />
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
