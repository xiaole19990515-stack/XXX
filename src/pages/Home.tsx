import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_KEYS,
  drawFrame,
  createSim,
  deriveInput,
  LOGICAL_H,
  LOGICAL_W,
  stepSim,
  type Action,
  type SimState,
} from "@/game/game"
import { BOSSES } from "@/game/bosses"
import { computeAiInput } from "@/game/ai"
import { cn } from "@/lib/utils"
import { useGameUiStore } from "@/store/useGameUiStore"
import { useKeyBindingsStore, type P1Bindings } from "@/store/useKeyBindingsStore"

type Viewport = { w: number; h: number; scale: number }

function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>({ w: 0, h: 0, scale: 1 })
  useEffect(() => {
    const el = document.documentElement
    const ro = new ResizeObserver(() => {
      const w = window.innerWidth
      const h = window.innerHeight
      const scale = Math.max(1, Math.floor(Math.min(w / LOGICAL_W, h / LOGICAL_H)))
      setVp({ w, h, scale })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return vp
}

function clampHp(v: number) {
  return Math.max(0, Math.min(9999, Math.round(v)))
}

function actionToStatus(a: Action) {
  if (a === "run") return "MOVE"
  if (a === "attack") return "ATK"
  if (a === "ranged") return "ULT"
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

function joinKeys(codes: string | readonly string[]) {
  const arr = typeof codes === "string" ? [codes] : [...codes]
  return arr.map(codeLabel).join(" / ")
}

function StatusTag({ text, tone }: { text: string; tone: "cyan" | "amber" | "red" | "zinc" }) {
  const cls =
    tone === "cyan"
      ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30"
      : tone === "amber"
        ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30"
        : tone === "red"
          ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30"
          : "bg-zinc-200/10 text-zinc-200 ring-1 ring-zinc-200/15"
  return (
    <span className={cn("inline-flex items-center px-2 py-1 text-[11px] tracking-[0.18em] uppercase", cls)}>
      {text}
    </span>
  )
}

function CooldownBar({ current, max, label, color }: { current: number; max: number; label: string; color: string }) {
  if (current <= 0) return null
  const pct = Math.min(100, (current / max) * 100)
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div className="h-1.5 flex-1 bg-zinc-950/60 ring-1 ring-zinc-200/10">
        <div
          className={`h-1.5 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] leading-none text-zinc-200/70 w-[22px] text-right tabular-nums">
        {current.toFixed(1)}s
      </span>
      <span className="text-[8px] leading-none text-zinc-200/40 tracking-wider">{label}</span>
    </div>
  )
}

function Hud() {
  const p1Hp = useGameUiStore((s) => s.p1Hp)
  const p2Hp = useGameUiStore((s) => s.p2Hp)
  const p1MaxHp = useGameUiStore((s) => s.p1MaxHp)
  const p2MaxHp = useGameUiStore((s) => s.p2MaxHp)
  const p1Status = useGameUiStore((s) => s.p1Status)
  const p2Status = useGameUiStore((s) => s.p2Status)
  const phase = useGameUiStore((s) => s.phase)
  const mode = useGameUiStore((s) => s.mode)
  const currentLevel = useGameUiStore((s) => s.currentLevel)
  const p1DefCooldown = useGameUiStore((s) => s.p1DefendCooldown)
  const p1RangedCooldown = useGameUiStore((s) => s.p1RangedCooldown)
  const p2DefCooldown = useGameUiStore((s) => s.p2DefendCooldown)
  const p2RangedCooldown = useGameUiStore((s) => s.p2RangedCooldown)

  const p1Tone: "cyan" | "amber" | "red" = p1Hp > 60 ? "cyan" : p1Hp > 25 ? "amber" : "red"
  const p2Tone: "cyan" | "amber" | "red" = p2Hp > 60 ? "cyan" : p2Hp > 25 ? "amber" : "red"

  const p1Pct = p1MaxHp > 0 ? (p1Hp / p1MaxHp) * 100 : 0
  const p2Pct = p2MaxHp > 0 ? (p2Hp / p2MaxHp) * 100 : 0

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 p-3">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
        <div className="w-[46%]">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[11px] tracking-[0.22em] text-zinc-200/80">
              P1{mode === "ai" && currentLevel > 0 ? ` · 第${currentLevel}关` : ""}
            </div>
            <StatusTag text={phase === "start" ? "READY" : p1Status} tone={p1Tone} />
          </div>
          <div className="h-3 w-full bg-zinc-950/60 ring-1 ring-zinc-200/15">
            <div className="h-3 bg-cyan-300/90" style={{ width: `${p1Pct}%` }} />
          </div>
          <CooldownBar current={p1DefCooldown} max={3} label="防御" color="bg-blue-400/80" />
          <CooldownBar current={p1RangedCooldown} max={3} label="大招" color="bg-purple-400/80" />
        </div>

        <div className="w-[46%]">
          <div className="mb-1 flex items-center justify-between">
            <StatusTag text={phase === "start" ? "READY" : p2Status} tone={p2Tone} />
            <div className="text-[11px] tracking-[0.22em] text-zinc-200/80">
              {mode === "ai" && currentLevel > 0 ? `${BOSSES[currentLevel - 1]?.name ?? "BOSS"}` : "P2"}
            </div>
          </div>
          <div className="h-3 w-full bg-zinc-950/60 ring-1 ring-zinc-200/15">
            <div className="h-3 bg-orange-300/90" style={{ width: `${p2Pct}%` }} />
          </div>
          <CooldownBar current={p2DefCooldown} max={3} label="防御" color="bg-blue-400/80" />
          <CooldownBar current={p2RangedCooldown} max={3} label="大招" color="bg-purple-400/80" />
        </div>
      </div>
    </div>
  )
}

function OverlayShell({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 px-6">
      <div className="w-full max-w-xl border border-zinc-200/20 bg-zinc-950/70 p-5 text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
        {children}
      </div>
    </div>
  )
}

function ControlRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between border border-zinc-200/10 bg-zinc-950/40 px-3 py-2 text-[12px]">
      <div className="text-zinc-200/80">{left}</div>
      <div className="font-mono text-zinc-100">{right}</div>
    </div>
  )
}

function ModeOverlay({ onPvp, onAi }: { onPvp: () => void; onAi: () => void }) {
  return (
    <OverlayShell>
      <div className="text-center">
        <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">DEMO</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">像素机甲对战</div>
        <div className="mt-2 text-sm text-zinc-200/80">选择游戏模式</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <button
          onClick={onPvp}
          className="border border-cyan-300/40 bg-cyan-400/15 px-4 py-5 text-center text-cyan-100 hover:bg-cyan-400/25"
        >
          <div className="text-sm font-semibold">好友对战</div>
          <div className="mt-1 text-[11px] text-cyan-200/70">双人同屏，本地对战</div>
        </button>
        <button
          onClick={onAi}
          className="border border-orange-300/40 bg-orange-400/15 px-4 py-5 text-center text-orange-100 hover:bg-orange-400/25"
        >
          <div className="text-sm font-semibold">AI 对战</div>
          <div className="mt-1 text-[11px] text-orange-200/70">逐关挑战五名 BOSS</div>
        </button>
      </div>

      <div className="mt-4 text-center text-[11px] text-zinc-200/60">Space / Enter 可开始好友对战</div>
    </OverlayShell>
  )
}

function KeySettingsOverlay({ onClose }: { onClose: () => void }) {
  const bindings = useKeyBindingsStore((s) => s.bindings)
  const setKey = useKeyBindingsStore((s) => s.setKey)
  const resetDefaults = useKeyBindingsStore((s) => s.resetDefaults)
  const [listening, setListening] = useState<{ action: keyof P1Bindings } | null>(null)

  const items: { label: string; action: keyof P1Bindings }[] = [
    { label: "左移", action: "left" },
    { label: "右移", action: "right" },
    { label: "攻击", action: "attack" },
    { label: "防御", action: "defend" },
    { label: "大招", action: "skill" },
  ]

  useEffect(() => {
    if (!listening) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      setKey("p1", listening.action, e.code)
      setListening(null)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [listening, setKey])

  return (
    <OverlayShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">SETTINGS</div>
          <div className="mt-1 text-lg font-semibold tracking-tight">按键设置（P1）</div>
        </div>
        <button onClick={onClose} className="shrink-0 border border-zinc-200/20 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-100 hover:bg-zinc-950/70">
          完成
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {items.map(({ label, action }) => (
          <button
            key={action}
            onClick={() => setListening({ action })}
            className="flex items-center justify-between border border-zinc-200/10 bg-zinc-950/40 px-3 py-2 text-[12px] hover:bg-zinc-950/70"
          >
            <div className="text-zinc-200/80">{label}</div>
            <div className="font-mono text-zinc-100">
              {listening?.action === action ? (
                <span className="animate-pulse text-cyan-100">按新键...</span>
              ) : (
                codeLabel(bindings.p1[action])
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-200/10 pt-3 text-[11px]">
        <button onClick={resetDefaults} className="text-zinc-200/60 hover:text-zinc-100">
          恢复默认
        </button>
        <div className="text-zinc-200/50">点击按键项，再按键盘录入新键</div>
      </div>
    </OverlayShell>
  )
}

function StartOverlay({ onStart }: { onStart: () => void }) {
  const bindings = useKeyBindingsStore((s) => s.bindings)
  const phase = useGameUiStore((s) => s.phase)
  if (phase !== "start") return null

  return (
    <OverlayShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">DEMO</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">像素机甲对战</div>
          <div className="mt-2 text-sm text-zinc-200/80">
            近战攻击 + 弹簧拳 + 防御减伤。血量归零即胜负结算。
          </div>
        </div>
        <button
          onClick={onStart}
          className="shrink-0 border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/25"
        >
          开始（Space）
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 text-[11px] tracking-[0.22em] text-zinc-200/70">P1</div>
          <div className="grid gap-2">
            <ControlRow left="移动" right={`${codeLabel(bindings.p1.left)} / ${codeLabel(bindings.p1.right)}`} />
            <ControlRow left="攻击" right={codeLabel(bindings.p1.attack)} />
            <ControlRow left="防御" right={`${codeLabel(bindings.p1.defend)}（单机）`} />
            <ControlRow left="大招" right={codeLabel(bindings.p1.skill)} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] tracking-[0.22em] text-zinc-200/70">P2 / BOSS</div>
          <div className="grid gap-2">
            <ControlRow left="移动" right={`${codeLabel("ArrowLeft")} / ${codeLabel("ArrowRight")}`} />
            <ControlRow left="攻击" right={codeLabel("Slash")} />
            <ControlRow left="防御" right={codeLabel("Period")} />
            <ControlRow left="大招" right={"Comma（,）"} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200/10 pt-4 text-xs text-zinc-200/70">
        <div>{codeLabel(DEFAULT_KEYS.restart)}：重开</div>
        <div>{codeLabel(DEFAULT_KEYS.pause)}：暂停</div>
        <div>建议全屏体验</div>
      </div>
    </OverlayShell>
  )
}

function ResultOverlay({ winner, onRestart, onNextLevel }: { winner: "p1" | "p2"; onRestart: () => void; onNextLevel?: () => void }) {
  const mode = useGameUiStore((s) => s.mode)
  const currentLevel = useGameUiStore((s) => s.currentLevel)
  const phase = useGameUiStore((s) => s.phase)
  if (phase !== "result") return null

  const playerWon = winner === "p1"
  const isFinalBoss = currentLevel >= 5 && mode === "ai"

  return (
    <OverlayShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">RESULT</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {playerWon ? (isFinalBoss ? "全部通关！" : `${mode === "ai" ? `第${currentLevel}关` : ""} 胜利`) : "失败"}
          </div>
          <div className="mt-2 text-sm text-zinc-200/80">
            {playerWon
              ? isFinalBoss
                ? "五关已全部通关，你击败了钢铁霸主！"
                : mode === "ai"
                  ? `准备进入第 ${currentLevel + 1} 关`
                  : "再来一局，找回那种街机按键的节奏。"
              : mode === "ai"
                ? "重新挑战本关"
                : "再来一局"}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {playerWon && !isFinalBoss && mode === "ai" ? (
            <button
              onClick={onNextLevel}
              className="border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/25"
            >
              下一关（Space）
            </button>
          ) : null}
          <button
            onClick={onRestart}
            className="border border-orange-300/40 bg-orange-400/15 px-4 py-2 text-sm text-orange-100 hover:bg-orange-400/25"
          >
            {mode === "ai" && !playerWon ? "重试（R）" : isFinalBoss ? "再来（R）" : "再来一局（R）"}
          </button>
        </div>
      </div>
    </OverlayShell>
  )
}

function LevelIntroOverlay({ level, onStart }: { level: number; onStart: () => void }) {
  const boss = BOSSES[level - 1]
  const phase = useGameUiStore((s) => s.phase)
  if (phase !== "start") return null
  if (!boss) return null

  return (
    <OverlayShell>
      <div className="text-center">
        <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">STAGE {boss.level}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{boss.name}</div>
        <div className="mt-3 flex items-center justify-center gap-6 text-sm text-zinc-200/80">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: boss.primaryColor }} />
            <span>HP {boss.hp}</span>
          </div>
        </div>
        <div className="mt-1 text-xs text-zinc-200/60">
          第{boss.level}关 / 共5关
        </div>
      </div>

      <button
        onClick={onStart}
        className="mx-auto mt-5 block border border-cyan-300/40 bg-cyan-400/15 px-6 py-2 text-sm text-cyan-100 hover:bg-cyan-400/25"
      >
        开始战斗（Space）
      </button>
    </OverlayShell>
  )
}

function ControlsIntroOverlay({ onStart, onSettings }: { onStart: () => void; onSettings: () => void }) {
  const bindings = useKeyBindingsStore((s) => s.bindings)

  return (
    <OverlayShell>
      <div className="text-center">
        <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">MECHA DUEL</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">像素机甲对战</div>
        <div className="mt-2 text-sm text-zinc-200/80">操作说明 · 规则速览</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <div className="mb-2 text-[11px] tracking-[0.22em] text-cyan-100/90">P1 操作</div>
          <div className="grid gap-1.5 text-[12px] text-zinc-200/80">
            <div>移动：{codeLabel(bindings.p1.left)} / {codeLabel(bindings.p1.right)}</div>
            <div>近战攻击：{codeLabel(bindings.p1.attack)}（伤害10）</div>
            <div>防御（霸体5秒）：{codeLabel(bindings.p1.defend)}（冷却3秒）</div>
            <div>大招（冷却5秒）：{codeLabel(bindings.p1.skill)}（伤害30）</div>
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] tracking-[0.22em] text-orange-100/90">P2 / BOSS</div>
          <div className="grid gap-1.5 text-[12px] text-zinc-200/80">
            <div>移动：← / →</div>
            <div>近战攻击：/（伤害10）</div>
            <div>防御（霸体3秒）：.（冷却5秒）</div>
            <div>大招（冷却5秒）：,（伤害30）</div>
          </div>
        </div>
      </div>

      <div className="mt-4 px-2 py-3 bg-zinc-950/50 ring-1 ring-zinc-200/10 text-[11px] text-zinc-200/70 leading-relaxed">
        <div className="font-semibold text-zinc-200/90 mb-1 text-center">战斗规则</div>
        <div className="grid gap-1 text-center">
          <div>▸ 防御为霸体技，单机触发持续 5 秒（冷却 3 秒）</div>
          <div>▸ BOSS 霸体持续 3 秒（冷却 5 秒）</div>
          <div>▸ 霸体期间防御减伤 80% —— 攻击 10→2，大招 30→6</div>
          <div>▸ 大招有 0.35 秒前摇，期间双方无法操作，画面慢动作</div>
          <div>▸ BOSS 释放大招时，玩家可开霸体但无法攻击</div>
          <div>▸ 大招命中造成 30 伤害；若防御则仅受 6 伤害</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-zinc-200/60">
        <span>通用：</span>
        <span className="text-zinc-200/80">{codeLabel(DEFAULT_KEYS.start[0])}</span>开始
        <span className="text-zinc-200/80 ml-2">{codeLabel(DEFAULT_KEYS.pause)}</span>暂停
        <span className="text-zinc-200/80 ml-2">{codeLabel(DEFAULT_KEYS.restart)}</span>重开
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={onStart}
          className="border border-cyan-300/40 bg-cyan-400/15 px-5 py-2 text-sm text-cyan-100 hover:bg-cyan-400/25"
        >
          开始游戏（Space）
        </button>
        <button
          onClick={onSettings}
          className="border border-zinc-200/20 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-950/70"
        >
          按键设置
        </button>
      </div>
    </OverlayShell>
  )
}

export default function Home() {
  const vp = useViewport()
  const scale = vp.scale
  const simRef = useRef<SimState>(createSim())
  const setUi = useGameUiStore((s) => s.setUi)
  const mode = useGameUiStore((s) => s.mode)
  const phase = useGameUiStore((s) => s.phase)
  const winner = useGameUiStore((s) => s.winner)
  const currentLevel = useGameUiStore((s) => s.currentLevel)
  const bindings = useKeyBindingsStore((s) => s.bindings)

  const rawDownRef = useRef<Record<string, boolean>>({})
  const rawPressedRef = useRef<Record<string, boolean>>({})

  const [viewKey, setViewKey] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [showModeSelect, setShowModeSelect] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLevelIntro, setShowLevelIntro] = useState(false)

  const keyBlockList = useMemo(() => new Set(["ArrowLeft", "ArrowRight", "Space"]), [])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (keyBlockList.has(e.code)) e.preventDefault()
      rawDownRef.current[e.code] = true
      if (!e.repeat) rawPressedRef.current[e.code] = true
    }
    const onUp = (e: KeyboardEvent) => {
      if (keyBlockList.has(e.code)) e.preventDefault()
      rawDownRef.current[e.code] = false
    }
    window.addEventListener("keydown", onDown, { passive: false })
    window.addEventListener("keyup", onUp, { passive: false })
    return () => {
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
    }
  }, [keyBlockList])

  const resetState = useCallback(() => {
    simRef.current = createSim()
    setShowModeSelect(true)
    setShowLevelIntro(false)
    setUi({
      phase: "start",
      winner: null,
      mode: "pvp",
      currentLevel: 0,
      p1Hp: 100,
      p2Hp: 100,
      p1MaxHp: 100,
      p2MaxHp: 100,
      p1Status: "READY",
      p2Status: "READY",
    })
    setViewKey((k) => k + 1)
  }, [setUi])

  const startLevel = useCallback((level: number) => {
    const boss = BOSSES[level - 1]
    if (!boss) return
    simRef.current = createSim(boss)
    setShowLevelIntro(false)
    setShowModeSelect(false)
    setUi({
      phase: "playing",
      mode: "ai",
      currentLevel: level,
      winner: null,
      p1Hp: 100,
      p2Hp: boss.hp,
      p1MaxHp: 100,
      p2MaxHp: boss.hp,
      p1Status: "READY",
      p2Status: "READY",
    })
    simRef.current.phase = "playing"
    setViewKey((k) => k + 1)
  }, [setUi])

  const startPvp = useCallback(() => {
    simRef.current = createSim()
    setShowModeSelect(false)
    setShowLevelIntro(false)
    setUi({
      phase: "playing",
      mode: "pvp",
      currentLevel: 0,
      winner: null,
      p1Hp: 100,
      p2Hp: 100,
      p1MaxHp: 100,
      p2MaxHp: 100,
      p1Status: "READY",
      p2Status: "READY",
    })
    simRef.current.phase = "playing"
    setViewKey((k) => k + 1)
  }, [setUi])

  const startAi = useCallback(() => {
    setShowModeSelect(false)
    setShowLevelIntro(true)
    setUi({ phase: "start", mode: "ai", currentLevel: 1 })
    simRef.current = createSim(BOSSES[0])
    simRef.current.currentLevel = 1
  }, [setUi])

  const onControlsDone = useCallback(() => {
    setShowControls(false)
    setShowModeSelect(true)
  }, [])

  const onControlsSettings = useCallback(() => {
    setShowSettings(true)
  }, [])

  const onOpenSettings = useCallback(() => {
    const sim = simRef.current
    if (sim.phase === "playing") {
      sim.phase = "paused"
      setUi({ phase: "paused" })
    }
    setShowSettings(true)
  }, [setUi])

  const onRestart = useCallback(() => {
    if (mode === "ai" && currentLevel > 0) {
      startLevel(currentLevel)
    } else {
      resetState()
    }
  }, [mode, currentLevel, startLevel, resetState])

  const onNextLevel = useCallback(() => {
    const next = currentLevel + 1
    if (next <= 5) {
      startLevel(next)
    }
  }, [currentLevel, startLevel])

  useEffect(() => {
    if (mode === "ai" && currentLevel > 0 && !showLevelIntro) {
      simRef.current = createSim(BOSSES[currentLevel - 1])
      simRef.current.phase = "playing"
      setViewKey((k) => k + 1)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    let aiCooldownAttack = 0
    let aiCooldownRanged = 0

    const loop = (now: number) => {
      const dtMs = now - last
      last = now
      acc += Math.min(80, dtMs)

      const step = 1000 / 60
      while (acc >= step) {
        const sim = simRef.current
        const pressed = rawPressedRef.current
        rawPressedRef.current = {}
        const input = deriveInput(rawDownRef.current, pressed, bindings.p1)

        if (sim.mode === "ai" && sim.phase === "playing" && sim.p2.bossConfig) {
          aiCooldownAttack = Math.max(0, aiCooldownAttack - step / 1000)
          aiCooldownRanged = Math.max(0, aiCooldownRanged - step / 1000)

          const aiInput = computeAiInput(sim.p2, sim.p1, sim.p2.bossConfig, step / 1000, {
            attackT: aiCooldownAttack,
            rangedT: aiCooldownRanged,
          })

          if (aiInput.attack) aiCooldownAttack = sim.p2.bossConfig.attackCooldown
          if (aiInput.skill) aiCooldownRanged = sim.p2.bossConfig.rangedCooldown

          input.p2 = aiInput
        }

        stepSim(sim, input, step / 1000)
        setUi({
          phase: sim.phase,
          winner: sim.winner,
          p1Hp: clampHp(sim.p1.hp),
          p2Hp: clampHp(sim.p2.hp),
          p1MaxHp: sim.p1.maxHp,
          p2MaxHp: sim.p2.maxHp,
          p1Status: actionToStatus(sim.p1.action),
          p2Status: actionToStatus(sim.p2.action),
          p1DefendCooldown: sim.p1.defendCooldown,
          p1RangedCooldown: sim.p1.rangedCooldown,
          p2DefendCooldown: sim.p2.defendCooldown,
          p2RangedCooldown: sim.p2.rangedCooldown,
        })

        const slowMoFactor = sim.slowMoT > 0 ? 4 : 1
        acc -= step * slowMoFactor
      }

      const c = document.getElementById("pixel-canvas") as HTMLCanvasElement | null
      if (c) {
        const ctx = c.getContext("2d")
        if (ctx) drawFrame(ctx, simRef.current, { scale, time: simRef.current.t })
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [scale, setUi, bindings.p1])

  return (
    <div className="min-h-screen bg-[#050a0f] text-zinc-100">
      <div className="relative mx-auto grid min-h-screen place-items-center px-4 py-6">
        <div className="relative">
          <Hud />

          <div className="relative overflow-hidden border border-zinc-200/15 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_25px_80px_rgba(0,0,0,0.8)]">
            <canvas
              id="pixel-canvas"
              key={viewKey}
              className="block"
              width={LOGICAL_W * scale}
              height={LOGICAL_H * scale}
              style={{ width: LOGICAL_W * scale, height: LOGICAL_H * scale, imageRendering: "pixelated" }}
            />
          </div>

          {showControls ? <ControlsIntroOverlay onStart={onControlsDone} onSettings={onControlsSettings} /> : null}

          {!showControls && showModeSelect ? <ModeOverlay onPvp={startPvp} onAi={startAi} /> : null}

          {showLevelIntro && currentLevel > 0 && phase === "start" ? (
            <LevelIntroOverlay level={currentLevel} onStart={() => startLevel(currentLevel)} />
          ) : null}

          {!showModeSelect && !showLevelIntro && phase === "start" ? (
            <StartOverlay onStart={() => {
              if (mode === "ai" && currentLevel > 0) {
                startLevel(currentLevel)
              } else {
                startPvp()
              }
            }} />
          ) : null}

          {phase === "result" && winner ? (
            <ResultOverlay winner={winner} onRestart={onRestart} onNextLevel={onNextLevel} />
          ) : null}

          {phase === "paused" ? (
            <OverlayShell>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] tracking-[0.3em] text-zinc-200/70">PAUSED</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">暂停中</div>
                  <div className="mt-2 text-sm text-zinc-200/80">按 P 继续；按 R 重开。</div>
                </div>
                <button
                  onClick={() => {
                    simRef.current.phase = "playing"
                    setUi({ phase: "playing" })
                  }}
                  className="shrink-0 border border-zinc-200/20 bg-zinc-950/40 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-950/70"
                >
                  继续（P）
                </button>
              </div>
            </OverlayShell>
          ) : null}

          <div className="absolute bottom-1 right-1 z-20">
            <button
              onClick={onOpenSettings}
              className="border border-zinc-200/10 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-200/60 hover:text-zinc-100"
            >
              按键设置
            </button>
          </div>

          {showSettings ? <KeySettingsOverlay onClose={() => setShowSettings(false)} /> : null}
        </div>
      </div>
    </div>
  )
}
