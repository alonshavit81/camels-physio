import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'

export function PageHeader({ title, subtitle, backTo, backLabel = 'Back', right }: { title: ReactNode; subtitle?: ReactNode; backTo?: string; backLabel?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2">
      {backTo && (
        <Link
          to={backTo}
          aria-label={backLabel}
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold leading-tight text-gray-900">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}
