import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { usePlayer } from '../../store/selectors'
import { DeletePlayerButton } from './DeletePlayerButton'
import { PlayerForm } from './PlayerForm'
import { PlayerInjuryLog } from './PlayerInjuryLog'
import { playerNumberLabel } from './playerNumber'

export function PlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>()
  const player = usePlayer(playerId)

  // Detail pages open at the top, not at the list's scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [playerId])

  if (!player || player.deleted) {
    return (
      <div>
        <PageHeader backTo="/players" backLabel="Back to players" title="Player" />
        <EmptyState
          title="Player not found"
          description="This player may have been deleted or the link is out of date."
          action={
            <Link
              to="/players"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-base font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              Back to players
            </Link>
          }
        />
      </div>
    )
  }

  const subtitle = player.bodyType ? `${playerNumberLabel(player.number)} · ${player.bodyType}` : playerNumberLabel(player.number)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backTo="/players" backLabel="Back to players" title={player.name} subtitle={subtitle} />
      <PlayerForm key={player.id} player={player} />
      <PlayerInjuryLog playerId={player.id} />
      <DeletePlayerButton player={player} />
    </div>
  )
}
