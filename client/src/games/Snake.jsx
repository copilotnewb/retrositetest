import React, { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Snake({ auth }) {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const size = 16
    const cells = 24
    canvas.width = canvas.height = size*cells

    let snake = [{x:10,y:10}]
    let dir = {x:1,y:0}
    let food = {x: Math.floor(Math.random()*cells), y: Math.floor(Math.random()*cells)}
    let timer

    function draw() {
      ctx.fillStyle = '#0d112b'; ctx.fillRect(0,0,canvas.width,canvas.height)
      // grid glow
      for (let i=0;i<cells;i++) {
        ctx.fillStyle = 'rgba(0,255,208,0.03)'
        ctx.fillRect(i*size,0,1,canvas.height)
        ctx.fillRect(0,i*size,canvas.width,1)
      }
      // food
      ctx.fillStyle = '#ff3df0'
      ctx.fillRect(food.x*size, food.y*size, size, size)
      // snake
      ctx.fillStyle = '#00ffd0'
      snake.forEach(s => ctx.fillRect(s.x*size, s.y*size, size, size))
    }

    function tick() {
      const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y}
      // wrap
      head.x = (head.x + cells) % cells
      head.y = (head.y + cells) % cells
      // hit self?
      if (snake.some(s => s.x===head.x && s.y===head.y)) {
        gameOver()
        return
      }
      snake.unshift(head)
      if (head.x === food.x && head.y === food.y) {
        setScore(s => s+10)
        food = {x: Math.floor(Math.random()*cells), y: Math.floor(Math.random()*cells)}
      } else {
        snake.pop()
      }
      draw()
    }

    function start() {
      if (timer) clearInterval(timer)
      setScore(0)
      snake = [{x:10,y:10}]; dir = {x:1,y:0}; food = {x: Math.floor(Math.random()*cells), y: Math.floor(Math.random()*cells)}
      draw()
      timer = setInterval(tick, 120)
      setRunning(true)
    }

    function gameOver() {
      clearInterval(timer); setRunning(false)
      if (auth?.token) {
        fetch(API + '/api/scores', {
          method:'POST',
          headers:{'Content-Type':'application/json', Authorization: 'Bearer ' + auth.token},
          body: JSON.stringify({ game: 'Snake', score })
        })
      }
      alert('Game over! Score: ' + score)
    }

    function onKey(e) {
      const k = e.key
      if (k === 'ArrowUp' && dir.y !== 1) dir = {x:0,y:-1}
      if (k === 'ArrowDown' && dir.y !== -1) dir = {x:0,y:1}
      if (k === 'ArrowLeft' && dir.x !== 1) dir = {x:-1,y:0}
      if (k === 'ArrowRight' && dir.x !== -1) dir = {x:1,y:0}
    }
    window.addEventListener('keydown', onKey)
    draw()

    return () => { window.removeEventListener('keydown', onKey); if (timer) clearInterval(timer) }
  }, [auth, score])

  const startClick = () => {
    const ev = new Event('start-snake'); // not used, but keeps pattern simple
    setScore(0)
    // Re-run effect by toggling a state? simplest: refresh component by key, but here we used internal start function inside effect.
    // Instead, we trigger by forcing unmount/mount via state; but simpler: just reload the page route:
    window.location.hash = '#play'
    window.location.hash = ''
  }

  return (
    <div className="container">
      <h2>🐍 Snake</h2>
      <div className="card center" style={{flexDirection:'column'}}>
        <canvas ref={canvasRef} style={{borderRadius:12, border:'2px solid #22285c', maxWidth:'100%'}} width="384" height="384"></canvas>
        <div className="flex" style={{marginTop:12, justifyContent:'space-between', width:'100%'}}>
          <button className="btn" onClick={() => window.location.reload()}>Restart</button>
          <span className="badge">Score: {score}</span>
        </div>
      </div>
      <p className="small" style={{marginTop:10}}>Use arrow keys. Score +10 per snack.</p>
    </div>
  )
}
