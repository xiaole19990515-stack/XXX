export type BossConfig = {
  level: number
  name: string
  hp: number
  moveSpeed: number
  attackCooldown: number
  rangedCooldown: number
  primaryColor: string
  secondaryColor: string
  weaponColor: string
  bodyColor: string
  weaponShape: string
}

export const BOSSES: BossConfig[] = [
  {
    level: 1,
    name: "训练机",
    hp: 100,
    moveSpeed: 92,
    attackCooldown: 0.8,
    rangedCooldown: 2.5,
    primaryColor: "#ffb36b",
    secondaryColor: "#4b210f",
    weaponColor: "#ff6a3d",
    bodyColor: "#1b6b74",
    weaponShape: "fist",
  },
  {
    level: 2,
    name: "电击拳手",
    hp: 130,
    moveSpeed: 96,
    attackCooldown: 0.7,
    rangedCooldown: 2.0,
    primaryColor: "#ffd700",
    secondaryColor: "#5c3d00",
    weaponColor: "#ffff00",
    bodyColor: "#3d2b00",
    weaponShape: "claw",
  },
  {
    level: 3,
    name: "火焰臂",
    hp: 170,
    moveSpeed: 100,
    attackCooldown: 0.6,
    rangedCooldown: 1.8,
    primaryColor: "#ff4500",
    secondaryColor: "#5c0000",
    weaponColor: "#ff6600",
    bodyColor: "#4a1500",
    weaponShape: "axe",
  },
  {
    level: 4,
    name: "冰霜卫士",
    hp: 220,
    moveSpeed: 90,
    attackCooldown: 0.9,
    rangedCooldown: 2.2,
    primaryColor: "#00bfff",
    secondaryColor: "#002d5c",
    weaponColor: "#87ceeb",
    bodyColor: "#003366",
    weaponShape: "spear",
  },
  {
    level: 5,
    name: "钢铁霸主",
    hp: 300,
    moveSpeed: 105,
    attackCooldown: 0.5,
    rangedCooldown: 1.5,
    primaryColor: "#ff1493",
    secondaryColor: "#3d0020",
    weaponColor: "#ff69b4",
    bodyColor: "#2d0015",
    weaponShape: "hammer",
  },
]
