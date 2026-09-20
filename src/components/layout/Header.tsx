import { useEffect, useState } from 'react'
import { ChevronDown, RefreshCw, Volleyball } from 'lucide-react'
import { CamelBadge } from '../icons/CamelBadge'
import { UserDot } from '../ui/UserDot'
import { USERS, userName } from '../../lib/users'
import { formatRelative } from '../../lib/dates'
import { useAppStore } from '../../store/useAppStore'

/** Re-render once a minute so "5 min ago" keeps up without any store traffic. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

export function Header({ onStart, onEnd, onSwitchUser }: { onStart: () => void; onEnd: () => void; onSwitchUser: () => void }) {
  const currentUserId = useAppStore((s) => s.currentUserId)
  const lastImport = useAppStore((s) => s.lastImport)
  const dirty = useAppStore((s) => s.dirtySinceExport)
  const now = useNow()
  const user = currentUserId ? USERS[currentUserId] : null
  const importText = lastImport ? `Import: ${userName(lastImport.by)} · ${formatRelative(lastImport.at, now)}` : 'No import yet'
  return (
    <header className="sticky top-0 z-30 bg-brand-600 text-white shadow-md pt-safe">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
        <CamelBadge />
        <h1 className="text-lg font-bold leading-tight">Camels Physio</h1>
        <Volleyball className="hidden h-5 w-5 shrink-0 opacity-90 min-[360px]:block" aria-hidden="true" />
        <div className="flex-1" />
        <HeaderAction emoji="🏃" label="Start" fullLabel="Start Training: import a backup file" onClick={onStart} />
        <HeaderAction
          emoji="🏁"
          label="End"
          fullLabel={dirty ? 'End Training: export a backup file (changes not exported yet)' : 'End Training: export a backup file'}
          badge={dirty}
          onClick={onEnd}
        />
      </div>
      <div className="bg-brand-700">
        <div className="mx-auto flex h-11 max-w-lg items-center gap-2 px-3">
          <button
            type="button"
            onClick={onSwitchUser}
            className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={user ? `Signed in as ${user.name} (${user.role}). Switch user` : 'Switch user'}
          >
            {user && <UserDot userId={user.id} size="md" className="ring-2 ring-white/70" />}
            <span className="truncate">{user ? `${user.name} · ${user.role}` : 'Select user'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onStart}
            title={lastImport ? `Last import: ${lastImport.fileName || 'backup'} from ${userName(lastImport.by)}` : 'Nothing has been imported on this phone yet'}
            aria-label={`${importText}. Open Start Training to import a backup`}
            className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 text-xs font-medium text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
            {lastImport ? (
              <span className="flex flex-col items-start leading-tight">
                <span>Import: {userName(lastImport.by)}</span>
                <span>{formatRelative(lastImport.at, now)}</span>
              </span>
            ) : (
              <span>No import yet</span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

function HeaderAction({ emoji, label, fullLabel, badge, onClick }: { emoji: string; label: string; fullLabel: string; badge?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={fullLabel}
      title={fullLabel}
      className="relative flex min-h-11 min-w-12 flex-col items-center justify-center rounded-xl leading-none transition hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {emoji}
      </span>
      <span aria-hidden="true" className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </span>
      {badge && <span aria-hidden="true" className="absolute top-1 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-brand-600" />}
    </button>
  )
}
