import { describe, expect, it } from "vitest"
import { createSim, deriveInput, stepSim } from "@/game/game"

describe("deriveInput", () => {
  it("maps keydown and edge-press correctly", () => {
    const down: Record<string, boolean> = { KeyA: true, ArrowRight: true }
    const pressed: Record<string, boolean> = { KeyJ: true, KeyK: true, Slash: true, Period: true, Space: true }
    const input = deriveInput(down, pressed)
    expect(input.p1.left).toBe(true)
    expect(input.p1.defend).toBe(true)
    expect(input.p1.attack).toBe(true)
    expect(input.p2.right).toBe(true)
    expect(input.p2.defend).toBe(true)
    expect(input.p2.attack).toBe(true)
    expect(input.start).toBe(true)
  })
})

describe("stepSim", () => {
  it("starts playing from start phase", () => {
    const sim = createSim()
    stepSim(
      sim,
      {
        p1: { left: false, right: false, attack: false, defend: false, skill: false },
        p2: { left: false, right: false, attack: false, defend: false, skill: false },
        start: true,
        restart: false,
        pause: false,
      },
      1 / 60,
    )
    expect(sim.phase).toBe("playing")
  })

  it("attack reduces HP (blocked reduces more)", () => {
    const sim = createSim()
    sim.phase = "playing"
    sim.p1.x = 150
    sim.p2.x = 168
    sim.p1.facing = "right"
    sim.p2.facing = "left"

    const base = sim.p2.hp
    stepSim(
      sim,
      {
        p1: { left: false, right: false, attack: true, defend: false, skill: false },
        p2: { left: false, right: false, attack: false, defend: false, skill: false },
        start: false,
        restart: false,
        pause: false,
      },
      1 / 60,
    )
    for (let i = 0; i < 20; i += 1) {
      stepSim(
        sim,
        {
          p1: { left: false, right: false, attack: false, defend: false, skill: false },
          p2: { left: false, right: false, attack: false, defend: false, skill: false },
          start: false,
          restart: false,
          pause: false,
        },
        1 / 60,
      )
    }
    expect(sim.p2.hp).toBeLessThan(base)

    const sim2 = createSim()
    sim2.phase = "playing"
    sim2.p1.x = 150
    sim2.p2.x = 168
    sim2.p1.facing = "right"
    sim2.p2.facing = "left"

    const base2 = sim2.p2.hp
    stepSim(
      sim2,
      {
        p1: { left: false, right: false, attack: true, defend: false, skill: false },
        p2: { left: false, right: false, attack: false, defend: true, skill: false },
        start: false,
        restart: false,
        pause: false,
      },
      1 / 60,
    )
    for (let i = 0; i < 20; i += 1) {
      stepSim(
        sim2,
        {
          p1: { left: false, right: false, attack: false, defend: false, skill: false },
          p2: { left: false, right: false, attack: false, defend: true, skill: false },
          start: false,
          restart: false,
          pause: false,
        },
        1 / 60,
      )
    }
    expect(sim2.p2.hp).toBeGreaterThan(sim.p2.hp)
    expect(sim2.p2.hp).toBeLessThan(base2)
  })
})

