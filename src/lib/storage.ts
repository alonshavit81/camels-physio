import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage wrapper that never throws. In Safari private mode, when the
 * quota is exceeded, or when storage is blocked, we fall back to an in-memory
 * map and flag the device as "not saving" so the UI can warn the user to
 * export after each session.
 */
const memory = new Map<string, string>()
let healthy = true
const listeners = new Set<(healthy: boolean) => void>()

function degrade(): void {
  if (!healthy) return
  healthy = false
  for (const cb of listeners) cb(false)
}

export function isStorageHealthy(): boolean {
  return healthy
}

export function onStorageHealthChange(cb: (healthy: boolean) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const store = ls()
      const v = store ? store.getItem(name) : null
      return v ?? memory.get(name) ?? null
    } catch {
      degrade()
      return memory.get(name) ?? null
    }
  },
  setItem: (name, value) => {
    memory.set(name, value)
    try {
      const store = ls()
      if (!store) {
        degrade()
        return
      }
      store.setItem(name, value)
    } catch {
      degrade()
    }
  },
  removeItem: (name) => {
    memory.delete(name)
    try {
      ls()?.removeItem(name)
    } catch {
      degrade()
    }
  },
}
