import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * iOS-safe scroll lock: `overflow: hidden` alone does not stop Safari from
 * scrolling the page behind a sheet, so we pin the body and restore scrollY.
 */
function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const body = document.body
    const scrollY = window.scrollY
    const saved = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = saved.position
      body.style.top = saved.top
      body.style.left = saved.left
      body.style.right = saved.right
      body.style.width = saved.width
      body.style.overflow = saved.overflow
      window.scrollTo(0, scrollY)
    }
  }, [active])
}

/**
 * Native <dialog> shown with showModal(): top layer, inert background, Escape
 * handling and focus management for free. Styled as a bottom sheet on phones.
 * Children are only mounted while open, so any <input type="file"> inside is a
 * real element in the document for as long as the sheet is visible.
 * Note: the Toaster lives in normal DOM, so a toast pushed while a modal is
 * open is dimmed and inert behind the ::backdrop; toast only after onClose().
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useBodyScrollLock(open)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Clicks on ::backdrop are dispatched to the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-md max-h-[90dvh] rounded-t-2xl border-0 bg-white p-0 text-gray-900 shadow-2xl outline-none',
        'sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-2xl',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          {footer ? <div className="border-t border-gray-200 px-4 pt-3 pb-safe-3">{footer}</div> : <div className="pb-safe" />}
        </div>
      )}
    </dialog>
  )
}
