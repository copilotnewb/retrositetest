import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Games from './pages/Games'
import Profile from './pages/Profile'
import MemoryGame from './games/MemoryGame'
import Snake from './games/Snake'
import Breakout from './games/Breakout'

const API = import.meta.env.VITE_API_URL || '';

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (!token) return setUser(null)
    fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => setUser(null))
  }, [token])
  return { token, setToken, user, setUser }
}

export default function App() {
  const auth = useAuth()
  const nav = useNavigate()

  const logout = () => {
    localStorage.removeItem('token'); auth.setToken(null); auth.setUser(null); nav('/')
  }

  return (
    <div>
      <nav className="nav">
        <div className="flex" style={{gap:16}}>
          <Link to="/" className="brand">▶ RETRO FUN</Link>
          <Link to="/games" className="btn">Games</Link>
          <Link to="/profile" className="btn">Profile</Link>
        </div>
        <div className="flex">
          {auth.user ? (
            <>
              <span className="badge">Hi, {auth.user.username}</span>
              <button className="btn hot" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn">Login</Link>
              <Link to="/signup" className="btn hot">Sign up</Link>
            </>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/memory" element={<MemoryGame auth={auth} />} />
        <Route path="/games/snake" element={<Snake auth={auth} />} />
        <Route path="/games/breakout" element={<Breakout auth={auth} />} />
        <Route path="/profile" element={<Profile auth={auth} />} />
        <Route path="/login" element={<Login onAuthed={(t)=>{localStorage.setItem('token', t); auth.setToken(t); nav('/profile')}} />} />
        <Route path="/signup" element={<Signup onAuthed={(t)=>{localStorage.setItem('token', t); auth.setToken(t); nav('/profile')}} />} />
      </Routes>
      <footer className="footer small">© {new Date().getFullYear()} Retro Fun. Crafted with vibes.</footer>
    </div>
  )
}
