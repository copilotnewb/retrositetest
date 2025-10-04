import React, { useEffect, useRef, useState } from 'react'

export default function MusicPlayer({
  src = '/audio/chiptune.mp3',
  title = 'Chiptune'
}) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [vol, setVol] = useState(() => Number(localStorage.getItem('musicVol') ?? 0.4))

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = vol
    audioRef.current = audio

    // Optional: resume if user previously had music on (autoplay requires a gesture)
    const wantsPlay = localStorage.getItem('musicPlaying') === '1'
    if (wantsPlay) {
      const resume = () => {
        audio.play().then(() => {
          setPlaying(true)
          window.removeEventListener('pointerdown', resume)
          window.removeEventListener('keydown', resume)
        }).catch(() => {})
      }
      window.addEventListener('pointerdown', resume, { once: true })
      window.addEventListener('keydown', resume, { once: true })
    }

    // Nice-to-have: media session metadata
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist: 'Retro Fun',
        album: 'BGMs'
      })
    }

    return () => { audio.pause(); audio.src = '' }
  }, [src, title])

  useEffect(() => {
    localStorage.setItem('musicVol', String(vol))
    if (audioRef.current) audioRef.current.volume = vol
  }, [vol])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      // quick fade out
      const start = audio.volume
      const steps = 10, dur = 200
      for (let i = 1; i <= steps; i++) {
        await new Promise(r => setTimeout(r, dur / steps))
        audio.volume = Math.max(0, start * (1 - i / steps))
      }
      audio.pause()
      audio.volume = vol
      setPlaying(false)
      localStorage.setItem('musicPlaying', '0')
    } else {
      try {
        await audio.play()
        setPlaying(true)
        localStorage.setItem('musicPlaying', '1')
      } catch { /* autoplay blocked until a user gesture */ }
    }
  }

  return (
    <div className="flex" style={{ gap: 8 }}>
      <button className="btn" onClick={toggle}>{playing ? 'Pause ♪' : 'Play ♪'}</button>
      <input
        className="input"
        type="range" min="0" max="1" step="0.01"
        value={vol}
        onChange={e => setVol(Number(e.target.value))}
        style={{ width: 120 }}
        aria-label="Music volume"
      />
    </div>
  )
}
