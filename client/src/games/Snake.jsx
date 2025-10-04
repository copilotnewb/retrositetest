import React, { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const SHOP_ITEMS = [
  {
    key: 'food_bonus',
    name: 'Forager Satchel',
    description: '+5 score per food permanently (stacks to 3).',
    baseCost: 150,
    maxLevel: 3,
  },
  {
    key: 'extra_life',
    name: 'Second Heart',
    description: 'Gain an extra life each run.',
    baseCost: 600,
    maxLevel: 1,
  },
  {
    key: 'start_relic',
    name: 'Diviner\'s Compass',
    description: 'Begin every run with a random relic.',
    baseCost: 450,
    maxLevel: 1,
  },
  {
    key: 'hazard_insight',
    name: 'Oracle Sigil',
    description: 'Hazards spawn more slowly.',
    baseCost: 300,
    maxLevel: 2,
  },
  {
    key: 'jukebox_track2',
    name: 'Jukebox Track: Chiptune II',
    description: 'Unlocks a second background song for the site jukebox.',
    baseCost: 50,
    maxLevel: 1,
  },
]

const RELIC_LIBRARY = [
  {
    key: 'soul_glutton',
    name: 'Soul Glutton',
    description: '+5 score per food for this run.',
    repeatable: true,
    apply: (state) => {
      state.foodBonus = (state.foodBonus || 0) + 5
    },
  },
  {
    key: 'time_dilation',
    name: 'Hourglass of Dilation',
    description: 'Base speed slows slightly.',
    repeatable: false,
    apply: (state) => {
      state.timeDilation = true
    },
  },
  {
    key: 'void_cloak',
    name: 'Voidcloak',
    description: 'Gain 2 charges that negate hazard damage.',
    repeatable: true,
    apply: (state) => {
      state.voidCloakCharges = (state.voidCloakCharges || 0) + 2
    },
  },
  {
    key: 'chrono_battery',
    name: 'Chrono Battery',
    description: 'Double-score pickups last longer.',
    repeatable: false,
    apply: (state) => {
      state.chronoBattery = true
    },
  },
  {
    key: 'soul_anchor',
    name: 'Soul Anchor',
    description: 'Cheating death purges nearby hazards.',
    repeatable: false,
    apply: (state) => {
      state.soulAnchor = true
    },
  },
]

const RELIC_BY_KEY = RELIC_LIBRARY.reduce((acc, relic) => {
  acc[relic.key] = relic
  return acc
}, {})

const pickUnique = (pool, count, allowRepeatKeys = new Set()) => {
  const available = [...pool]
  const picks = []
  while (available.length > 0 && picks.length < count) {
    const idx = Math.floor(Math.random() * available.length)
    const candidate = available.splice(idx, 1)[0]
    if (!allowRepeatKeys.has(candidate.key)) {
      picks.push(candidate)
    }
  }
  // if we still need more (because of non-repeatable duplicates), fallback allowing repeats
  while (picks.length < count && pool.length > 0) {
    picks.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return picks
}

const hazardColor = (kind) => {
  if (kind === 'SPIKE') return '#ff6b6b'
  if (kind === 'RIFT') return '#835bff'
  return '#f1fa8c'
}

const pickupColor = (kind) => {
  if (kind === 'BOOST') return '#ffd166'
  if (kind === 'MULTI') return '#00ffd0'
  if (kind === 'SHRINK') return '#8fe9ff'
  if (kind === 'RELIC') return '#ff9ff3'
  return '#ffffff'
}

export default function Snake({ auth }) {
  const canvasRef = useRef(null)

  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)
  const [lives, setLives] = useState(1)
  const [meta, setMeta] = useState({ essence: 0, upgrades: {} })
  const [metaReady, setMetaReady] = useState(!auth?.token)
  const [shopOpen, setShopOpen] = useState(false)
  const [relicChoices, setRelicChoices] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [runRelics, setRunRelics] = useState([])

  const metaRef = useRef(meta)
  const messageTimerRef = useRef(null)

  const timerRef = useRef(null)
  const sizeRef = useRef(16)
  const cellsRef = useRef(24)
  const expansionCountRef = useRef(0)
  const nextExpansionScoreRef = useRef(200)

  const snakeRef = useRef([{ x: 10, y: 10 }])
  const dirRef = useRef({ x: 1, y: 0 })
  const pendingDirRef = useRef(null)
  const foodRef = useRef({ x: 15, y: 10 })

  const pickupsRef = useRef([])
  const hazardsRef = useRef([])

  const multiUntilRef = useRef(0)
  const boostUntilRef = useRef(0)
  const invulnUntilRef = useRef(0)

  const tickMsRef = useRef(120)
  const desiredTickRef = useRef(120)
  const hazardIntervalRef = useRef(16)
  const hazardTickCounterRef = useRef(0)

  const scoreRef = useRef(0)
  const livesRef = useRef(1)
  const permanentFoodBonusRef = useRef(0)
  const relicStateRef = useRef({})
  const relicInventoryRef = useRef({})
  const relicPendingRef = useRef(false)
  const foodsEatenRef = useRef(0)

  const metaEssence = meta?.essence ?? 0
  const metaUpgrades = meta?.upgrades ?? {}

  const now = () => Date.now()
  const randInt = (n) => Math.floor(Math.random() * n)
  const posEq = (a, b) => a.x === b.x && a.y === b.y

  const flashMessage = (msg) => {
    setStatusMessage(msg)
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    if (msg) {
      messageTimerRef.current = setTimeout(() => setStatusMessage(''), 2500)
    }
  }

  useEffect(() => {
    metaRef.current = meta
  }, [meta])

  const applyMetaUpdate = (nextMeta) => {
    setMeta(nextMeta)
    if (typeof window !== 'undefined' && nextMeta) {
      window.dispatchEvent(new CustomEvent('snake-meta-update', { detail: nextMeta }))
    }
  }

  useEffect(() => () => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!auth?.token) {
      applyMetaUpdate({ essence: 0, upgrades: {} })
      setMetaReady(true)
      return
    }
    setMetaReady(false)
    ;(async () => {
      try {
        const res = await fetch(API + '/api/snake/meta', {
          headers: { Authorization: 'Bearer ' + auth.token },
        })
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            applyMetaUpdate(data.meta)
          }
          setMetaReady(true)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setMetaReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth])

  const placeRandomFree = (excludeArr) => {
    const cells = cellsRef.current
    for (let tries = 0; tries < 200; tries++) {
      const p = { x: randInt(cells), y: randInt(cells) }
      if (!excludeArr.some((q) => posEq(p, q))) return p
    }
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const p = { x, y }
        if (!excludeArr.some((q) => posEq(p, q))) return p
      }
    }
    return { x: 0, y: 0 }
  }

  const resizeBoardIfNeeded = (ctx) => {
    const size = sizeRef.current
    const cells = cellsRef.current
    const canvas = canvasRef.current
    canvas.width = size * cells
    canvas.height = size * cells
  }

  const updateDesiredSpeed = () => {
    const s = scoreRef.current
    let base = 120
    if (s >= 100) base = 100
    if (s >= 200) base = 80
    if (relicStateRef.current.timeDilation) base += 15
    if (boostUntilRef.current >= now()) {
      base = Math.max(50, Math.floor(base * 0.7))
    }
    desiredTickRef.current = base
  }

  const applyIntervalIfChanged = (ctx) => {
    updateDesiredSpeed()
    const want = desiredTickRef.current
    if (want !== tickMsRef.current) {
      tickMsRef.current = want
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => tick(ctx), tickMsRef.current)
    }
  }

  const spawnHazardMaybe = () => {
    hazardTickCounterRef.current += 1
    const dynamicInterval = Math.max(6, Math.floor(hazardIntervalRef.current - scoreRef.current / 140))
    if (hazardTickCounterRef.current < dynamicInterval) return
    hazardTickCounterRef.current = 0
    const snake = snakeRef.current
    const food = foodRef.current
    const exclude = [
      ...snake,
      food,
      ...pickupsRef.current,
      ...hazardsRef.current.map((h) => ({ x: h.x, y: h.y })),
    ]
    const pos = placeRandomFree(exclude)
    const kind = Math.random() < 0.5 ? 'SPIKE' : 'RIFT'
    hazardsRef.current = [
      ...hazardsRef.current,
      { ...pos, kind, expiresAt: now() + 20000 + scoreRef.current * 5 },
    ]
  }

  const spawnPickupMaybe = () => {
    const snake = snakeRef.current
    const food = foodRef.current
    const hazardPositions = hazardsRef.current.map((h) => ({ x: h.x, y: h.y }))

    if (relicPendingRef.current && !pickupsRef.current.some((p) => p.kind === 'RELIC')) {
      const exclude = [...snake, food, ...pickupsRef.current, ...hazardPositions]
      const pos = placeRandomFree(exclude)
      pickupsRef.current = [...pickupsRef.current, { ...pos, kind: 'RELIC' }]
      relicPendingRef.current = false
      return
    }

    if (pickupsRef.current.length >= 3) return
    if (Math.random() < 0.03) {
      const exclude = [...snake, food, ...pickupsRef.current, ...hazardPositions]
      const pos = placeRandomFree(exclude)
      const kinds = ['BOOST', 'MULTI', 'SHRINK']
      const kind = kinds[randInt(kinds.length)]
      pickupsRef.current = [...pickupsRef.current, { ...pos, kind }]
    }
  }

  const draw = (ctx) => {
    const size = sizeRef.current
    const cells = cellsRef.current
    const snake = snakeRef.current
    const food = foodRef.current
    const invulnerable = invulnUntilRef.current >= now()

    ctx.fillStyle = '#0d112b'
    ctx.fillRect(0, 0, size * cells, size * cells)

    ctx.fillStyle = 'rgba(0,255,208,0.04)'
    for (let i = 0; i < cells; i++) {
      ctx.fillRect(i * size, 0, 1, size * cells)
      ctx.fillRect(0, i * size, size * cells, 1)
    }

    hazardsRef.current = hazardsRef.current.filter((h) => h.expiresAt >= now())
    hazardsRef.current.forEach((h) => {
      ctx.fillStyle = hazardColor(h.kind)
      ctx.fillRect(h.x * size, h.y * size, size, size)
    })

    ctx.fillStyle = '#ff3df0'
    ctx.fillRect(food.x * size, food.y * size, size, size)

    pickupsRef.current.forEach((p) => {
      ctx.fillStyle = pickupColor(p.kind)
      const cx = p.x * size + size / 2
      const cy = p.y * size + size / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy - size / 2 + 2)
      ctx.lineTo(cx + size / 2 - 2, cy)
      ctx.lineTo(cx, cy + size / 2 - 2)
      ctx.lineTo(cx - size / 2 + 2, cy)
      ctx.closePath()
      ctx.fill()
    })

    snake.forEach((segment, idx) => {
      ctx.fillStyle = idx === 0 && invulnerable ? '#f1fa8c' : '#00ffd0'
      ctx.fillRect(segment.x * size, segment.y * size, size, size)
    })
  }

  const pauseLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setRunning(false)
  }

  const resumeLoop = (ctx) => {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => tick(ctx), tickMsRef.current)
      setRunning(true)
    }
  }

  const grantRelic = (key, ctx, { silent = false } = {}) => {
    const relic = RELIC_BY_KEY[key]
    if (!relic) return
    relic.apply(relicStateRef.current)
    relicInventoryRef.current[key] = (relicInventoryRef.current[key] || 0) + 1
    setRunRelics(
      Object.entries(relicInventoryRef.current).map(([rk, count]) => ({
        key: rk,
        count,
        name: RELIC_BY_KEY[rk]?.name || rk,
        description: RELIC_BY_KEY[rk]?.description || '',
      }))
    )
    if (!silent) {
      flashMessage(`🔮 ${relic.name}`)
    }
    draw(ctx)
  }

  const offerRelics = (ctx) => {
    pauseLoop()
    const repeatableKeys = new Set(
      RELIC_LIBRARY.filter((r) => r.repeatable && (relicInventoryRef.current[r.key] || 0) > 0).map((r) => r.key)
    )
    const options = pickUnique(RELIC_LIBRARY, 3, repeatableKeys)
    setRelicChoices(options)
  }

  const applyUpgradesForRun = (ctx) => {
    const upgrades = metaRef.current?.upgrades || {}
    livesRef.current = 1 + (upgrades.extra_life || 0)
    setLives(livesRef.current)
    permanentFoodBonusRef.current = (upgrades.food_bonus || 0) * 5
    hazardIntervalRef.current = 16 + (upgrades.hazard_insight || 0) * 8
    if (upgrades.start_relic) {
      const guaranteed = pickUnique(RELIC_LIBRARY, 1)[0]
      if (guaranteed) grantRelic(guaranteed.key, ctx, { silent: true })
    }
  }

  const consumeLife = (ctx, reason) => {
    if (livesRef.current <= 1) return false
    livesRef.current -= 1
    setLives(livesRef.current)
    invulnUntilRef.current = now() + 2500
    const hazards = hazardsRef.current.map((h) => ({ x: h.x, y: h.y }))
    const exclude = [...hazards, ...pickupsRef.current, foodRef.current]
    const safe = placeRandomFree(exclude)
    snakeRef.current = [safe]
    const cells = cellsRef.current
    snakeRef.current.push({ x: (safe.x - 1 + cells) % cells, y: safe.y })
    snakeRef.current.push({ x: (safe.x - 2 + cells) % cells, y: safe.y })
    dirRef.current = { x: 1, y: 0 }
    pendingDirRef.current = null
    if (relicStateRef.current.soulAnchor) {
      hazardsRef.current = hazardsRef.current.filter((h) => Math.abs(h.x - safe.x) > 1 || Math.abs(h.y - safe.y) > 1)
    }
    flashMessage('💔 Second Heart saved you!')
    draw(ctx)
    return true
  }

  const attemptRescue = (ctx, reason, pos) => {
    if (invulnUntilRef.current >= now()) return true
    if (reason === 'hazard' && (relicStateRef.current.voidCloakCharges || 0) > 0) {
      relicStateRef.current.voidCloakCharges -= 1
      invulnUntilRef.current = now() + 2000
      hazardsRef.current = hazardsRef.current.filter((h) => !posEq(h, pos))
      flashMessage('🛡 Voidcloak absorbed the hit!')
      draw(ctx)
      return true
    }
    return consumeLife(ctx, reason)
  }

  const checkExpansion = (ctx) => {
    const threshold = nextExpansionScoreRef.current
    if (scoreRef.current >= threshold) {
      expansionCountRef.current += 1
      nextExpansionScoreRef.current *= 2
      cellsRef.current = 24 + expansionCountRef.current * 8
      resizeBoardIfNeeded(ctx)
      const clamp = (v) => Math.max(0, Math.min(v, cellsRef.current - 1))
      snakeRef.current = snakeRef.current.map((s) => ({ x: clamp(s.x), y: clamp(s.y) }))
      foodRef.current = { x: clamp(foodRef.current.x), y: clamp(foodRef.current.y) }
      pickupsRef.current = pickupsRef.current.map((p) => ({ ...p, x: clamp(p.x), y: clamp(p.y) }))
      hazardsRef.current = hazardsRef.current.map((h) => ({ ...h, x: clamp(h.x), y: clamp(h.y) }))
      flashMessage('🌌 The crypt expands!')
    }
  }

  const addScoreForFood = () => {
    const base = 10 + permanentFoodBonusRef.current + (relicStateRef.current.foodBonus || 0)
    const multi = multiUntilRef.current >= now() ? 2 : 1
    scoreRef.current += base * multi
    setScore(scoreRef.current)
  }

  const gameOver = async () => {
    pauseLoop()
    const finalScore = scoreRef.current
    if (auth?.token) {
      try {
        await fetch(API + '/api/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + auth.token,
          },
          body: JSON.stringify({ game: 'Snake', score: finalScore }),
        })
      } catch (e) {
        console.error(e)
      }
      if (finalScore > 0) {
        const essenceEarned = Math.max(1, Math.floor(finalScore / 5))
        try {
          const res = await fetch(API + '/api/snake/meta/earn', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + auth.token,
            },
            body: JSON.stringify({ earned: essenceEarned }),
          })
          if (res.ok) {
            const data = await res.json()
            applyMetaUpdate(data.meta)
            flashMessage(`💎 Banked ${essenceEarned} essence`)
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
    alert('Game over! Score: ' + finalScore)
  }

  const tick = (ctx) => {
    const cells = cellsRef.current
    const snake = snakeRef.current

    if (pendingDirRef.current) {
      dirRef.current = pendingDirRef.current
      pendingDirRef.current = null
    }

    let head = {
      x: (snake[0].x + dirRef.current.x + cells) % cells,
      y: (snake[0].y + dirRef.current.y + cells) % cells,
    }

    hazardsRef.current = hazardsRef.current.filter((h) => h.expiresAt >= now())

    const willGrow = head.x === foodRef.current.x && head.y === foodRef.current.y
    const bodyToCheck = willGrow ? snake : snake.slice(0, -1)

    const collidedWithSelf = bodyToCheck.some((s) => s.x === head.x && s.y === head.y)
    if (collidedWithSelf) {
      if (!attemptRescue(ctx, 'self', head)) {
        gameOver()
        return
      }
      draw(ctx)
      return
    }

    const hazardHit = hazardsRef.current.find((h) => posEq(h, head))
    if (hazardHit) {
      if (!attemptRescue(ctx, 'hazard', head)) {
        gameOver()
        return
      }
      draw(ctx)
      return
    }

    snake.unshift(head)

    if (willGrow) {
      addScoreForFood()
      foodsEatenRef.current += 1
      const exclude = [...snake, ...pickupsRef.current, ...hazardsRef.current.map((h) => ({ x: h.x, y: h.y }))]
      foodRef.current = placeRandomFree(exclude)
      if (foodsEatenRef.current % 5 === 0) {
        relicPendingRef.current = true
      }
    } else {
      snake.pop()
    }

    let consumedIndex = -1
    for (let i = 0; i < pickupsRef.current.length; i++) {
      if (posEq(pickupsRef.current[i], head)) {
        consumedIndex = i
        break
      }
    }
    if (consumedIndex >= 0) {
      const p = pickupsRef.current[consumedIndex]
      pickupsRef.current.splice(consumedIndex, 1)
      if (p.kind === 'BOOST') {
        boostUntilRef.current = now() + 15000
        flashMessage('⚡ Speed surge!')
      } else if (p.kind === 'MULTI') {
        let duration = 15000
        if (relicStateRef.current.chronoBattery) duration += 7000
        multiUntilRef.current = now() + duration
        flashMessage('✴ Double score active!')
      } else if (p.kind === 'SHRINK') {
        const remove = Math.min(4, snakeRef.current.length - 1)
        if (remove > 0) snakeRef.current.splice(-remove, remove)
        flashMessage('⤵ Shed your husk')
      } else if (p.kind === 'RELIC') {
        offerRelics(ctx)
        return
      }
    }

    spawnPickupMaybe()
    spawnHazardMaybe()
    checkExpansion(ctx)
    applyIntervalIfChanged(ctx)
    draw(ctx)
  }

  const start = (ctx) => {
    cellsRef.current = 24
    sizeRef.current = 16
    expansionCountRef.current = 0
    nextExpansionScoreRef.current = 200
    resizeBoardIfNeeded(ctx)

    snakeRef.current = [{ x: 10, y: 10 }]
    dirRef.current = { x: 1, y: 0 }
    pendingDirRef.current = null
    foodRef.current = { x: 15, y: 10 }

    pickupsRef.current = []
    hazardsRef.current = []
    multiUntilRef.current = 0
    boostUntilRef.current = 0
    invulnUntilRef.current = 0
    hazardTickCounterRef.current = 0

    scoreRef.current = 0
    setScore(0)

    foodsEatenRef.current = 0
    relicPendingRef.current = false
    relicStateRef.current = {}
    relicInventoryRef.current = {}
    setRunRelics([])
    setRelicChoices(null)
    setStatusMessage('')

    applyUpgradesForRun(ctx)

    const exclude = [...snakeRef.current]
    foodRef.current = placeRandomFree(exclude)

    desiredTickRef.current = 120
    tickMsRef.current = 120
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => tick(ctx), tickMsRef.current)

    setRunning(true)
    draw(ctx)
  }

  const purchaseUpgrade = async (item) => {
    if (!auth?.token) {
      flashMessage('Log in to visit the shop')
      return
    }
    try {
      const res = await fetch(API + '/api/snake/meta/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + auth.token,
        },
        body: JSON.stringify({ upgradeKey: item.key }),
      })
      if (res.ok) {
        const data = await res.json()
        applyMetaUpdate(data.meta)
        const message = item.key === 'jukebox_track2'
          ? '🎵 Unlocked Chiptune II in the jukebox!'
          : `🛠 Upgraded ${item.name}`
        flashMessage(message)
      } else {
        const err = await res.json().catch(() => ({ error: 'Cannot purchase' }))
        flashMessage(err.error || 'Cannot purchase')
      }
    } catch (e) {
      console.error(e)
      flashMessage('Shopkeeper is unavailable')
    }
  }

  useEffect(() => {
    if (!metaReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    resizeBoardIfNeeded(ctx)
    draw(ctx)

    const onKey = (e) => {
      const k = e.key
      if (k.startsWith('Arrow')) e.preventDefault()
      const d = dirRef.current
      if (k === 'ArrowUp' && d.y !== 1) pendingDirRef.current = { x: 0, y: -1 }
      if (k === 'ArrowDown' && d.y !== -1) pendingDirRef.current = { x: 0, y: 1 }
      if (k === 'ArrowLeft' && d.x !== 1) pendingDirRef.current = { x: -1, y: 0 }
      if (k === 'ArrowRight' && d.x !== -1) pendingDirRef.current = { x: 1, y: 0 }
    }
    window.addEventListener('keydown', onKey)

    start(ctx)

    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auth, metaReady])

  const ctxForModal = () => canvasRef.current?.getContext('2d')

  return (
    <div className="container">
      <h2>🐍 Snake</h2>
      <div className="card center" style={{ flexDirection: 'column', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 12, border: '2px solid #22285c', maxWidth: '100%' }}
        />
        {statusMessage && (
          <div
            className="badge"
            style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: '#1b2440' }}
          >
            {statusMessage}
          </div>
        )}
        <div className="flex" style={{ marginTop: 12, justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <button
            className="btn"
            onClick={() => {
              const ctx = canvasRef.current.getContext('2d')
              start(ctx)
            }}
          >
            {running ? 'Restart' : 'Start'}
          </button>
          <span className="badge">Score: {score}</span>
          <span className="badge">Lives: {lives}</span>
        </div>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Arrow keys to steer. +10 per food (boosted by relics & upgrades). Hit 200+ to expand the arena, then again each time
        you double your score. Watch for hazards and relic altars!
      </p>

      {runRelics.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h4>Run Relics</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {runRelics.map((r) => (
              <li key={r.key}>
                {r.name} {r.count > 1 ? `×${r.count}` : ''} — {r.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {auth?.token && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <strong>💎 Essence: {metaEssence}</strong>
            <button className="btn" onClick={() => setShopOpen((v) => !v)}>
              {shopOpen ? 'Close Shop' : 'Open Shop'}
            </button>
          </div>
          {shopOpen && (
            <div className="grid" style={{ marginTop: 16, gap: 12 }}>
              {SHOP_ITEMS.map((item) => {
                const level = metaUpgrades[item.key] || 0
                const cost = item.baseCost * (level + 1)
                const maxed = level >= item.maxLevel
                return (
                  <div key={item.key} className="card" style={{ background: '#121832' }}>
                    <h4 style={{ marginBottom: 4 }}>{item.name}</h4>
                    <p className="small" style={{ marginBottom: 8 }}>{item.description}</p>
                    <p className="small" style={{ marginBottom: 8 }}>
                      Level {level}/{item.maxLevel}
                    </p>
                    <button
                      className="btn"
                      disabled={maxed || metaEssence < cost}
                      onClick={() => purchaseUpgrade(item)}
                    >
                      {maxed ? 'Maxed' : `Buy (${cost})`}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {relicChoices && (
        <div className="card" style={{ marginTop: 16, background: '#141b36', border: '1px solid #31407a' }}>
          <h3>Choose a Relic</h3>
          <div className="grid" style={{ gap: 12 }}>
            {relicChoices.map((choice) => (
              <div key={choice.key} className="card" style={{ background: '#0f1429' }}>
                <strong>{choice.name}</strong>
                <p className="small">{choice.description}</p>
                <button
                  className="btn"
                  onClick={() => {
                    const ctx = ctxForModal()
                    grantRelic(choice.key, ctx)
                    setRelicChoices(null)
                    if (ctx) resumeLoop(ctx)
                  }}
                >
                  Claim
                </button>
              </div>
            ))}
            <div className="card" style={{ background: '#0f1429' }}>
              <strong>Skip</strong>
              <p className="small">Leave the altar untouched.</p>
              <button
                className="btn"
                onClick={() => {
                  const ctx = ctxForModal()
                  setRelicChoices(null)
                  if (ctx) resumeLoop(ctx)
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
