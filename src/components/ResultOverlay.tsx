import { cn } from "@/lib/utils"
import { useGameUiStore } from "@/store/useGameUiStore"

export default function ResultOverlay(props: { className?: string }) {
  const phase = useGameUiStore((s) => s.phase)
  const winner = useGameUiStore((s) => s.winner)
  if (phase !== "result") return null

  return (
    <div className={cn("absolute inset-0 grid place-items-center p-5", props.className)}>
      <div className="w-full max-w-[360px] bg-black/60 p-4 text-center ring-1 ring-white/15 backdrop-blur">
        <div className="text-[11px] tracking-[0.4em] text-white/60">RESULT</div>
        <div className="mt-2 text-[22px] tracking-widest text-white/90">{winner === "p1" ? "P1 胜利" : "P2 胜利"}</div>
        <div className="mt-3 text-[12px] tracking-widest text-white/75">按 R 再来一局</div>
      </div>
    </div>
  )
}

