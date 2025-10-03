import React, { useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Signup({ onAuthed }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    const r = await fetch(API + '/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, email, password }) })
    const d = await r.json()
    if (r.ok) onAuthed(d.token)
    else setMsg(d.error || 'Sign up failed')
  }

  return (
    <div className="container" style={{maxWidth:520}}>
      <h2>Create account</h2>
      <form onSubmit={submit} className="card">
        <label>Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="8bitLegend" />
        <label style={{marginTop:10}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@retro.fun" />
        <label style={{marginTop:10}}>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
        <div className="flex" style={{marginTop:12, justifyContent:'space-between'}}>
          <button className="btn hot" type="submit">Join</button>
          {msg && <span className="small" style={{color:'#ff9ead'}}>{msg}</span>}
        </div>
      </form>
    </div>
  )
}
