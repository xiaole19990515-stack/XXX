import { create } from "zustand"

export type P1Bindings = {
  left: string
  right: string
  attack: string
  defend: string
  skill: string
}

export type AllBindings = {
  p1: P1Bindings
  restart: string
  pause: string
  start: readonly string[]
}

const STORAGE_KEY = "mecha-duel-keybindings"

function loadBindings(): AllBindings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveBindings(b: AllBindings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b))
  } catch {}
}

const DEFAULTS: AllBindings = {
  p1: { left: "KeyA", right: "KeyD", attack: "KeyJ", defend: "KeyK", skill: "KeyL" },
  restart: "KeyR",
  pause: "KeyP",
  start: ["Space", "Enter"],
}

type KeyBindingsState = {
  bindings: AllBindings
  setKey: (player: "p1", action: keyof P1Bindings, code: string) => void
  resetDefaults: () => void
}

export const useKeyBindingsStore = create<KeyBindingsState>((set) => ({
  bindings: loadBindings() ?? DEFAULTS,
  setKey: (player, action, code) =>
    set((s) => {
      const next = {
        ...s.bindings,
        p1: { ...s.bindings.p1, [action]: code },
      }
      saveBindings(next)
      return { bindings: next }
    }),
  resetDefaults: () => {
    saveBindings(DEFAULTS)
    set({ bindings: DEFAULTS })
  },
}))

export { DEFAULTS }
