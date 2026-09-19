import { Check } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { UserDot } from '../../components/ui/UserDot'
import { USER_LIST } from '../../lib/users'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../store/useAppStore'

export function UserSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const currentUserId = useAppStore((s) => s.currentUserId)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  return (
    <Modal open={open} onClose={onClose} title="Who is using this phone?">
      <ul className="flex flex-col gap-2" role="list">
        {USER_LIST.map((u) => {
          const selected = u.id === currentUserId
          return (
            <li key={u.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCurrentUser(u.id)
                  onClose()
                }}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-base transition',
                  selected ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50',
                )}
              >
                <UserDot userId={u.id} size="lg" />
                <span className="flex-1">
                  <span className="font-semibold">{u.name}</span>
                  <span className="ml-2 text-sm text-gray-500">{u.role}</span>
                </span>
                {selected && <Check className="h-5 w-5 text-brand-600" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-gray-500">Only Shahar can set team trainings and games. Everyone marks their own work days.</p>
    </Modal>
  )
}
