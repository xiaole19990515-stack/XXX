import type { BossConfig } from "./bosses"

export type Facing = "left" | "right"
export type Action = "idle" | "run" | "attack" | "defend" | "hit" | "dead" | "ranged"

export type PlayerId = "p1" | "p2"

export type InputSnapshot = {
  p1: { left: boolean; right: boolean; attack: boolean; defend: boolean; skill: boolean }
  p2: { left: boolean; right: boolean; attack: boolean; defend: boolean; skill: boolean }
  start: boolean
  restart: boolean
  pause: boolean
}

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type Projectile = {
  x: number
  y: number
  vx: number
  facing: Facing
  active: boolean
  returning: boolean
  maxDist: number
  startX: number
  hit: boolean
}

export type PlayerSim = {
  id: PlayerId
  x: number
  y: number
  vx: number
  facing: Facing
  hp: number
  maxHp: number
  action: Action
  actionT: number
  invulnT: number
  hitstopT: number
  attackHit: boolean
  projectile: Projectile | null
  bossConfig: BossConfig | null
  aiCooldown: { attackT: number; rangedT: number }
  defendTimer: number
  defendCooldown: number
  rangedCooldown: number
}

export type SimState = {
  phase: "start" | "playing" | "paused" | "result"
  winner: PlayerId | null
  t: number
  p1: PlayerSim
  p2: PlayerSim
  particles: Particle[]
  shakeT: number
  mode: "pvp" | "ai"
  currentLevel: number
  slowMoT: number
}

export const LOGICAL_W = 320
export const LOGICAL_H = 180

const GROUND_Y = 132
const ARENA_L = 24
const ARENA_R = LOGICAL_W - 24
const BODY_W = 18
const BODY_H = 28

const MAX_HP = 100
const MOVE_SPEED = 92
const DEFEND_SPEED = 62
const KNOCKBACK = 150

const ATTACK_TOTAL = 0.34
const ATTACK_STARTUP = 0.10
const ATTACK_ACTIVE = 0.07
const HITSTUN = 0.16
const INVULN = 0.24
const HITSTOP = 0.06

const ULT_TOTAL = 0.70
const ULT_STARTUP = 0.35
const ULT_SPEED = 250
const ULT_MAX_DIST = 100
const ULT_DAMAGE = 30

const DEFEND_MAX_DURATION = 5
const DEFEND_COOLDOWN = 3
const BOSS_DEFEND_DURATION = 3
const BOSS_DEFEND_COOLDOWN = 5
const ULT_COOLDOWN = 5

export const DEFAULT_KEYS = {
  p1: { left: "KeyA", right: "KeyD", attack: "KeyJ", defend: "KeyK", skill: "KeyL" },
  p2: { left: "ArrowLeft", right: "ArrowRight", attack: "Slash", defend: "Period", skill: "Comma" },
  start: ["Space", "Enter"],
  restart: "KeyR",
  pause: "KeyP",
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const rectsOverlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function makePlayerSim(id: PlayerId, x: number, boss: BossConfig | null): PlayerSim {
  return {
    id,
    x,
    y: GROUND_Y,
    vx: 0,
    facing: id === "p1" ? "right" : "left",
    hp: boss ? boss.hp : MAX_HP,
    maxHp: boss ? boss.hp : MAX_HP,
    action: "idle",
    actionT: 0,
    invulnT: 0,
    hitstopT: 0,
    attackHit: false,
    projectile: null,
    bossConfig: boss,
    aiCooldown: { attackT: 0, rangedT: 0 },
    defendTimer: 0,
    defendCooldown: 0,
    rangedCooldown: 0,
  }
}

export function createSim(boss: BossConfig | null = null): SimState {
  return {
    phase: "start",
    winner: null,
    t: 0,
    p1: makePlayerSim("p1", 110, null),
    p2: makePlayerSim("p2", 210, boss),
    particles: [],
    shakeT: 0,
    mode: boss ? "ai" : "pvp",
    currentLevel: boss ? boss.level : 0,
    slowMoT: 0,
  }
}

export function deriveInput(
  rawDown: Record<string, boolean>,
  rawPressed: Record<string, boolean>,
  p1Overrides?: { left: string; right: string; attack: string; defend: string; skill: string },
): InputSnapshot {
  const p1Keys = p1Overrides ?? DEFAULT_KEYS.p1

  const isDown = (code: string) => !!rawDown[code]
  const isDownAny = (codes: readonly string[]) => codes.some((c) => !!rawDown[c])
  const isPressed = (code: string) => !!rawPressed[code]
  const isPressedAny = (codes: readonly string[]) => codes.some((c) => !!rawPressed[c])

  return {
    p1: {
      left: isDown(p1Keys.left),
      right: isDown(p1Keys.right),
      attack: isPressed(p1Keys.attack),
      defend: isPressed(p1Keys.defend),
      skill: isPressed(p1Keys.skill),
    },
    p2: {
      left: isDown(DEFAULT_KEYS.p2.left),
      right: isDown(DEFAULT_KEYS.p2.right),
      attack: isPressed(DEFAULT_KEYS.p2.attack),
      defend: isPressed(DEFAULT_KEYS.p2.defend),
      skill: isPressed(DEFAULT_KEYS.p2.skill),
    },
    start: isPressedAny(DEFAULT_KEYS.start),
    restart: isPressed(DEFAULT_KEYS.restart),
    pause: isPressed(DEFAULT_KEYS.pause),
  }
}

function playerBodyRect(p: PlayerSim) {
  return { x: p.x - BODY_W / 2, y: p.y - BODY_H, w: BODY_W, h: BODY_H }
}

function playerHitbox(p: PlayerSim) {
  const reach = 20
  const w = 18
  const h = 14
  const y = p.y - 20
  const x = p.facing === "right" ? p.x + 10 : p.x - 10 - w
  return { x, y, w, h, reach }
}

function spawnSparks(sim: SimState, x: number, y: number, color: string, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count
    const sp = 70 + Math.random() * 70
    sim.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 30,
      life: 0.22 + Math.random() * 0.12,
      maxLife: 0.28,
      color,
      size: 2 + Math.floor(Math.random() * 2),
    })
  }
}

