import { ChevronDown, Volleyball } from 'lucide-react'
import { CamelBadge } from '../icons/CamelBadge'
import { UserDot } from '../ui/UserDot'
import { USERS } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'

export function Header({ onStart, onEnd, onSwitchUser }: { onStart: () => void; onEnd: () => void; onSwitchUser: () => void }) {
  const currentUserId = useAppStore((s) => s.currentUserId)
  const user = currentUserId ? USERS[currentUserId] : null
  return (
    <header className="sticky top-0 z-30 bg-brand-600 text-white shadow-md pt-safe">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
        <CamelBadge />
        <h1 className="text-lg font-bold leading-tight">Camels Physio</h1>
        <Volleyball className="hidden h-5 w-5 shrink-0 opacity-90 min-[360px]:block" aria-hidden="true" />
        <div className="flex-1" />
        <HeaderAction emoji="🏃" label="Start" fullLabel="Start Training: import a backup file" onClick={onStart} />
        <HeaderAction emoji="🏁" label="End" fullLabel="End Training: export a backup file" onClick={onEnd} />
      </div>
      <div className="bg-brand-700">
        <div className="mx-auto flex h-11 max-w-lg items-center px-3">
          <button
            type="button"
            onClick={onSwitchUser}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={user ? `Signed in as ${user.name} (${user.role}). Switch user` : 'Switch user'}
          >
            {user && <UserDot userId={user.id} size="md" className="ring-2 ring-white/70" />}
            <span>{user ? `${user.name} · ${user.role}` : 'Select user'}</span>
            <ChevronDown className="h-4 w-4 opacity-80" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

function HeaderAction({ emoji, label, fullLabel, onClick }: { emoji: string; label: string; fullLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={fullLabel}
      title={fullLabel}
      className="flex min-h-11 min-w-12 flex-col items-center justify-center rounded-xl leading-none transition hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {emoji}
      </span>
      <span aria-hidden="true" className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </span>
    </button>
  )
}
