import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { Card, SectionTitle } from '../../components/ui/Card'
import { useInjuryStats } from '../../store/selectors'

const TOP_PLAYERS = 3
const TOP_BODY_PARTS = 5

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-semibold leading-tight text-gray-900">{value}</p>
    </div>
  )
}

function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'injury' : 'injuries'}`
}

/** Team-wide injury overview: totals, the most injured players and the most hit body parts. */
export function InjuryStats() {
  const stats = useInjuryStats(TOP_PLAYERS)

  return (
    <Card>
      <SectionTitle>Injury overview</SectionTitle>
      {stats.total === 0 ? (
        <p className="mt-2 text-base text-gray-500">No injuries reported yet</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile label="Total injuries" value={stats.total} />
            <StatTile label="Active" value={stats.active} />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-gray-700">Most injured</h3>
          <ol className="mt-1 divide-y divide-gray-100">
            {stats.topPlayers.map((p) => (
              <li key={p.playerId}>
                <Link
                  to={`/players/${p.playerId}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-base hover:bg-gray-50 rounded-lg"
                >
                  <span className="truncate font-medium text-gray-900">{p.number === null ? p.name : `#${p.number} ${p.name}`}</span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {countLabel(p.count)} ({p.active} active)
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {stats.byBodyPart.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Injuries by body part">
              {stats.byBodyPart.slice(0, TOP_BODY_PARTS).map((b) => (
                <li key={b.bodyPart}>
                  <Badge tone="gray">
                    {b.bodyPart} · {b.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}
