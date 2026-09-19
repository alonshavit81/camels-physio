import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string, durationMs?: number) => void
  dismiss: (id: number) => void
}

const MAX_TOASTS = 3
let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, durationMs = 3500) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }].slice(-MAX_TOASTS) }))
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), durationMs)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative API usable outside React (store actions, event handlers). */
export const toast = {
  success: (message: string, durationMs?: number) => useToastStore.getState().push('success', message, durationMs),
  error: (message: string, durationMs?: number) => useToastStore.getState().push('error', message, durationMs),
  info: (message: string, durationMs?: number) => useToastStore.getState().push('info', message, durationMs),
}
