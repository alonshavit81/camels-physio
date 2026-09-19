import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { Player } from '../../lib/types'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'

/**
 * Two-tap delete for manually added players (no window.confirm). The armed
 * state disarms itself after 4 s. Seeded players render nothing: they are
 * restored on every import and cannot be deleted.
 */
export function DeletePlayerButton({ player }: { player: Player }) {
  const deletePlayer = useAppStore((s) => s.deletePlayer)
  const navigate = useNavigate()
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])

  if (player.seeded) return null

  function onClick() {
    if (!armed) {
      setArmed(true)
      return
    }
    if (deletePlayer(player.id)) {
      toast.info(`${player.name} deleted`)
      navigate('/players')
    } else {
      setArmed(false)
      toast.error('This player cannot be deleted')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="danger"
        full
        onClick={onClick}
        aria-label={armed ? 'Confirm delete player' : 'Delete player'}
        aria-pressed={armed}
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
        {armed ? 'Tap again to delete' : 'Delete player'}
      </Button>
      <p className="text-center text-xs text-gray-500">
        {armed ? 'Removes the player from every phone after the next sync.' : 'Added by hand, so this player can be removed.'}
      </p>
    </div>
  )
}
