import React, { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function Profile({ auth }) {
  const [me, setMe] = useState(auth.user)
  const [scores, setScores] = useState([])

  useEffect(() => { setMe(auth.user) }, [auth.user])
  useEffect(() => {
    fetch(API + '/api/scores')
      .then(r => r.json()).then(d => setScores(d.scores || []))
  }, [])

  if (!auth.user) return (
    <div className="container">
      <div className="card"><p className="small">Log in to see your profile and submit scores.</p></div>
    </div>
  )

  const mine = scores.filter(s => s.username === auth.user.username)

  return (
    <div className="container">
      <h2>Profile</h2>
      <div className="grid">
        <div className="card">
          <h3>👤 {me?.username}</h3>
          <p className="small">{me?.email}</p>
          <p className="small">Member since {new Date(me?.created_at).toLocaleDateString()}</p>
        </div>
        <div className="card">
          <h3>🏆 Your latest scores</h3>
          {mine.length === 0 ? <p className="small">No scores yet. Go play!</p> : (
            <table className="table">
              <thead><tr><th>Game</th><th>Score</th><th>When</th></tr></thead>
              <tbody>
                {mine.slice(0,10).map(s => (
                  <tr key={s.id}>
                    <td>{s.game}</td>
                    <td>{s.score}</td>
                    <td className="small">{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h3>🌐 Global top (last 25)</h3>
          <table className="table">
            <thead><tr><th>Game</th><th>Score</th><th>User</th><th>When</th></tr></thead>
            <tbody>
              {scores.map(s => (
                <tr key={s.id}>
                  <td>{s.game}</td>
                  <td>{s.score}</td>
                  <td className="small">{s.username}</td>
                  <td className="small">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
