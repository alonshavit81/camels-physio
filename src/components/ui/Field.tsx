import { cloneElement, isValidElement, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const CONTROL_CLASS =
  'w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-500 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50'

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: ReactNode; className?: string }) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  // Read the hint together with the control, unless the caller already points aria-describedby elsewhere (an error).
  const control =
    hintId && isValidElement<{ 'aria-describedby'?: string }>(children) && !children.props['aria-describedby']
      ? cloneElement(children, { 'aria-describedby': hintId })
      : children
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-gray-700">
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  )
}

// dir="auto": the data is Hebrew while the chrome is English, so each control
// aligns and places its caret by its own value. Callers can still override.
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input dir="auto" className={cn(CONTROL_CLASS, 'min-h-11', className)} {...rest} />
}

export function Textarea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea dir="auto" rows={rows} className={cn(CONTROL_CLASS, 'py-2.5 leading-relaxed', className)} {...rest} />
}

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export function Select<T extends string>({
  options,
  placeholder,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & { options: ReadonlyArray<SelectOption<T>>; placeholder?: string }) {
  return (
    <select className={cn(CONTROL_CLASS, 'min-h-11 appearance-none pr-9 select-chevron', className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
