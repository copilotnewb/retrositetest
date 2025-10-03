import React, { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Snake({ auth }) {
  const canvasRef = useRef(null)

  // UI state
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)

  // Game refs (mutable so the loop doesn't reset)
  const timerRef = useRef(null)
  const sizeRef = useRef(16)            // px per cell
  const cellsRef = useRef(24)           // grid size (expands to 32 at 200)
  const expandedRef = useRef(false)

  const snakeRef = useRef([{ x: 10, y: 10 }])
  const dirRef = useRef({ x: 1, y: 0 })
  const pendingDirRef = useRef(null)    // queued direction (avoid double-turn issues)
  const foodRef = useRef({ x: 15, y: 10 })

  // pickups: array of {x, y, kind}
  const pickupsRef = useRef([])
  // effects
  const multiUntilRef = useRef(0)       // timestamp when double points ends
  const boostUntilRef = useRef(0)       // timestamp when speed boost ends

  // speed control
  const tickMsRef = useRef(120)         // current interval
  const desiredTickRef = useRef(120)

  // score mirror (avoid stale closure)
  const scoreRef = useRef(0)

  // ---- helpers ----
  const now = () => Date.now()
  const randInt = (n) => Math.floor(Math.random() * n)

  const posEq = (a, b) => a.x === b.x && a.y === b.y

  const placeRandomFree = (excludeArr) => {
    const cells = cellsRef.current
    // Avoid infinite loops by trying a bounded number of times, then fallback scan
    for (let tries = 0; tries < 200; tries++) {
      const p = { x: randInt(cells), y: randInt(cells) }
      if (!excludeArr.some((q) => posEq(p, q))) return p
    }
    // fallback scan
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
      const p = { x, y }
      if (!excludeArr.some((q) => posEq(p, q))) return p
    }
    return { x: 0, y: 0 } // very unlikely
  }

  const resizeBoardIfNeeded = (ctx) => {
    const size = sizeRef.current
    const cells = cellsRef.current
    const canvas = canvasRef.current
    canvas.width = size * cells
    canvas.height = size * cells
  }

  const updateDesiredSpeed = () => {
    // base tiers
    const s = scoreRef.current
    let base = 120
    if (s >= 100) base = 100
    if (s >= 200) base = 80

    // effects
    if (boostUntilRef.current > now()) {
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

  const spawnPickupMaybe = () => {
    // small chance if fewer than 2 pickups on the field
    if (pickupsRef.current.length >= 2) return
    if (Math.random() < 0.03) {
      const snake = snakeRef.current
      const food = foodRef.current
      const exclude = [...snake, food, ...pickupsRef.current]
      const pos = placeRandomFree(exclude)
      // choose a pickup type
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

    // background
    ctx.fillStyle = '#0d112b'
    ctx.fillRect(0, 0, size * cells, size * cells)

    // neon grid
    ctx.fillStyle = 'rgba(0,255,208,0.04)'
    for (let i = 0; i < cells; i++) {
      ctx.fillRect(i * size, 0, 1, size * cells)
      ctx.fillRect(0, i * size, size * cells, 1)
    }

    // food
    ctx.fillStyle = '#ff3df0'
    ctx.fillRect(food.x * size, food.y * size, size, size)

    // pickups
    pickupsRef.current.forEach(p => {
      if (p.kind === 'BOOST') ctx.fillStyle = '#ffd166'   // ⚡
      if (p.kind === 'MULTI') ctx.fillStyle = '#00ffd0'   // ✴
      if (p.kind === 'SHRINK') ctx.fillStyle = '#8fe9ff'  // ⤵
      // draw as diamond
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

    // snake
    ctx.fillStyle = '#00ffd0'
    snake.forEach(s => ctx.fillRect(s.x * size, s.y * size, size, size))
  }

  const gameOver = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setRunning(false)

    const finalScore = scoreRef.current
    if (auth?.token) {
      try {
        await fetch(API + '/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.token },
          body: JSON.stringify({ game: 'Snake', score: finalScore })
        })
      } catch {}
    }
    alert('Game over! Score: ' + finalScore)
  }

  const tick = (ctx) => {
    const cells = cellsRef.current
    const snake = snakeRef.current
    const dir = dirRef.current

    // apply queued direction once per tick (prevents double-turn weirdness)
    if (pendingDirRef.current) {
      dirRef.current = pendingDirRef.current
      pendingDirRef.current = null
    }

    const head = {
      x: (snake[0].x + dirRef.current.x + cells) % cells,
      y: (snake[0].y + dirRef.current.y + cells) % cells
    }

    const willGrow = (head.x === foodRef.current.x && head.y === foodRef.current.y)

    // ---- FIX: self-collision check should ignore the tail if we're not growing ----
    const bodyToCheck = willGrow ? snake : snake.slice(0, -1)
    if (bodyToCheck.some(s => s.x === head.x && s.y === head.y)) {
      gameOver()
      return
    }

    // move
    snake.unshift(head)

    // eat?
    if (willGrow) {
      // points (with multiplier)
      const multi = (multiUntilRef.current > now()) ? 2 : 1
      scoreRef.current += 10 * multi
      setScore(scoreRef.current)
      // new food not on snake/pickups
      const exclude = [...snake, ...pickupsRef.current]
      foodRef.current = placeRandomFree(exclude)
    } else {
      snake.pop()
    }

    // pickups collision
    let consumedIndex = -1
    for (let i = 0; i < pickupsRef.current.length; i++) {
      if (posEq(pickupsRef.current[i], head)) { consumedIndex = i; break }
    }
    if (consumedIndex >= 0) {
      const p = pickupsRef.current[consumedIndex]
      pickupsRef.current.splice(consumedIndex, 1)
      if (p.kind === 'BOOST') {
        boostUntilRef.current = now() + 15000 // 15s boost
      } else if (p.kind === 'MULTI') {
        multiUntilRef.current = now() + 15000 // 15s double points
      } else if (p.kind === 'SHRINK') {
        // remove 4 tail segments if possible (helpful when you get long)
        const remove = Math.min(4, snakeRef.current.length - 1)
        if (remove > 0) snakeRef.current.splice(-remove, remove)
      }
    }

    // maybe spawn a pickup
    spawnPickupMaybe()

    // expansion + speed bump at 200
    if (!expandedRef.current && scoreRef.current >= 200) {
      expandedRef.current = true
      cellsRef.current = 32
      resizeBoardIfNeeded(ctx)
      // reposition food/pickups that might be outside (only matters if cells got smaller, but safe)
      const clamp = (v) => Math.max(0, Math.min(v, cellsRef.current - 1))
      foodRef.current = { x: clamp(foodRef.current.x), y: clamp(foodRef.current.y) }
      pickupsRef.current = pickupsRef.current.map(p => ({ x: clamp(p.x), y: clamp(p.y), kind: p.kind }))
    }

    // adjust interval if needed
    applyIntervalIfChanged(ctx)

    // draw
    draw(ctx)
  }

  const start = (ctx) => {
    // reset everything
    cellsRef.current = 24
    expandedRef.current = false
    sizeRef.current = 16
    resizeBoardIfNeeded(ctx)

    snakeRef.current = [{ x: 10, y: 10 }]
    dirRef.current = { x: 1, y: 0 }
    pendingDirRef.current = null

    pickupsRef.current = []
    multiUntilRef.current = 0
    boostUntilRef.current = 0

    scoreRef.current = 0
    setScore(0)

    // place food not on snake
    foodRef.current = placeRandomFree(snakeRef.current)

    // speed baseline
    desiredTickRef.current = 120
    tickMsRef.current = 120
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => tick(ctx), tickMsRef.current)

    setRunning(true)
    draw(ctx)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    resizeBoardIfNeeded(ctx)
    draw(ctx)

    // controls
    const onKey = (e) => {
      const k = e.key
      if (k.startsWith('Arrow')) e.preventDefault()
      const d = dirRef.current
      // queue a turn that isn't a 180
      if (k === 'ArrowUp' && d.y !== 1) pendingDirRef.current = { x: 0, y: -1 }
      if (k === 'ArrowDown' && d.y !== -1) pendingDirRef.current = { x: 0, y: 1 }
      if (k === 'ArrowLeft' && d.x !== 1) pendingDirRef.current = { x: -1, y: 0 }
      if (k === 'ArrowRight' && d.x !== -1) pendingDirRef.current = { x: 1, y: 0 }
    }
    window.addEventListener('keydown', onKey)

    // auto-start
    start(ctx)

    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auth])

  return (
    <div className="container">
      <h2>🐍 Snake</h2>
      <div className="card center" style={{ flexDirection: 'column' }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 12, border: '2px solid #22285c', maxWidth: '100%' }}
          // width/height are set dynamically via resizeBoardIfNeeded
        />
        <div className="flex" style={{ marginTop: 12, justifyContent: 'space-between', width: '100%' }}>
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
        </div>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Arrow keys to steer. +10 per food. Hit 200 for a bigger board & faster speed. Pickups:
        <span className="badge" style={{ marginLeft: 8 }}>⚡ Boost</span>
        <span className="badge" style={{ marginLeft: 8 }}>✴ 2× Points</span>
        <span className="badge" style={{ marginLeft: 8 }}>⤵ Shrink</span>
      </p>
    </div>
  )
}
