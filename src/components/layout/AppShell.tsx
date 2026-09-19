import { useState } from 'react'
import { Outlet } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { StorageBanner } from './StorageBanner'
import { ScrollToTop } from './ScrollToTop'
import { Toaster } from '../ui/Toast'
import { UserSwitcher } from '../../features/auth/UserSwitcher'
import { StartTrainingModal } from '../../features/sync/StartTrainingModal'
import { EndTrainingModal } from '../../features/sync/EndTrainingModal'
import { useAppStore } from '../../store/useAppStore'

export function AppShell() {
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const storageReset = useAppStore((s) => s.storageReset)
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <Header onStart={() => setStartOpen(true)} onEnd={() => setEndOpen(true)} onSwitchUser={() => setSwitcherOpen(true)} />
      <StorageBanner />
      {storageReset && (
        <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <div className="mx-auto flex max-w-lg items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>The data saved on this phone could not be read, so the app started fresh. Import the latest backup from the WhatsApp group (Start Training).</span>
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-nav">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster />
      <StartTrainingModal open={startOpen} onClose={() => setStartOpen(false)} />
      <EndTrainingModal open={endOpen} onClose={() => setEndOpen(false)} />
      <UserSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  )
}
