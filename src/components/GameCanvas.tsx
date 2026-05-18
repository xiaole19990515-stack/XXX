import { useEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_KEYS,
  createSim,
  deriveInput,
  drawFrame,
  LOGICAL_H,
  LOGICAL_W,
  stepSim,
  type Action,
  type SimState,
} from "@/game/game"
import { useGameUiStore } from "@/store/useGameUiStore"

function actionToStatus(a: Action) {
  if (a === "run") return "MOVE"
  if (a === "attack") return "ATK"
  if (a === "defend") return "DEF"
  if (a === "hit") return "BREAK"
  if (a === "dead") return "DOWN"
  return "READY"
}

function codeLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3)
  if (code.startsWith("Arrow")) return code.slice(5)
  if (code === "Space") return "Space"
  if (code.startsWith("Numpad")) return "Num" + code.slice(5)
  if (code === "Slash") return "/"
  if (code === "Period") return "."
  if (code === "Enter") return "Enter"
  return code
}

function joinKeyLabels(codes: string | readonly string[]) {
  const arr = typeof codes === "string" ? [codes] : [...codes]
  return arr.map(codeLabel).join(" / ")
}

export type KeyLegend = {
  p1: { left: string; right: string; attack: string; defend: string }
  p2: { left: string; right: string; attack: string; defend: string }
  start: string
  restart: string
  pause: string
}

export default function GameCanvas(props: { className?: string; onLegend?: (legend: KeyLegend) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const simRef = useRef<SimState | null>(null)
  const rawDownRef = useRef<Record<string, boolean>>({})
  const rawPressedRef = useRef<Record<string, boolean>>({})

  const rafRef = useRef<number | null>(null)
  const lastMsRef = useRef<number | null>(null)
  const accRef = useRef(0)

  const [scale, setScale] = useState(3)

  const legend = useMemo<KeyLegend>(() => {
    const keys = DEFAULT_KEYS
    return {
      p1: {
        left: joinKeyLabels(keys.p1.left),
        right: joinKeyLabels(keys.p1.right),
        attack: joinKeyLabels(keys.p1.attack),
        defend: joinKeyLabels(keys.p1.defend),
      },
      p2: {
        left: joinKeyLabels(keys.p2.left),
        right: joinKeyLabels(keys.p2.right),
        attack: joinKeyLabels(keys.p2.attack),
        defend: joinKeyLabels(keys.p2.defend),
      },
      start: joinKeyLabels(keys.start),
      restart: joinKeyLabels(keys.restart),
      pause: joinKeyLabels(keys.pause),
    }
  }, [])

  useEffect(() => {
    props.onLegend?.(legend)
  }, [legend, props])

  useEffect(() => {
    simRef.current = createSim()
    useGameUiStore.getState().setUi({
      phase: "start",
      winner: null,
      p1Hp: simRef.current.p1.hp,
      p2Hp: simRef.current.p2.hp,
      p1Status: actionToStatus(simRef.current.p1.action),
      p2Status: actionToStatus(simRef.current.p2.action),
    })
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const next = Math.max(1, Math.floor(Math.min(w / LOGICAL_W, h / LOGICAL_H)))
      setScale(next)
    }

    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const down = rawDownRef.current
      const pressed = rawPressedRef.current
      if (!down[e.code]) pressed[e.code] = true
      down[e.code] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      rawDownRef.current[e.code] = false
    }
    const onBlur = () => {
      rawDownRef.current = {}
      rawPressedRef.current = {}
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const step = (ms: number) => {
      rafRef.current = requestAnimationFrame(step)
      const last = lastMsRef.current ?? ms
      lastMsRef.current = ms

      const dtReal = Math.min(0.05, Math.max(0, (ms - last) / 1000))
      accRef.current += dtReal

      const sim = simRef.current
      if (!sim) return

      const pressed = rawPressedRef.current
      rawPressedRef.current = {}
      const input = deriveInput(rawDownRef.current, pressed)

      const fixedDt = 1 / 60
      while (accRef.current >= fixedDt) {
        stepSim(sim, input, fixedDt)
        accRef.current -= fixedDt
      }

      useGameUiStore.getState().setUi({
        phase: sim.phase,
        winner: sim.winner,
        p1Hp: sim.p1.hp,
        p2Hp: sim.p2.hp,
        p1Status: actionToStatus(sim.p1.action),
        p2Status: actionToStatus(sim.p2.action),
      })

      drawFrame(ctx, sim, { scale, time: ms / 1000 })
    }

    const start = () => {
      cancel()
      lastMsRef.current = null
      accRef.current = 0
      rafRef.current = requestAnimationFrame(step)
    }

    const cancel = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    start()
    return () => cancel()
  }, [scale])

  return (
    <div ref={wrapRef} className={props.className}>
      <canvas
        ref={canvasRef}
        width={LOGICAL_W * scale}
        height={LOGICAL_H * scale}
        className="h-full w-full"
      />
    </div>
  )
}
