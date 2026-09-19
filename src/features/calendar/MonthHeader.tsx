import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { formatMonthTitle } from '../../lib/dates'
import type { MonthKey } from '../../lib/types'

export function MonthHeader({
  month,
  isCurrentMonth,
  onPrev,
  onNext,
  onToday,
}: {
  month: MonthKey
  isCurrentMonth: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Chevrons hug the title; "Today" sits apart on the right so its appearance never shifts them. */}
      <IconButton label="Previous month" onClick={onPrev} className="-ml-2 shrink-0 text-gray-700 hover:bg-gray-100">
        <ChevronLeft className="h-6 w-6" aria-hidden="true" />
      </IconButton>
      <h1 className="min-w-0 truncate text-xl font-bold leading-tight text-gray-900">{formatMonthTitle(month)}</h1>
      <IconButton label="Next month" onClick={onNext} className="shrink-0 text-gray-700 hover:bg-gray-100">
        <ChevronRight className="h-6 w-6" aria-hidden="true" />
      </IconButton>
      {!isCurrentMonth && (
        <Button variant="ghost" onClick={onToday} title="Back to the current month" className="ml-auto shrink-0">
          Today
        </Button>
      )}
    </div>
  )
}
