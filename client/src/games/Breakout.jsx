import React, { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Breakout({ auth }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const runningRef = useRef(false)

  // Mutable game state (refs so the loop isn’t recreated)
  const ctxRef = useRef(null)
  const wRef = useRef(480)
  const hRef = useRef(320)

  const paddleWRef = useRef(72)
  const paddleHRef = useRef(10)
  const paddleXRef = useRef(0)

  const ballXRef = useRef(0)
  const ballYRef = useRef(0)
  const ballVXRef = useRef(0)
  const ballVYRef = useRef(0)
  const ballRRef = useRef(6)

  const bricksRef = useRef([])
  const colsRef = useRef(10)
  const rowsRef = useRef(6)
  const brickWRef = useRef(0)
  const brickHRef = useRef(16)
  const brickPadRef = useRef(4)
  const brickTopRef = useRef(40)
  const brickLeftRef = useRef(10)

  const scoreRef = useRef(0)
  const [score, setScore] = useState(0)

  // Setup & teardown
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx

    // Size canvas (keeps our chunky pixels)
    const W = 480, H = 320
    canvas.width = W; canvas.height = H
    wRef.current = W; hRef.current = H

    // Bricks sizing
    const cols = colsRef.current
    const pad = brickPadRef.current
    brickWRef.current = Math.floor((W - brickLeftRef.current * 2 - pad * (cols - 1)) / cols)

    // Controls
    const onKey = (e) => {
      if (!runningRef.current) return
      if (e.key === 'ArrowLeft') paddleXRef.current = Math.max(0, paddleXRef.current - 18)
      if (e.key === 'ArrowRight') paddleXRef.current = Math.min(W - paddleWRef.current, paddleXRef.current + 18)
    }
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
      paddleXRef.current = Math.max(0, Math.min(W - paddleWRef.current, x - paddleWRef.current / 2))
    }
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('mousemove', onMove, { passive: true })
    canvas.addEventListener('touchmove', onMove, { passive: true })

    init()
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onMove)
    }
  }, [auth])

  function init() {
    // Center paddle & ball
    paddleXRef.current = (wRef.current - paddleWRef.current) / 2
    ballXRef.current = wRef.current / 2
    ballYRef.current = hRef.current - 40
    ballVXRef.current = 2.2 * (Math.random() < 0.5 ? -1 : 1)
    ballVYRef.current = -2.4
    scoreRef.current = 0
    setScore(0)

    // Build bricks grid
    const cols = colsRef.current, rows = rowsRef.current
    const bricks = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: brickLeftRef.current + c * (brickWRef.current + brickPadRef.current),
          y: brickTopRef.current + r * (brickHRef.current + brickPadRef.current),
          alive: true,
          color: r % 2 === 0 ? '#00ffd0' : '#8fe9ff'
        })
      }
    }
    bricksRef.current = bricks
  }

  function start() {
    if (runningRef.current) cancelAnimationFrame(rafRef.current)
    init()
    runningRef.current = true
    loop()
  }

  function gameOver(message) {
    runningRef.current = false
    cancelAnimationFrame(rafRef.current)
    // submit score
    if (auth?.token) {
      fetch(API + '/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.token },
        body: JSON.stringify({ game: 'Breakout', score: scoreRef.current })
      }).catch(() => {})
    }
    alert(`${message}\nScore: ${scoreRef.current}`)
  }

  function loop() {
    step()
    draw()
    if (runningRef.current) rafRef.current = requestAnimationFrame(loop)
  }

  function step() {
    const W = wRef.current, H = hRef.current
    let x = ballXRef.current, y = ballYRef.current
    let vx = ballVXRef.current, vy = ballVYRef.current
    const r = ballRRef.current

    // Move
    x += vx; y += vy

    // Walls
    if (x - r < 0) { x = r; vx = Math.abs(vx) }
    if (x + r > W) { x = W - r; vx = -Math.abs(vx) }
    if (y - r < 0) { y = r; vy = Math.abs(vy) }
    if (y - r > H) { // bottom -> lose
      ballXRef.current = x; ballYRef.current = y
      ballVXRef.current = vx; ballVYRef.current = vy
      return gameOver('Game over!')
    }

    // Paddle
    const pw = paddleWRef.current, ph = paddleHRef.current
    const px = paddleXRef.current, py = H - 24
    if (y + r >= py && y + r <= py + ph && x >= px && x <= px + pw && vy > 0) {
      // Bounce with angle based on hit position
      const hit = (x - (px + pw / 2)) / (pw / 2) // -1..1
      const speed = Math.hypot(vx, vy) * 1.02
      const maxAngle = Math.PI * 0.35
      const angle = hit * maxAngle
      vx = speed * Math.sin(angle)
      vy = -Math.abs(speed * Math.cos(angle))
      y = py - r - 0.1
    }

    // Bricks
    const bw = brickWRef.current, bh = brickHRef.current, pad = brickPadRef.current
    let hitIndex = -1
    for (let i = 0; i < bricksRef.current.length; i++) {
      const b = bricksRef.current[i]
      if (!b.alive) continue
      if (x + r > b.x && x - r < b.x + bw && y + r > b.y && y - r < b.y + bh) {
        hitIndex = i; break
      }
    }
    if (hitIndex >= 0) {
      const b = bricksRef.current[hitIndex]
      b.alive = false
      scoreRef.current += 10; setScore(scoreRef.current)

      // simple bounce: flip vertical; improve by checking side hit
      vy = -vy

      // Win?
      if (!bricksRef.current.some(b => b.alive)) {
        ballXRef.current = x; ballYRef.current = y
        ballVXRef.current = vx; ballVYRef.current = vy
        return gameOver('You cleared the board! 🎉')
      }
    }

    ballXRef.current = x; ballYRef.current = y
    ballVXRef.current = vx; ballVYRef.current = vy
  }

  function draw() {
    const ctx = ctxRef.current
    const W = wRef.current, H = hRef.current

    // background + subtle grid (fits the site’s neon aesthetic)
    ctx.fillStyle = '#0d112b'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,255,208,0.04)'
    for (let i = 0; i < 24; i++) { // vertical lines
      const x = Math.floor((i / 24) * W)
      ctx.fillRect(x, 0, 1, H)
    }
    for (let j = 0; j < 16; j++) { // horizontal lines
      const y = Math.floor((j / 16) * H)
      ctx.fillRect(0, y, W, 1)
    }

    // bricks
    const bw = brickWRef.current, bh = brickHRef.current
    bricksRef.current.forEach(b => {
      if (!b.alive) return
      ctx.fillStyle = b.color
      ctx.fillRect(b.x, b.y, bw, bh)
    })

    // paddle
    const px = paddleXRef.current, py = H - 24
    ctx.fillStyle = '#8fe9ff'
    ctx.fillRect(px, py, paddleWRef.current, paddleHRef.current)

    // ball
    ctx.fillStyle = '#ff3df0'
    ctx.beginPath()
    ctx.arc(ballXRef.current, ballYRef.current, ballRRef.current, 0, Math.PI * 2)
    ctx.fill()
  }

  return (
    <div className="container">
      <h2>🧱 Breakout</h2>
      <div className="card center" style={{ flexDirection: 'column' }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 12, border: '2px solid #22285c', maxWidth: '100%' }}
          width="480"
          height="320"
        />
        <div className="flex" style={{ marginTop: 12, justifyContent: 'space-between', width: '100%' }}>
          <button className="btn" onClick={() => start()}>{runningRef.current ? 'Restart' : 'Start'}</button>
          <span className="badge">Score: {score}</span>
        </div>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Left/Right arrows or mouse/touch to move. +10 per brick. Don’t drop the ball!
      </p>
    </div>
  )
}
