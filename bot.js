const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const Vec3 = require('vec3')
let mcData = null

const bot = mineflayer.createBot({
  host: 'TeamBeastFree.aternos.me',
  port: 32660,
  username: 'AFKbot',
  version: false // auto-detect version
})

bot.loadPlugin(pathfinder)

function safeChat(msg) {
  try {
    const chatResult = bot.chat(msg)
    if (chatResult && typeof chatResult.catch === 'function') {
      chatResult.catch(() => {})
    }
  } catch {}
}

bot.once('spawn', () => {
  mcData = require('minecraft-data')(bot.version)
  const defaultMove = new Movements(bot, mcData)
  bot.pathfinder.setMovements(defaultMove)

  safeChat('/login afk1234')
  safeChat('AFKbot is now on guard! 🗡️')

  setInterval(() => {
    equipGear()
    checkHunger()
    if (attackerEntity) {
      retaliateIfNeeded()
    } else {
      followNearestPlayer()
    }
  }, 2000)
})

// Equip best sword and armor
function equipGear() {
  const sword = bot.inventory.items().find(item => item.name.includes('sword'))
  if (sword) bot.equip(sword, 'hand').catch(() => {})

  const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots']
  const slots = ['head', 'torso', 'legs', 'feet']
  for (let i = 0; i < slots.length; i++) {
    const item = bot.inventory.items().find(it => it.name.includes(armorTypes[i]))
    if (item) bot.equip(item, slots[i]).catch(() => {})
  }
}

// Eat golden apple when hungry or low HP
function checkHunger() {
  if ((bot.food !== undefined && bot.food < 16) || bot.health < 10) {
    const gapple = bot.inventory.items().find(item => item.name.includes('golden_apple'))
    if (gapple) {
      bot.equip(gapple, 'hand').then(() => {
        bot.consume().catch(() => {})
        safeChat('🍎 Golden Apple Power Activated!')
      }).catch(() => {})
    }
  }
}

let attackerEntity = null

// Listen for the bot getting hurt to know attacker
bot.on('entityHurt', (entity) => {
  if (entity === bot.entity) {
    const attacker = findLastAttacker()
    if (attacker) {
      attackerEntity = attacker
      safeChat(`⚔️ I was attacked by ${attacker.username || attacker.name}! Retaliating!`)
    }
  }
})

// Helper to find who last attacked the bot (nearest hostile recently)
function findLastAttacker() {
  const nearbyEntities = Object.values(bot.entities).filter(e => {
    if (!e.position || e === bot.entity) return false
    const dist = bot.entity.position.distanceTo(e.position)
    return dist < 15 && (e.type === 'player' || e.type === 'mob')
  })
  nearbyEntities.sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))
  return nearbyEntities[0] || null
}

function retaliateIfNeeded() {
  if (!attackerEntity || !attackerEntity.position) {
    bot.pathfinder.setGoal(null)
    attackerEntity = null
    return
  }
  const dist = bot.entity.position.distanceTo(attackerEntity.position)
  if (dist > 100) {
    // Target is too far, forget attacker
    attackerEntity = null
    bot.pathfinder.setGoal(null)
    return
  }

  if (dist <= 4) {
    bot.attack(attackerEntity)
    bot.pathfinder.setGoal(null)
  } else {
    bot.pathfinder.setGoal(new goals.GoalFollow(attackerEntity, 2), true)
  }
}

function followNearestPlayer() {
  if (attackerEntity) return; // Don't follow if fighting

  const players = Object.values(bot.players)
    .filter(p => p.username !== bot.username && p.entity)

  if (players.length === 0) {
    bot.pathfinder.setGoal(null)
    return
  }

  let nearest = null
  let nearestDistance = Infinity
  const botPos = bot.entity.position

  for (const player of players) {
    const dist = botPos.distanceTo(player.entity.position)
    if (dist < nearestDistance) {
      nearest = player.entity
      nearestDistance = dist
    }
  }

  if (!nearest) {
    bot.pathfinder.setGoal(null)
    return
  }

  bot.pathfinder.setGoal(new goals.GoalFollow(nearest, 2), true)
}

// Reconnect on crash
function reconnect() {
  console.log('Bot disconnected. Reconnecting in 5 seconds...')
  setTimeout(() => process.exit(1), 5000)
}

bot.on('end', reconnect)
bot.on('error', err => {
  console.error('Bot error:', err)
  reconnect()
})
