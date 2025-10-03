import React, { useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Login({ onAuthed }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    const r = await fetch(API + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    const d = await r.json()
    if (r.ok) onAuthed(d.token)
    else setMsg(d.error || 'Login failed')
  }

  return (
    <div className="container" style={{maxWidth:520}}>
      <h2>Log in</h2>
      <form onSubmit={submit} className="card">
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@retro.fun" />
        <label style={{marginTop:10}}>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        <div className="flex" style={{marginTop:12, justifyContent:'space-between'}}>
          <button className="btn hot" type="submit">Enter</button>
          {msg && <span className="small" style={{color:'#ff9ead'}}>{msg}</span>}
        </div>
      </form>
    </div>
  )
}
