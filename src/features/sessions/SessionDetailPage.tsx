import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { CheckCheck } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SectionTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { UserChip } from '../../components/ui/UserDot'
import { isSessionOnCalendar } from '../../lib/apply'
import { formatDateFull } from '../../lib/dates'
import type { AttendanceStatus, Injury, Session } from '../../lib/types'
import { useAppStore } from '../../store/useAppStore'
import { useInjuriesForSession, usePlayersSorted, useSession, usersWorkedOn } from '../../store/selectors'
import { toast } from '../../store/toastStore'
import { InjuryFormModal } from '../injuries/InjuryFormModal'
import { LinkButton } from './LinkButton'
import { RosterRow } from './RosterRow'
import { SessionNotes } from './SessionNotes'
import { SessionTypeBadge } from './SessionTypeBadge'

const NO_INJURIES: Injury[] = []

/** Which player the single injury sheet is open for (and the injury being edited, if any). */
interface InjuryFormTarget {
  playerId: string
  injury?: Injury
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)

  // Detail pages open at the top, not at the list's scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [sessionId])

  if (!session) {
    return (
      <div>
        <PageHeader backTo="/sessions" backLabel="Back to sessions" title="Session" />
        <EmptyState
          title="Session not found"
          description="It may have been removed when the calendar changed."
          action={
            <LinkButton to="/sessions" variant="secondary">
              Back to sessions
            </LinkButton>
          }
        />
      </div>
    )
  }
  return <SessionDetail session={session} />
}

function SessionDetail({ session }: { session: Session }) {
  const players = usePlayersSorted()
  const sessionInjuries = useInjuriesForSession(session.id)
  const workedPhysios = useAppStore(useShallow((s) => usersWorkedOn(s.workDays, session.date)))
  const onCalendar = useAppStore((s) => isSessionOnCalendar(s, session))
  const setPlayerSessionStatus = useAppStore((s) => s.setPlayerSessionStatus)

  const physios = workedPhysios.length > 0 ? workedPhysios : session.physios

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, injured: 0, unset: 0 }
    for (const p of players) c[session.playerAttendance[p.id]?.status ?? 'unset'] += 1
    return c
  }, [players, session.playerAttendance])

  const injuriesByPlayer = useMemo(() => {
    const map = new Map<string, Injury[]>()
    for (const injury of sessionInjuries) {
      const list = map.get(injury.playerId)
      if (list) list.push(injury)
      else map.set(injury.playerId, [injury])
    }
    return map
  }, [sessionInjuries])

  const [formTarget, setFormTarget] = useState<InjuryFormTarget | null>(null)

  function markUnmarkedPresent() {
    const unmarked = players.filter((p) => (session.playerAttendance[p.id]?.status ?? 'unset') === 'unset')
    for (const p of unmarked) setPlayerSessionStatus(session.id, p.id, 'present')
    toast.success(`${unmarked.length} ${unmarked.length === 1 ? 'player' : 'players'} marked present`)
  }

  return (
    <div>
      <PageHeader
        backTo="/sessions"
        backLabel="Back to sessions"
        title={formatDateFull(session.date)}
        subtitle={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <SessionTypeBadge type={session.type} />
            {physios.map((id) => (
              <UserChip key={id} userId={id} className="text-gray-700" />
            ))}
            {physios.length === 0 && <span>No physio marked</span>}
            {!onCalendar && <Badge tone="amber">Not on calendar</Badge>}
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <SessionNotes sessionId={session.id} notes={session.notes} />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Roster</SectionTitle>
            <Button size="sm" variant="secondary" className="min-h-11" onClick={markUnmarkedPresent} disabled={counts.unset === 0}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark unmarked as present
            </Button>
          </div>
          <p className="text-base text-gray-700" aria-live="polite">
            Present <strong className="font-semibold text-gray-900">{counts.present}</strong> · Absent{' '}
            <strong className="font-semibold text-gray-900">{counts.absent}</strong> · Injured{' '}
            <strong className="font-semibold text-gray-900">{counts.injured}</strong> · Unmarked{' '}
            <strong className="font-semibold text-gray-900">{counts.unset}</strong>
          </p>

          {players.length === 0 ? (
            <EmptyState
              title="No players yet"
              description="Add players in the Players tab to mark attendance."
              action={
                <LinkButton to="/players" variant="secondary">
                  Go to Players
                </LinkButton>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((player) => (
                <RosterRow
                  key={player.id}
                  player={player}
                  status={session.playerAttendance[player.id]?.status ?? 'unset'}
                  injuries={injuriesByPlayer.get(player.id) ?? NO_INJURIES}
                  onStatusChange={(status) => setPlayerSessionStatus(session.id, player.id, status)}
                  onReportInjury={() => setFormTarget({ playerId: player.id })}
                  onEditInjury={(injury) => setFormTarget({ playerId: player.id, injury })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <InjuryFormModal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        playerId={formTarget?.playerId ?? ''}
        sessionId={session.id}
        defaultDate={session.date}
        injury={formTarget?.injury}
      />
    </div>
  )
}
