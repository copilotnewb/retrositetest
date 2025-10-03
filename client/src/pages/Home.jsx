import React from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <div className="hero">
        <h1>Welcome to RETRO FUN</h1>
        <p>Neon pixels. Cheesy chiptunes (ok, silent for now). A couple of mini‑games. Login to post high scores!</p>
        <div style={{marginTop:16}}>
          <Link className="btn hot" to="/games">Play Games</Link>
          <span style={{display:'inline-block', width:10}} />
          <Link className="btn" to="/signup">Create Account</Link>
        </div>
      </div>
      <div className="marquee"><span>🔥 Tip: Sign up to save your top scores • 🕹️ Use arrow keys in Snake • 🧠 Beat the Memory game in fewer moves!</span></div>
      <div className="container grid">
        <div className="card">
          <h3>Retro vibe</h3>
          <p className="small">Scanlines, neon glows, chunky pixels, and a synthetic 80s glow.</p>
        </div>
        <div className="card">
          <h3>Secure Login</h3>
          <p className="small">Passwords are hashed. Tokens expire in a week. Keep your creds safe, cadet.</p>
        </div>
        <div className="card">
          <h3>Leaderboards</h3>
          <p className="small">Compete with others on Memory & Snake. Highest score wins eternal glory.</p>
        </div>
      </div>
    </div>
  )
}
