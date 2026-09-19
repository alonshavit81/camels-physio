import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when label is an icon. */
  title?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  full = true,
  className,
}: {
  options: ReadonlyArray<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  full?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex rounded-xl bg-gray-100 p-1', full && 'flex w-full', className)}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              size === 'sm' ? 'min-h-9 px-2 text-sm' : 'min-h-11 px-3 text-base',
              selected ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white/70',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
