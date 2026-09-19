import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { Player } from '../../lib/types'
import { playerNumberBadgeLabel } from './playerNumber'

/** One tappable row of the players list: number, name, body type and active-injury count. */
export function PlayerRow({ player, activeInjuries }: { player: Player; activeInjuries: number }) {
  const hasNumber = player.number !== null
  const showMeta = player.bodyType !== '' || activeInjuries > 0
  return (
    <li>
      <Link
        to={`/players/${player.id}`}
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition active:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <Badge tone={hasNumber ? 'brand' : 'gray'} className="min-w-11 justify-center tabular-nums">
          {playerNumberBadgeLabel(player.number)}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">{player.name}</p>
          {showMeta && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {player.bodyType !== '' && <Badge tone="gray">{player.bodyType}</Badge>}
              {activeInjuries > 0 && (
                <Badge tone="red">
                  {activeInjuries} active
                </Badge>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      </Link>
    </li>
  )
}
