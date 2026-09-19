import { NavLink } from 'react-router'
import { CalendarDays, ClipboardList, Users } from 'lucide-react'
import { cn } from '../../lib/cn'

const TABS = [
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/players', label: 'Players', Icon: Users },
  { to: '/sessions', label: 'Sessions', Icon: ClipboardList },
] as const

export function BottomNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-safe">
      <ul className="mx-auto flex h-16 max-w-lg">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600',
                  isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden="true" className="absolute top-0 h-0.5 w-12 rounded-b bg-brand-600" />}
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
