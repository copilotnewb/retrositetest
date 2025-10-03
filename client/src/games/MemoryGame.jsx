import React, { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const EMOJIS = ['🍒','🍋','🍊','🍉','🍇','🍓','🍍','🥝']
function shuffled() {
  const arr = [...EMOJIS, ...EMOJIS].map((v,i)=>({ id:i, v, open:false, done:false }))
  for (let i=arr.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
  return arr
}

export default function MemoryGame({ auth }) {
  const [cards, setCards] = useState(shuffled())
  const [moves, setMoves] = useState(0)
  const [sel, setSel] = useState([])
  const done = useMemo(() => cards.every(c => c.done), [cards])

  useEffect(() => {
    if (sel.length === 2) {
      const [a,b] = sel
      if (cards[a].v === cards[b].v) {
        setCards(cs => cs.map((c, i) => i===a||i===b ? {...c, done:true} : c))
      } else {
        setTimeout(() => setCards(cs => cs.map((c, i) => i===a||i===b ? {...c, open:false} : c)), 700)
      }
      setSel([])
      setMoves(m => m+1)
    }
  }, [sel])

  useEffect(() => {
    if (done) {
      const score = Math.max(0, 100 - moves*5)
      if (auth?.token) {
        fetch(API + '/api/scores', {
          method:'POST',
          headers:{'Content-Type':'application/json', Authorization: 'Bearer ' + auth.token},
          body: JSON.stringify({ game: 'Memory', score })
        })
      }
      alert(`GG! Moves: ${moves} • Score: ${score}`)
    }
  }, [done])

  const flip = (i) => {
    if (sel.length === 2) return
    setCards(cs => cs.map((c, idx) => idx===i && !c.done && !c.open ? {...c, open:true} : c))
    if (!cards[i].open && !cards[i].done) setSel(s => [...s, i])
  }

  const reset = () => { setCards(shuffled()); setMoves(0); setSel([]) }

  return (
    <div className="container">
      <div className="flex" style={{justifyContent:'space-between'}}>
        <h2>🧠 Memory</h2>
        <button className="btn" onClick={reset}>Reset</button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, maxWidth:520}}>
        {cards.map((c, i) => (
          <div key={i} className="card center" onClick={()=>flip(i)} style={{height:100, cursor:'pointer', border:c.done?'2px solid var(--accent)':'2px solid #22285c'}}>
            <span style={{fontSize:32, opacity: c.open||c.done ? 1 : 0}}> {c.v} </span>
            {!c.open && !c.done && <span style={{position:'absolute', fontSize:12, color:'#6e78a0'}}>?</span>}
          </div>
        ))}
      </div>
      <p className="small" style={{marginTop:10}}>Moves: {moves}</p>
    </div>
  )
}