function beginAttack(p: PlayerSim) {
  p.action = "attack"
  p.actionT = 0
  p.attackHit = false
}

function beginUlt(p: PlayerSim) {
  p.action = "ranged"
  p.actionT = 0
  p.rangedCooldown = ULT_COOLDOWN
  p.projectile = null
}

function beginHit(p: PlayerSim) {
  p.action = "hit"
  p.actionT = 0
  p.invulnT = INVULN
  p.hitstopT = HITSTOP
  p.attackHit = false
}

function endRound(sim: SimState, winner: PlayerId) {
  sim.phase = "result"
  sim.winner = winner
  sim.p1.action = sim.p1.hp <= 0 ? "dead" : sim.p1.action
  sim.p2.action = sim.p2.hp <= 0 ? "dead" : sim.p2.action
}

export function stepSim(sim: SimState, input: InputSnapshot, dt: number) {
  sim.t += dt

  if (input.restart) {
    const next = createSim(sim.mode === "ai" ? sim.p2.bossConfig : null)
    Object.assign(sim, next)
    return
  }

  if (sim.phase === "start") {
    if (input.start) sim.phase = "playing"
    return
  }

  if (sim.phase === "result") return

  if (input.pause) sim.phase = sim.phase === "paused" ? "playing" : "paused"
  if (sim.phase === "paused") return

  const p1 = sim.p1
  const p2 = sim.p2

  p1.invulnT = Math.max(0, p1.invulnT - dt)
  p2.invulnT = Math.max(0, p2.invulnT - dt)
  p1.hitstopT = Math.max(0, p1.hitstopT - dt)
  p2.hitstopT = Math.max(0, p2.hitstopT - dt)
  p1.defendCooldown = Math.max(0, p1.defendCooldown - dt)
  p2.defendCooldown = Math.max(0, p2.defendCooldown - dt)
  p1.rangedCooldown = Math.max(0, p1.rangedCooldown - dt)
  p2.rangedCooldown = Math.max(0, p2.rangedCooldown - dt)

  sim.slowMoT = Math.max(0, sim.slowMoT - dt)

  const hitstop = Math.max(p1.hitstopT, p2.hitstopT)
  if (hitstop > 0) {
    sim.shakeT = Math.max(sim.shakeT, 0.08)
    sim.shakeT = Math.max(0, sim.shakeT - dt)
    return
  }

  sim.shakeT = Math.max(0, sim.shakeT - dt)

  const wantFacingP1: Facing = p1.x < p2.x ? "right" : "left"
  const wantFacingP2: Facing = p2.x < p1.x ? "right" : "left"
  if (p1.action !== "attack" && p1.action !== "ranged") p1.facing = wantFacingP1
  if (p2.action !== "attack" && p2.action !== "ranged") p2.facing = wantFacingP2

  const ultPlayer = p1.action === "ranged" && p1.actionT < ULT_STARTUP ? p1 :
                    p2.action === "ranged" && p2.actionT < ULT_STARTUP ? p2 : null

  if (ultPlayer) {
    ultPlayer.actionT += dt
    sim.slowMoT = 0.08
    sim.shakeT = Math.max(sim.shakeT, 0.04)
    if (ultPlayer.actionT >= ULT_STARTUP) {
      const other = ultPlayer === p1 ? p2 : p1
      ultPlayer.projectile = {
        x: ultPlayer.x,
        y: ultPlayer.y - 16,
        vx: ultPlayer.facing === "right" ? ULT_SPEED : -ULT_SPEED,
        facing: ultPlayer.facing,
        active: true,
        returning: false,
        maxDist: ULT_MAX_DIST,
        startX: ultPlayer.x,
        hit: false,
      }
      updateProjectile(ultPlayer, other, sim)
    }
    if (ultPlayer.actionT >= ULT_TOTAL) {
      ultPlayer.action = "idle"
      ultPlayer.actionT = 0
      ultPlayer.projectile = null
    }
    return
  }

  const updatePlayer = (
    p: PlayerSim,
    other: PlayerSim,
    keys: InputSnapshot["p1"],
  ) => {
    if (p.action === "dead") return

    if (p.action === "hit") {
      p.actionT += dt
      if (p.actionT >= HITSTUN) {
        p.action = "idle"
        p.actionT = 0
      }
      return
    }

    if (p.action === "attack") {
      p.actionT += dt
      if (p.actionT >= ATTACK_TOTAL) {
        p.action = "idle"
        p.actionT = 0
      }
      return
    }

    if (p.action === "ranged") {
      p.actionT += dt
      updateProjectile(p, other, sim)
      if (p.actionT >= ULT_TOTAL) {
        p.action = "idle"
        p.actionT = 0
        p.projectile = null
      }
      return
    }

    const isPlayer = p.id === "p1"
    if (isPlayer && keys.defend && p.defendCooldown <= 0 && p.action !== "defend") {
      p.action = "defend"
      p.defendTimer = DEFEND_MAX_DURATION
    }

    let defendJustEnded = false
    if (p.action === "defend") {
      if (isPlayer) {
        p.defendTimer = Math.max(0, p.defendTimer - dt)
        if (p.defendTimer <= 0) {
          p.action = "idle"
          p.actionT = 0
          p.defendCooldown = DEFEND_COOLDOWN
          defendJustEnded = true
        }
      } else {
        p.action = "idle"
        p.actionT = 0
      }
    }

    if (keys.attack && !defendJustEnded) beginAttack(p)

    if (keys.skill && !defendJustEnded && p.rangedCooldown <= 0) beginUlt(p)

    const speed = p.action === "defend" ? DEFEND_SPEED : MOVE_SPEED
    const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    p.vx = move * speed
    p.x += p.vx * dt

    const minX = ARENA_L + BODY_W / 2
    const maxX = ARENA_R - BODY_W / 2
    p.x = clamp(p.x, minX, maxX)

    if (move !== 0 && p.action === "idle") {
      p.action = "run"
      p.actionT = 0
    } else if (move === 0 && p.action === "run") {
      p.action = "idle"
      p.actionT = 0
    } else if (p.action === "idle" || p.action === "run") {
      p.actionT += dt
    }
  }

  const isBossUltActive = p2.action === "ranged" && !p2.projectile?.hit && sim.mode === "ai"
  if (isBossUltActive) {
    updatePlayer(p1, p2, { ...input.p1, attack: false, skill: false })
  } else {
    updatePlayer(p1, p2, input.p1)
  }
  updatePlayer(p2, p1, input.p2)

  const resolvePush = () => {
    const dx = p2.x - p1.x
    const minDist = BODY_W
    if (Math.abs(dx) < minDist) {
      const push = (minDist - Math.abs(dx)) / 2
      if (dx >= 0) {
        p1.x -= push
        p2.x += push
      } else {
        p1.x += push
        p2.x -= push
      }
      const minX = ARENA_L + BODY_W / 2
      const maxX = ARENA_R - BODY_W / 2
      p1.x = clamp(p1.x, minX, maxX)
      p2.x = clamp(p2.x, minX, maxX)
    }
  }
  resolvePush()

  const tryHit = (atk: PlayerSim, def: PlayerSim) => {
    if (atk.action !== "attack") return
    if (atk.attackHit) return
    if (def.invulnT > 0) return

    const t = atk.actionT
    if (t < ATTACK_STARTUP || t > ATTACK_STARTUP + ATTACK_ACTIVE) return

    const hb = playerHitbox(atk)
    const body = playerBodyRect(def)
    const hit = rectsOverlap({ x: hb.x, y: hb.y, w: hb.w, h: hb.h }, body)
    if (!hit) return

    atk.attackHit = true
    const isBlock = def.action === "defend"
    const dmg = isBlock ? 2 : 10
    def.hp = clamp(def.hp - dmg, 0, def.maxHp)
    def.vx = (atk.facing === "right" ? 1 : -1) * (isBlock ? KNOCKBACK * 0.45 : KNOCKBACK)
    def.x += def.vx * 0.04

    const fxX = lerp(hb.x + hb.w / 2, body.x + body.w / 2, 0.5)
    const fxY = hb.y + hb.h / 2
    spawnSparks(sim, fxX, fxY, isBlock ? "#4dd7ff" : "#ff6a3d")
    if (!isBlock) beginHit(def)
    sim.shakeT = Math.max(sim.shakeT, isBlock ? 0.05 : 0.11)

    if (def.hp <= 0) endRound(sim, atk.id)
  }

  tryHit(p1, p2)
  tryHit(p2, p1)

  const updateParticles = () => {
    const next: Particle[] = []
    for (const pt of sim.particles) {
      const life = pt.life - dt
      if (life <= 0) continue
      const g = 220
      const vy = pt.vy + g * dt
      next.push({
        ...pt,
        x: pt.x + pt.vx * dt,
        y: pt.y + vy * dt,
        vy,
        life,
      })
    }
    sim.particles = next
  }

  updateParticles()
}

