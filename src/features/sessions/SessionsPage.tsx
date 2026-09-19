import { CalendarDays } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { SectionTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { usePlayersSorted, useSessionsByMonth } from '../../store/selectors'
import { InjuryStats } from './InjuryStats'
import { LinkButton } from './LinkButton'
import { SessionCard } from './SessionCard'

export function SessionsPage() {
  const groups = useSessionsByMonth()
  const rosterSize = usePlayersSorted().length

  return (
    <div>
      <PageHeader title="Sessions" subtitle="Trainings, games and work days" />
      <div className="flex flex-col gap-5">
        <InjuryStats />

        {groups.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" aria-hidden="true" />}
            title="No sessions yet"
            description="Open the Calendar tab and tap Apply Monthly Attendance."
            action={<LinkButton to="/calendar">Go to Calendar</LinkButton>}
          />
        ) : (
          groups.map((group) => (
            <section key={group.month} className="flex flex-col gap-2">
              <SectionTitle>{group.title}</SectionTitle>
              <ul className="flex flex-col gap-2">
                {group.sessions.map((session) => (
                  <li key={session.id}>
                    <SessionCard session={session} rosterSize={rosterSize} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
