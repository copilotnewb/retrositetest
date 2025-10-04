import React, { useEffect, useRef, useState } from 'react'

export default function MusicPlayer({
  src = '/audio/chiptune.mp3',
  title = 'Chiptune'
}) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [autoplayedMuted, setAutoplayedMuted] = useState(false)
  const [vol, setVol] = useState(() => Number(localStorage.getItem('musicVol') ?? 0.4))

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audioRef.current = audio

    // 1) Try muted autoplay (allowed by all major browsers)
    ;(async () => {
      try {
        audio.muted = true
        audio.volume = 0
        await audio.play()
        setAutoplayedMuted(true) // we are playing silently
      } catch {
        // ignore; we'll start on first gesture
      }
    })()

    // 2) On first user gesture, unmute + fade in
    const unmute = async () => {
      if (!audioRef.current) return
      const a = audioRef.current
      a.muted = false
      try {
        await a.play()
        // smooth fade-in
        const steps = 12, dur = 400
        for (let i = 1; i <= steps; i++) {
          await new Promise(r => setTimeout(r, dur / steps))
          a.volume = vol * (i / steps)
        }
        setPlaying(true)
      } catch {
        // If the browser still rejects (unlikely after gesture), user can press Play
      } finally {
        window.removeEventListener('pointerdown', unmute)
        window.removeEventListener('keydown', unmute)
      }
    }
    window.addEventListener('pointerdown', unmute, { once: true })
    window.addEventListener('keydown', unmute, { once: true })

    // Optional metadata
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title, artist: 'Retro Fun', album: 'BGMs'
      })
    }

    return () => { audio.pause(); audio.src = '' }
  }, [src, title, vol])

  useEffect(() => {
    localStorage.setItem('musicVol', String(vol))
    if (audioRef.current && !audioRef.current.muted) audioRef.current.volume = vol
  }, [vol])

  const toggle = async () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      const start = a.volume
      const steps = 10, dur = 200
      for (let i = 1; i <= steps; i++) {
        await new Promise(r => setTimeout(r, dur / steps))
        a.volume = Math.max(0, start * (1 - i / steps))
      }
      a.pause()
      setPlaying(false)
    } else {
      try {
        a.muted = false
        a.volume = vol
        await a.play()
        setPlaying(true)
      } catch {
        // still blocked? user will need to click again after an interaction
      }
    }
  }

  return (
    <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
      <button className="btn" onClick={toggle}>
        {playing ? 'Pause ♪' : 'Play ♪'}
      </button>
      <input
        className="input"
        type="range" min="0" max="1" step="0.01"
        value={vol}
        onChange={e => setVol(Number(e.target.value))}
        style={{ width: 120 }}
        aria-label="Music volume"
      />
      {autoplayedMuted && !playing && (
        <span className="small" style={{ marginLeft: 8, opacity: .8 }}>
          tap any key/click to unmute
        </span>
      )}
    </div>
  )
}