function updateProjectile(p: PlayerSim, other: PlayerSim, sim: SimState) {
  const proj = p.projectile
  if (!proj || !proj.active) return

  if (proj.returning) {
    const dx = p.x - proj.x
    const dy = (p.y - 16) - proj.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 10) {
      proj.active = false
      p.projectile = null
      return
    }
    const speed = ULT_SPEED * 1.5
    proj.x += (dx / d) * speed * (1 / 60)
    proj.y += (dy / d) * speed * (1 / 60)
    return
  }

  proj.x += proj.vx * (1 / 60)

  const dist = Math.abs(proj.x - proj.startX)
  if (dist >= proj.maxDist) {
    proj.returning = true
    return
  }

  if (!proj.hit && other.invulnT <= 0) {
    const pw = 6
    const ph = 6
    const body = playerBodyRect(other)
    if (rectsOverlap({ x: proj.x - pw / 2, y: proj.y - ph / 2, w: pw, h: ph }, body)) {
      proj.hit = true
      proj.returning = true
      const isBlock = other.action === "defend"
      const dmg = isBlock ? Math.floor(ULT_DAMAGE * 0.2) : ULT_DAMAGE
      other.hp = clamp(other.hp - dmg, 0, other.maxHp)
      spawnSparks(sim, proj.x, proj.y, "#ff6a3d", 16)
      beginHit(other)
      sim.shakeT = Math.max(sim.shakeT, 0.15)
      if (other.hp <= 0) endRound(sim, p.id)
    }
  }
}

