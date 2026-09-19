import { Badge, type BadgeTone } from '../../components/ui/Badge'
import type { InjuryStatus, Severity, Side } from '../../lib/types'

const SEVERITY_TONE: Record<Severity, BadgeTone> = { Low: 'green', Medium: 'amber', High: 'red' }

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity}</Badge>
}

export function InjuryStatusBadge({ status }: { status: InjuryStatus }) {
  return <Badge tone={status === 'Active' ? 'brand' : 'gray'}>{status}</Badge>
}

export function sideLabel(side: Side): string {
  return side === 'left' ? 'Left' : side === 'right' ? 'Right' : side === 'both' ? 'Both' : ''
}

/** "Knee (Left)" / "Back" */
export function injuryTitle(bodyPart: string, side: Side): string {
  const s = sideLabel(side)
  return s ? `${bodyPart} (${s})` : bodyPart
}
