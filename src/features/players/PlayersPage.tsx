import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Field'
import { useActiveInjuryCounts, usePlayersSorted } from '../../store/selectors'
import { AddPlayerModal } from './AddPlayerModal'
import { PlayerRow } from './PlayerRow'
import { playerMatchesQuery } from './playerNumber'

export function PlayersPage() {
  const players = usePlayersSorted()
  const activeCounts = useActiveInjuryCounts()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(() => players.filter((p) => playerMatchesQuery(p, query)), [players, query])
  const searching = query.trim() !== ''

  return (
    <div>
      <PageHeader
        title="Players"
        subtitle={`${players.length} ${players.length === 1 ? 'player' : 'players'}`}
        right={
          <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add player
          </Button>
        }
      />

      <div role="search" className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input
          aria-label="Search players"
          placeholder="Search by name or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={searching ? 'pr-12 pl-10' : 'pl-10'}
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-0 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-xl text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {players.length === 0 ? (
        <EmptyState
          title="No players yet"
          description="Add the first player to start tracking the squad."
          action={
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="h-5 w-5" aria-hidden="true" /> Add player
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No players match" description={`Nothing found for "${query.trim()}".`} />
      ) : (
        <ul aria-label="Players" className="flex flex-col gap-2">
          {filtered.map((p) => (
            <PlayerRow key={p.id} player={p} activeInjuries={activeCounts[p.id] ?? 0} />
          ))}
        </ul>
      )}

      <AddPlayerModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