type DrawOpts = { scale: number; time: number }

export function drawFrame(ctx: CanvasRenderingContext2D, sim: SimState, opts: DrawOpts) {
  const { scale, time } = opts

  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = false

  const shake = sim.shakeT > 0 ? (Math.random() * 2 - 1) * sim.shakeT * 6 : 0
  ctx.translate(shake, 0)

  ctx.fillStyle = "#071016"
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

  drawBackdrop(ctx, time)
  drawGround(ctx, time)

  const p2Colors = sim.p2.bossConfig
    ? {
        primary: sim.p2.bossConfig.primaryColor,
        secondary: sim.p2.bossConfig.secondaryColor,
        weapon: sim.p2.bossConfig.weaponColor,
        body: sim.p2.bossConfig.bodyColor,
        weaponShape: sim.p2.bossConfig.weaponShape,
      }
    : {
        primary: "#ffb36b",
        secondary: "#4b210f",
        weapon: "#ff6a3d",
        body: "#1b6b74",
        weaponShape: "fist",
      }

  drawPlayer(ctx, sim.p1, time, { primary: "#7cf5ff", secondary: "#12404d", weapon: "#ff6a3d", body: "#1b6b74", weaponShape: "fist" })
  drawPlayer(ctx, sim.p2, time, p2Colors)
  drawParticles(ctx, sim)
  drawUltWarningOverlay(ctx, sim)

  if (sim.p1.projectile?.active) drawProjectile(ctx, sim.p1.projectile, "#7cf5ff")
  if (sim.p2.projectile?.active) drawProjectile(ctx, sim.p2.projectile, p2Colors.weapon)

  ctx.restore()
}

