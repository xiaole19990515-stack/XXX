import { cn } from "@/lib/utils"
import { useGameUiStore } from "@/store/useGameUiStore"
import type { KeyLegend } from "@/components/GameCanvas"

function KeyChip(props: { k: string }) {
  return <span className="inline-flex items-center bg-white/10 px-1.5 py-0.5 text-[11px] ring-1 ring-white/15">{props.k}</span>
}

export default function StartOverlay(props: { className?: string; legend: KeyLegend | null }) {
  const phase = useGameUiStore((s) => s.phase)
  if (phase !== "start") return null

  const lg = props.legend

  return (
    <div className={cn("absolute inset-0 grid place-items-center p-5", props.className)}>
      <div className="w-full max-w-[420px] bg-black/55 p-4 ring-1 ring-white/15 backdrop-blur">
        <div className="text-center text-[22px] tracking-[0.35em] text-white/90">MECHA DUEL</div>
        <div className="mt-1 text-center text-[12px] tracking-widest text-white/60">双人同屏像素对战 Demo</div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="bg-white/5 p-3 ring-1 ring-white/10">
            <div className="text-[11px] tracking-widest text-cyan-100/90">P1</div>
            <div className="mt-2 grid gap-1 text-[12px] text-white/75">
              <div className="flex items-center justify-between gap-2">
                <span>移动</span>
                <span className="flex gap-1">
                  <KeyChip k={lg?.p1.left ?? "A"} />
                  <KeyChip k={lg?.p1.right ?? "D"} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>攻击</span>
                <KeyChip k={lg?.p1.attack ?? "J"} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>防御</span>
                <KeyChip k={lg?.p1.defend ?? "K"} />
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-3 ring-1 ring-white/10">
            <div className="text-[11px] tracking-widest text-orange-100/90">P2</div>
            <div className="mt-2 grid gap-1 text-[12px] text-white/75">
              <div className="flex items-center justify-between gap-2">
                <span>移动</span>
                <span className="flex gap-1">
                  <KeyChip k={lg?.p2.left ?? "←"} />
                  <KeyChip k={lg?.p2.right ?? "→"} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>攻击</span>
                <KeyChip k={lg?.p2.attack ?? "/"} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>防御</span>
                <KeyChip k={lg?.p2.defend ?? "."} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-[12px] text-white/70">
          <div className="flex items-center gap-2">
            <span>开始</span>
            <span className="flex gap-1">
              <KeyChip k={lg?.start ?? "Space / Enter"} />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>暂停</span>
            <KeyChip k={lg?.pause ?? "P"} />
            <span>重开</span>
            <KeyChip k={lg?.restart ?? "R"} />
          </div>
        </div>

        <div className="mt-4 text-center text-[12px] tracking-widest text-white/85">
          按 {lg?.start ?? "Space / Enter"} 开始
        </div>
      </div>
    </div>
  )
}

