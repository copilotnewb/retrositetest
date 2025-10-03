import React from 'react'
import { Link } from 'react-router-dom'

export default function Games() {
  return (
    <div className="container">
      <h2>Games</h2>
      <div className="grid">
        <div className="card">
          <h3>🧠 Memory</h3>
          <p className="small">Flip the cards and match pairs. Fewer moves = better score.</p>
          <Link className="btn" to="/games/memory">Play</Link>
        </div>
        <div className="card">
          <h3>🐍 Snake</h3>
          <p className="small">Eat pellets, avoid your tail. Arrow keys to steer. Don't crash!</p>
          <Link className="btn" to="/games/snake">Play</Link>
        </div>
        <div className="card">
          <h3>🧱 Breakout</h3>
          <p className="small">Smash all the bricks. Angle your shots off the paddle!</p>
          <Link className="btn" to="/games/breakout">Play</Link>
        </div>
      </div>
    </div>
  )
}