function drawUltWarningOverlay(ctx: CanvasRenderingContext2D, sim: SimState) {
  if (sim.slowMoT > 0) {
    const alpha = 0.06 + Math.sin(sim.t * 60) * 0.03
    ctx.fillStyle = `rgba(255,80,200,${alpha})`
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, time: number) {
  ctx.fillStyle = "#0b1c1f"
  ctx.fillRect(0, 0, LOGICAL_W, 108)

  ctx.fillStyle = "#0f2b2a"
  for (let x = 0; x < LOGICAL_W; x += 18) {
    const h = 16 + Math.floor(Math.sin(time * 0.7 + x * 0.03) * 4)
    ctx.fillRect(x, 16, 10, h)
  }

  ctx.fillStyle = "#103038"
  for (let x = 0; x < LOGICAL_W; x += 40) {
    ctx.fillRect(x + 10, 46, 6, 42)
  }

  ctx.fillStyle = "#1b4a49"
  for (let x = 0; x < LOGICAL_W; x += 20) {
    const y = 92 + ((x / 20) % 2 === 0 ? 0 : 2)
    ctx.fillRect(x, y, 18, 3)
  }
}

function drawGround(ctx: CanvasRenderingContext2D, time: number) {
  ctx.fillStyle = "#0a151a"
  ctx.fillRect(0, 108, LOGICAL_W, LOGICAL_H - 108)

  ctx.fillStyle = "#10242b"
  ctx.fillRect(0, 120, LOGICAL_W, 48)

  ctx.fillStyle = "#16333b"
  for (let x = 0; x < LOGICAL_W; x += 16) {
    const o = Math.floor((time * 30 + x) % 16)
    ctx.fillRect(x, 124 + o * 0.02, 8, 1)
  }

  ctx.fillStyle = "#234c2f"
  ctx.fillRect(0, 136, LOGICAL_W, 2)

  ctx.fillStyle = "#1a3a24"
  for (let x = 0; x < LOGICAL_W; x += 12) {
    ctx.fillRect(x + ((x / 12) % 2 === 0 ? 0 : 2), 140, 8, 1)
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerSim,
  time: number,
  colors: { primary: string; secondary: string; weapon: string; body: string; weaponShape: string },
) {
  const bob = p.action === "run" ? Math.sin(time * 18 + (p.id === "p1" ? 0 : 1.2)) * 1.5 : 0
  const lean = p.action === "attack" ? Math.min(1, p.actionT / 0.08) * 2 : 0
  const hurtBlink = p.invulnT > 0 && Math.floor(time * 18) % 2 === 0

  const x = Math.round(p.x)
  const y = Math.round(p.y + bob)

  if (hurtBlink) ctx.globalAlpha = 0.35

  const dir = p.facing === "right" ? 1 : -1
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(dir, 1)
  ctx.translate(0, -BODY_H)

  const bodyC = p.action === "defend" ? (colors.body || colors.secondary) : colors.primary
  const edgeC = colors.secondary
  const weapC = colors.weapon

  const isUltWindup = p.action === "ranged" && p.actionT < ULT_STARTUP && p.projectile === null
  const pulseBright = isUltWindup ? "#ffffff" : colors.primary
  const finalBodyC = isUltWindup ? pulseBright : bodyC

  drawPixelRect(ctx, -9, 10, 18, 18, finalBodyC)
  drawPixelRect(ctx, -7, 0, 14, 12, finalBodyC)

  drawPixelRect(ctx, -10, 10, 2, 18, edgeC)
  drawPixelRect(ctx, 8, 10, 2, 18, edgeC)
  drawPixelRect(ctx, -8, 8, 16, 2, edgeC)

  drawPixelRect(ctx, -7, 3, 4, 2, "#d7f8ff")
  drawPixelRect(ctx, -1, 3, 4, 2, "#d7f8ff")

  drawPixelRect(ctx, -8, 28, 6, 6, edgeC)
  drawPixelRect(ctx, 2, 28, 6, 6, edgeC)
  drawPixelRect(ctx, -7, 29, 4, 4, "#0a0f12")
  drawPixelRect(ctx, 3, 29, 4, 4, "#0a0f12")

  const armY = 14 + (p.action === "attack" || p.action === "ranged" ? -2 : 0)
  const armX = p.action === "attack" ? 10 + lean : 9
  const armW = 10
  drawPixelRect(ctx, 0, armY, armW, 4, edgeC)
  drawPixelRect(ctx, armX, armY - 1, 6, 6, p.action === "attack" ? weapC : (isUltWindup ? "#ffffff" : bodyC))

  drawWeapon(ctx, colors.weaponShape, armX, armY, weapC, edgeC, p.action)

  if (p.action === "defend") {
    const pulse = Math.sin(time * 20) * 2
    const ox = -10 - pulse
    const oy = -2 + pulse * 0.5
    const ow = 20 + pulse * 2
    const oh = 28 + pulse
    drawPixelRect(ctx, ox, oy, ow, oh, "rgba(46,227,255,0.10)")
    drawPixelRect(ctx, ox - 1, oy - 1, ow + 2, oh + 2, "rgba(46,227,255,0.06)")
  }

  if (p.action === "ranged" && p.projectile?.returning === false) {
    const extension = Math.min(1, (p.actionT - ULT_STARTUP) / 0.08)
    const len = Math.round(extension * 30)
    drawPixelRect(ctx, 14, armY + 1, len, 3, edgeC)
    drawPixelRect(ctx, 14 + len, armY - 2, 8, 8, weapC)
  }

  ctx.restore()
  ctx.globalAlpha = 1

  if (p.action === "attack") {
    const t = p.actionT
    if (t >= ATTACK_STARTUP && t <= ATTACK_STARTUP + ATTACK_ACTIVE) {
      const hb = playerHitbox(p)
      ctx.fillStyle = "rgba(255,255,255,0.08)"
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h)
    }
  }
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  shape: string,
  armX: number,
  armY: number,
  color: string,
  edge: string,
  action: Action,
) {
  const wx = armX + 6
  const wy = armY - 2

  switch (shape) {
    case "claw":
      drawPixelRect(ctx, wx, wy, 6, 4, edge)
      drawPixelRect(ctx, wx + 4, wy - 2, 2, 3, color)
      drawPixelRect(ctx, wx + 4, wy + 3, 2, 3, color)
      break
    case "axe":
      drawPixelRect(ctx, wx, wy - 4, 8, 4, color)
      drawPixelRect(ctx, wx + 2, wy - 2, 4, 4, edge)
      drawPixelRect(ctx, wx + 1, wy - 7, 6, 3, edge)
      break
    case "spear":
      drawPixelRect(ctx, wx + 2, wy - 8, 2, 8, "white")
      drawPixelRect(ctx, wx, wy - 10, 6, 2, color)
      drawPixelRect(ctx, wx + 2, wy - 12, 2, 2, color)
      break
    case "hammer":
      drawPixelRect(ctx, wx - 2, wy - 6, 10, 6, color)
      drawPixelRect(ctx, wx, wy - 4, 6, 3, "white")
      drawPixelRect(ctx, wx + 3, wy + 1, 2, 3, edge)
      break
    default:
      drawPixelRect(ctx, wx, wy, 4, 4, color)
      break
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile, color: string) {
  const px = Math.round(proj.x)
  const py = Math.round(proj.y)

  if (proj.returning) {
    ctx.globalAlpha = 0.6
  }

  drawPixelRect(ctx, px - 4, py - 4, 8, 8, color)
  drawPixelRect(ctx, px - 1, py - 1, 2, 2, "#ffffff")

  if (!proj.returning && !proj.hit) {
    drawPixelRect(ctx, px - 6, py - 1, 2, 2, "#ffffff")
    drawPixelRect(ctx, px + 4, py - 1, 2, 2, "#ffffff")
  }

  ctx.globalAlpha = 1
}

function drawParticles(ctx: CanvasRenderingContext2D, sim: SimState) {
  for (const pt of sim.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1)
    ctx.globalAlpha = a
    ctx.fillStyle = pt.color
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size)
  }
  ctx.globalAlpha = 1
}

function drawPixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
