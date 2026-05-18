import { create } from "zustand"

type Phase = "start" | "playing" | "paused" | "result"
type PlayerId = "p1" | "p2"
type GameMode = "pvp" | "ai"

type GameUiState = {
  phase: Phase
  winner: PlayerId | null
  p1Hp: number
  p2Hp: number
  p1MaxHp: number
  p2MaxHp: number
  p1Status: string
  p2Status: string
  p1DefendCooldown: number
  p1RangedCooldown: number
  p2DefendCooldown: number
  p2RangedCooldown: number
  mode: GameMode
  currentLevel: number
  showSettings: boolean
  setUi: (next: Partial<Omit<GameUiState, "setUi">>) => void
}

export const useGameUiStore = create<GameUiState>((set) => ({
  phase: "start",
  winner: null,
  p1Hp: 100,
  p2Hp: 100,
  p1MaxHp: 100,
  p2MaxHp: 100,
  p1Status: "READY",
  p2Status: "READY",
  p1DefendCooldown: 0,
  p1RangedCooldown: 0,
  p2DefendCooldown: 0,
  p2RangedCooldown: 0,
  mode: "pvp",
  currentLevel: 0,
  showSettings: false,
  setUi: (next) => set(next),
}))
