import { cn } from "@/lib/utils"
import { useGameUiStore } from "@/store/useGameUiStore"

function HpBar(props: { value: number; side: "left" | "right" }) {
  const pct = Math.max(0, Math.min(100, props.value))
  const fill =
    props.side === "left"
      ? "bg-gradient-to-r from-cyan-300 via-cyan-200 to-cyan-100"
      : "bg-gradient-to-l from-orange-300 via-orange-200 to-orange-100"
  return (
    <div className="h-3 w-[140px] bg-black/60 ring-1 ring-white/15">
      <div className={cn("h-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatusPill(props: { label: string; tone: "cyan" | "orange" }) {
  const tone =
    props.tone === "cyan"
      ? "bg-cyan-400/20 text-cyan-100 ring-cyan-200/30"
      : "bg-orange-400/20 text-orange-100 ring-orange-200/30"
  return (
    <div className={cn("px-2 py-0.5 text-[11px] tracking-widest ring-1", tone)}>{props.label}</div>
  )
}

export default function Hud(props: { className?: string }) {
  const phase = useGameUiStore((s) => s.phase)
  const p1Hp = useGameUiStore((s) => s.p1Hp)
  const p2Hp = useGameUiStore((s) => s.p2Hp)
  const p1Status = useGameUiStore((s) => s.p1Status)
  const p2Status = useGameUiStore((s) => s.p2Status)

  return (
    <div className={cn("pointer-events-none absolute left-0 top-0 w-full p-3", props.className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[11px] tracking-widest text-cyan-100/90">P1</div>
          <HpBar value={p1Hp} side="left" />
          <StatusPill label={p1Status} tone="cyan" />
        </div>
        <div className="flex items-center gap-2">
          <StatusPill label={p2Status} tone="orange" />
          <HpBar value={p2Hp} side="right" />
          <div className="text-[11px] tracking-widest text-orange-100/90">P2</div>
        </div>
      </div>

      {phase === "paused" ? (
        <div className="mt-2 text-center text-[11px] tracking-widest text-white/70">
          PAUSED · 按 P 继续
        </div>
      ) : null}
    </div>
  )
}

