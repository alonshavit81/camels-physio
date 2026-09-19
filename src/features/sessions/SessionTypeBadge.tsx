import { Activity, Trophy, Volleyball } from 'lucide-react'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import type { SessionType } from '../../lib/types'

const CONFIG: Record<SessionType, { label: string; tone: BadgeTone; Icon: typeof Activity }> = {
  training: { label: 'Training', tone: 'brand', Icon: Volleyball },
  game: { label: 'Game', tone: 'amber', Icon: Trophy },
  workday: { label: 'Work day', tone: 'gray', Icon: Activity },
}

export function sessionTypeLabel(type: SessionType): string {
  return CONFIG[type].label
}

/** Training / Game / Work day pill with its icon. */
export function SessionTypeBadge({ type }: { type: SessionType }) {
  const { label, tone, Icon } = CONFIG[type]
  return (
    <Badge tone={tone}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Badge>
  )
}
