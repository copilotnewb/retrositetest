import React, { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Snake({ auth }) {
  const canvasRef = useRef(null)

  // UI state only (doesn't drive the loop)
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)

  // Game refs (mutable, don't cause re-renders)
  const timerRef = useRef(null)
  const cellsRef = useRef(24)
  const sizeRef = useRef(16)
  const snakeRef = useRef([{ x: 10, y: 10 }])
  const dirRef = useRef({ x: 1, y: 0 })
  const foodRef = useRef({ x: 15, y: 10 })
  const scoreRef = useRef(0)

  // Helpers
  const randCell = (max) => Math.floor(Math.random() * max)

  const resetGame = (ctx) => {
    const cells = cellsRef.current
    snakeRef.current = [{ x: 10, y: 10 }]
    dirRef.current = { x: 1, y: 0 }
    foodRef.current = { x: randCell(cells), y: randCell(cells) }
    scoreRef.current = 0
    setScore(0)
    draw(ctx)
  }

  const draw = (ctx) => {
    const size = sizeRef.current
    const cells = cellsRef.current
    const snake = snakeRef.current
    const food = foodRef.current

    ctx.fillStyle = '#0d112b'
    ctx.fillRect(0, 0, cells * size, cells * size)

    // subtle grid
    ctx.fillStyle = 'rgba(0,255,208,0.05)'
    for (let i = 0; i < cells; i++) {
      ctx.fillRect(i * size, 0, 1, cells * size)
      ctx.fillRect(0, i * size, cells * size, 1)
    }

    // food
    ctx.fillStyle = '#ff3df0'
    ctx.fillRect(food.x * size, food.y * size, size, size)

    // snake
    ctx.fillStyle = '#00ffd0'
    snake.forEach((s) => ctx.fillRect(s.x * size, s.y * size, size, size))
  }

  const gameOver = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setRunning(false)

    // Submit score if logged in
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
      } catch {}
    }
    alert('Game over! Score: ' + finalScore)
  }

  const tick = (ctx) => {
    const cells = cellsRef.current
    const snake = snakeRef.current
    const dir = dirRef.current
    const food = foodRef.current

    const head = { x: (snake[0].x + dir.x + cells) % cells, y: (snake[0].y + dir.y + cells) % cells }

    // self collision
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      gameOver()
      return
    }

    snake.unshift(head)

    // eat?
    if (head.x === food.x && head.y === food.y) {
      scoreRef.current += 10
      setScore(scoreRef.current)
      foodRef.current = { x: randCell(cells), y: randCell(cells) }
    } else {
      snake.pop()
    }

    draw(ctx)
  }

  const start = (ctx) => {
    if (timerRef.current) clearInterval(timerRef.current)
    resetGame(ctx)
    setRunning(true)
    timerRef.current = setInterval(() => tick(ctx), 120)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const size = sizeRef.current
    const cells = cellsRef.current
    canvas.width = canvas.height = size * cells

    // Controls
    const onKey = (e) => {
      const k = e.key
      if (k.startsWith('Arrow')) e.preventDefault()
      const dir = dirRef.current
      if (k === 'ArrowUp' && dir.y !== 1) dirRef.current = { x: 0, y: -1 }
      if (k === 'ArrowDown' && dir.y !== -1) dirRef.current = { x: 0, y: 1 }
      if (k === 'ArrowLeft' && dir.x !== 1) dirRef.current = { x: -1, y: 0 }
      if (k === 'ArrowRight' && dir.x !== -1) dirRef.current = { x: 1, y: 0 }
    }
    window.addEventListener('keydown', onKey)

    // Initial draw + auto-start
    resetGame(ctx)
    start(ctx)

    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auth]) // only depends on auth (not score)

  return (
    <div className="container">
      <h2>🐍 Snake</h2>
      <div className="card center" style={{ flexDirection: 'column' }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 12, border: '2px solid #22285c', maxWidth: '100%' }}
          width="384"
          height="384"
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
        Use arrow keys. Score +10 per snack.
      </p>
    </div>
  )
}
