import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const TRACK_LIBRARY = [
  {
    key: 'chiptune1',
    title: 'Chiptune I',
    src: '/audio/chiptune.mp3',
    alwaysUnlocked: true,
  },
  {
    key: 'chiptune2',
    title: 'Chiptune II',
    src: '/audio/chiptune2.mp3',
    unlockKey: 'jukebox_track2',
  },
]

const BASE_UNLOCKS = TRACK_LIBRARY.filter((track) => track.alwaysUnlocked).map((track) => track.key)

const absoluteSrc = (src) => {
  try {
    return new URL(src, window.location.origin).href
  } catch {
    return src
  }
}

export default function MusicPlayer({ auth }) {
  const audioRef = useRef(null)
  const selectionRef = useRef([])
  const currentTrackKeyRef = useRef(BASE_UNLOCKS[0])
  const volRef = useRef(Number(localStorage.getItem('musicVol') ?? 0.4))
  const playingRef = useRef(false)
  const autoplayAttemptedRef = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [autoplayedMuted, setAutoplayedMuted] = useState(false)
  const [vol, setVol] = useState(() => Number(localStorage.getItem('musicVol') ?? 0.4))
  const [jukeboxOpen, setJukeboxOpen] = useState(false)

  const [unlockedKeys, setUnlockedKeys] = useState(BASE_UNLOCKS)
  const prevUnlockedRef = useRef(BASE_UNLOCKS)
  const [selectedKeys, setSelectedKeys] = useState(() => {
    try {
      const raw = localStorage.getItem('jukeboxSelection')
      if (!raw) return BASE_UNLOCKS
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch (e) {
      console.warn('jukeboxSelection parse failed', e)
    }
    return BASE_UNLOCKS
  })
  const [currentTrackKey, setCurrentTrackKey] = useState(BASE_UNLOCKS[0])

  const jukeboxBtnRef = useRef(null)
  const jukeboxPanelRef = useRef(null)

  const availableTracks = useMemo(
    () => TRACK_LIBRARY.filter((track) => unlockedKeys.includes(track.key)),
    [unlockedKeys]
  )

  const selectedTracks = useMemo(
    () => TRACK_LIBRARY.filter((track) => unlockedKeys.includes(track.key) && selectedKeys.includes(track.key)),
    [selectedKeys, unlockedKeys]
  )

  const currentTrack = selectedTracks.find((track) => track.key === currentTrackKey) || selectedTracks[0] || null

  selectionRef.current = selectedTracks
  currentTrackKeyRef.current = currentTrackKey
  playingRef.current = playing
  volRef.current = vol

  const applyMetaUnlocks = useCallback((meta) => {
    const upgrades = meta?.upgrades || {}
    const unlocked = TRACK_LIBRARY.filter((track) => {
      if (track.alwaysUnlocked) return true
      if (!track.unlockKey) return false
      return Boolean(upgrades[track.unlockKey])
    }).map((track) => track.key)
    const next = unlocked.length > 0 ? unlocked : BASE_UNLOCKS
    setUnlockedKeys((prev) => {
      if (prev.length === next.length && prev.every((key, idx) => key === next[idx])) return prev
      return next
    })
  }, [])

  useEffect(() => {
    const handler = (event) => {
      applyMetaUnlocks(event.detail)
    }
    window.addEventListener('snake-meta-update', handler)
    return () => window.removeEventListener('snake-meta-update', handler)
  }, [applyMetaUnlocks])

  useEffect(() => {
    if (!auth?.token) {
      setUnlockedKeys(BASE_UNLOCKS)
      setSelectedKeys(BASE_UNLOCKS)
      setCurrentTrackKey(BASE_UNLOCKS[0])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(API + '/api/snake/meta', {
          headers: { Authorization: 'Bearer ' + auth.token },
        })
        if (!cancelled && res.ok) {
          const data = await res.json()
          applyMetaUnlocks(data.meta)
        }
      } catch (e) {
        console.error('Failed to fetch jukebox meta', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth?.token, applyMetaUnlocks])

  useEffect(() => {
    const prev = prevUnlockedRef.current
    const gained = unlockedKeys.filter((key) => !prev.includes(key))
    prevUnlockedRef.current = unlockedKeys
    setSelectedKeys((prevSelected) => {
      const filtered = TRACK_LIBRARY.map((track) => track.key).filter(
        (key) => prevSelected.includes(key) && unlockedKeys.includes(key)
      )
      let next = filtered.length > 0 ? filtered : BASE_UNLOCKS
      gained.forEach((key) => {
        if (key !== BASE_UNLOCKS[0] && !next.includes(key)) next = [...next, key]
      })
      if (next.length === prevSelected.length && next.every((key, idx) => key === prevSelected[idx])) {
        return prevSelected
      }
      return next
    })
  }, [unlockedKeys])

  useEffect(() => {
    if (selectedTracks.length === 0) return
    setCurrentTrackKey((prev) => {
      if (selectedTracks.some((track) => track.key === prev)) return prev
      return selectedTracks[0].key
    })
  }, [selectedTracks])

  useEffect(() => {
    localStorage.setItem('jukeboxSelection', JSON.stringify(selectedKeys))
  }, [selectedKeys])

  useEffect(() => {
    localStorage.setItem('musicVol', String(vol))
    const audio = audioRef.current
    if (audio && !audio.muted) audio.volume = vol
  }, [vol])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio

    const handleEnded = () => {
      setCurrentTrackKey((prevKey) => {
        const selection = selectionRef.current
        if (!selection || selection.length === 0) return prevKey
        const idx = selection.findIndex((track) => track.key === prevKey)
        if (idx === -1) return selection[0].key
        if (selection.length === 1) {
          audio.currentTime = 0
          if (playingRef.current) {
            audio.play().catch(() => setPlaying(false))
          }
          return selection[0].key
        }
        const next = selection[(idx + 1) % selection.length]
        return next.key
      })
    }

    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.src = ''
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    if (playing || autoplayAttemptedRef.current) return
    const audio = audioRef.current
    const track = currentTrack
    if (!audio || !track) return
    let cancelled = false
    ;(async () => {
      try {
        if (!audio.src) audio.src = track.src
        audio.loop = selectedTracks.length === 1
        audio.muted = true
        audio.volume = 0
        await audio.play()
        if (!cancelled) setAutoplayedMuted(true)
      } catch (error) {
        console.warn('Muted autoplay failed, waiting for user gesture', error)
        if (!cancelled) setAutoplayedMuted(true)
      } finally {
        if (!cancelled) autoplayAttemptedRef.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentTrack, playing, selectedTracks.length])

  useEffect(() => {
    const audio = audioRef.current
    const track = currentTrack
    if (!audio || !track) return
    const desired = absoluteSrc(track.src)
    if (audio.src !== desired) {
      audio.pause()
      audio.currentTime = 0
      audio.src = track.src
    }
    audio.loop = selectedTracks.length === 1
    if (playing) {
      audio.muted = false
      audio.volume = vol
      audio.play().catch(() => setPlaying(false))
    }
  }, [currentTrack, playing, selectedTracks.length, vol])

  useEffect(() => {
    if (!autoplayedMuted) return
    const unmute = async () => {
      const audio = audioRef.current
      const selection = selectionRef.current
      if (!audio || !selection || selection.length === 0) return
      try {
        audio.muted = false
        if (!audio.src) audio.src = selection[0].src
        audio.volume = 0
        await audio.play()
        const steps = 12
        const duration = 400
        for (let i = 1; i <= steps; i++) {
          await new Promise((resolve) => setTimeout(resolve, duration / steps))
          audio.volume = volRef.current * (i / steps)
        }
        setPlaying(true)
      } catch {
        // ignore
      } finally {
        setAutoplayedMuted(false)
      }
    }
    window.addEventListener('pointerdown', unmute, { once: true })
    window.addEventListener('keydown', unmute, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unmute)
      window.removeEventListener('keydown', unmute)
    }
  }, [autoplayedMuted])

  useEffect(() => {
    if (!jukeboxOpen) return
    const onClick = (event) => {
      if (jukeboxPanelRef.current?.contains(event.target)) return
      if (jukeboxBtnRef.current?.contains(event.target)) return
      setJukeboxOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setJukeboxOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [jukeboxOpen])

  const toggle = async () => {
    const audio = audioRef.current
    const selection = selectionRef.current
    if (!audio || !selection || selection.length === 0) return
    if (playing) {
      const start = audio.volume
      const steps = 10
      const duration = 200
      for (let i = 1; i <= steps; i++) {
        await new Promise((resolve) => setTimeout(resolve, duration / steps))
        audio.volume = Math.max(0, start * (1 - i / steps))
      }
      audio.pause()
      setPlaying(false)
    } else {
      try {
        const track = selection.find((t) => t.key === currentTrackKeyRef.current) || selection[0]
        if (!audio.src) audio.src = track.src
        audio.loop = selection.length === 1
        audio.muted = false
        audio.volume = volRef.current
        await audio.play()
        setPlaying(true)
        setAutoplayedMuted(false)
      } catch {
        // ignore
      }
    }
  }

  const toggleTrackSelection = (key) => {
    if (!unlockedKeys.includes(key)) return
    setSelectedKeys((prev) => {
      const has = prev.includes(key)
      if (has) {
        const remaining = prev.filter((k) => k !== key && unlockedKeys.includes(k))
        if (remaining.length === 0) return prev
        return remaining
      }
      const combined = [...prev, key]
      const ordered = TRACK_LIBRARY.map((track) => track.key).filter((k) => combined.includes(k))
      return ordered
    })
  }

  return (
    <div className="flex" style={{ gap: 8, alignItems: 'center', position: 'relative' }}>
      <button className="btn" onClick={toggle}>
        {playing ? 'Pause ♪' : 'Play ♪'}
      </button>
      <input
        className="input"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={vol}
        onChange={(e) => setVol(Number(e.target.value))}
        style={{ width: 120 }}
        aria-label="Music volume"
      />
      <div style={{ position: 'relative' }}>
        <button ref={jukeboxBtnRef} className="btn" onClick={() => setJukeboxOpen((open) => !open)}>
          Jukebox
        </button>
        {jukeboxOpen && (
          <div
            ref={jukeboxPanelRef}
            className="card"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 4px)',
              zIndex: 30,
              background: '#0f1429',
              border: '1px solid #2c3763',
              padding: 12,
              minWidth: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
          >
            <strong className="small" style={{ display: 'block', marginBottom: 8 }}>
              🎶 Jukebox
            </strong>
            <p className="small" style={{ marginBottom: 8 }}>
              Select which unlocked tracks should loop while you play.
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {availableTracks.map((track) => {
                const active = selectedKeys.includes(track.key)
                return (
                  <label key={track.key} className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleTrackSelection(track.key)}
                    />
                    <span>
                      {track.title}
                      {track.key === currentTrackKey ? ' • playing' : ''}
                    </span>
                  </label>
                )
              })}
            </div>
            {availableTracks.length === 0 && (
              <p className="small" style={{ marginTop: 8 }}>
                Unlock songs in Snake to expand your vibes!
              </p>
            )}
          </div>
        )}
      </div>
      {currentTrack && (
        <span className="small" style={{ opacity: 0.8 }}>
          Now playing: {currentTrack.title}
        </span>
      )}
      {autoplayedMuted && !playing && (
        <span className="small" style={{ marginLeft: 8, opacity: 0.8 }}>
          tap any key/click to unmute
        </span>
      )}
    </div>
  )
}
