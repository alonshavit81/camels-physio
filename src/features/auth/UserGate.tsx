import { useState } from 'react'
import { Volleyball } from 'lucide-react'
import { CamelBadge } from '../../components/icons/CamelBadge'
import { Button } from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Field'
import { USER_LIST, isUserId } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'

/** Full-screen "who are you?" picker shown until a user is selected on this device. */
export function UserGate() {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const [choice, setChoice] = useState('')
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-brand-600 px-6 pt-safe-10 pb-safe-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <CamelBadge size="lg" className="bg-brand-50" />
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            Camels Physio
            <Volleyball className="h-6 w-6 text-brand-600" aria-hidden="true" />
          </h1>
          <p className="text-sm text-gray-500">Attendance, player profiles and injuries for the physio team.</p>
        </div>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (isUserId(choice)) setCurrentUser(choice)
          }}
        >
          <Field label="Who are you?" htmlFor="user-select">
            <Select
              id="user-select"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              placeholder="Select your name"
              options={USER_LIST.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
              autoFocus
            />
          </Field>
          <Button type="submit" full disabled={!isUserId(choice)}>
            Continue
          </Button>
        </form>
      </div>
    </main>
  )
}
