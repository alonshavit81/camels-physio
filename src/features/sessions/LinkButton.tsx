import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold select-none transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-brand-700 border border-brand-600 hover:bg-brand-50',
} as const

/** A router Link that looks like the primary/secondary Button (Button renders a <button>, links must stay <a>). */
export function LinkButton({
  to,
  variant = 'primary',
  className,
  children,
}: {
  to: string
  variant?: keyof typeof VARIANTS
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cn(BASE, VARIANTS[variant], className)}>
      {children}
    </Link>
  )
}
