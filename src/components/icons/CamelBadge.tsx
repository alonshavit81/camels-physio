import { cn } from '../../lib/cn'

/** The club logo: a camel in a white circle. Emoji renders natively and crisply on every phone. */
export function CamelBadge({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Camels logo"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm',
        size === 'lg' ? 'h-20 w-20 text-5xl' : 'h-9 w-9 text-xl',
        className,
      )}
    >
      <span aria-hidden="true">🐪</span>
    </span>
  )
}
