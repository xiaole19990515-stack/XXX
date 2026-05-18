import type { BossConfig } from "./bosses"
import type { PlayerSim } from "./game"

export type AiInput = {
  left: boolean
  right: boolean
  attack: boolean
  defend: boolean
  skill: boolean
}

export function computeAiInput(
  self: PlayerSim,
  enemy: PlayerSim,
  boss: BossConfig,
  dt: number,
  cooldowns: { attackT: number; rangedT: number },
): AiInput {
  const dx = enemy.x - self.x
  const dist = Math.abs(dx)
  const facingEnemy = dx > 0

  if (self.action === "hit" || self.action === "dead") {
    return { left: false, right: false, attack: false, defend: false, skill: false }
  }

  let left = false
  let right = false
  let attack = false
  let defend = false
  let skill = false

  const meleeRange = 30
  const skillRange = 70

  if (dist > meleeRange) {
    if (facingEnemy) right = true
    else left = true
  }

  const enemyAttacking = enemy.action === "attack" || enemy.action === "ranged"
  if (enemyAttacking && dist < 40) {
    defend = true
  }

  if (cooldowns.attackT <= 0 && dist < meleeRange && !enemyAttacking) {
    attack = true
  }

  if (cooldowns.rangedT <= 0 && dist > meleeRange && dist < skillRange && !attack) {
    skill = true
  }

  return { left, right, attack, defend, skill }
}
