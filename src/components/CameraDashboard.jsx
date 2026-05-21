import { useMemo, useState } from 'react'

export default function CameraDashboard({ shotLimit, takenShots, onAddPhoto, revealAt }) {
  const [caption, setCaption] = useState('')

  const remaining = shotLimit - takenShots
  const canShoot = remaining > 0

  const revealText = useMemo(() => {
    const diffMs = revealAt.getTime() - Date.now()
    if (diffMs <= 0) return 'Unlocked'
    const mins = Math.floor(diffMs / 60000)
    const secs = Math.floor((diffMs % 60000) / 1000)
    return `${mins}m ${secs}s`
  }, [revealAt, takenShots])

  function handlePick(e, sourceType) {
    const file = e.target.files?.[0]
    if (!file || !canShoot) return
    onAddPhoto({ file, sourceType, caption })
    setCaption('')
    e.target.value = ''
  }

  return (
    <div className="card stack">
      <h2>Camera Dashboard</h2>
      <p className="muted">Shots left: {remaining} / Reveal in: {revealText}</p>
      <input
        className="input"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <div className="row">
        <label className="button primary" style={{ textAlign: 'center' }}>
          Snap Photo
          <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => handlePick(e, 'camera')} />
        </label>
        <label className="button secondary" style={{ textAlign: 'center' }}>
          Choose Gallery
          <input hidden type="file" accept="image/*" onChange={(e) => handlePick(e, 'gallery')} />
        </label>
      </div>
    </div>
  )
}
