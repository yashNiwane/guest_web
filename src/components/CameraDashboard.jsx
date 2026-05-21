import { useMemo, useState } from 'react'

export default function CameraDashboard({
  shotLimit,
  takenShots,
  onAddPhoto,
  revealAt,
  disabled = false,
}) {
  const [caption, setCaption] = useState('')

  const remaining = shotLimit - takenShots
  const canShoot = remaining > 0 && !disabled

  const revealText = useMemo(() => {
    const diffMs = revealAt.getTime() - Date.now()
    if (diffMs <= 0) return 'Unlocked'
    const mins = Math.floor(diffMs / 60000)
    const secs = Math.floor((diffMs % 60000) / 1000)
    return `${mins}m ${secs}s`
  }, [revealAt, takenShots])

  function handlePick(e, sourceType) {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0 || !canShoot) return
    const files = selectedFiles.slice(0, remaining)
    onAddPhoto({ files, sourceType, caption })
    setCaption('')
    e.target.value = ''
  }

  return (
    <div className="card stack">
      <h2>Camera Dashboard</h2>
      <p className="muted">Shots left: {remaining} / Reveal in: {revealText}</p>
      <p className="muted">
        Snap opens the camera for one shot. Choose Gallery can upload several photos at once.
        Images are compressed before upload so slow networks feel less cursed.
      </p>
      <input
        className="input"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <div className="row">
        <label className={`button primary ${canShoot ? '' : 'disabled'}`} style={{ textAlign: 'center' }}>
          Snap Photo
          <input
            hidden
            disabled={!canShoot}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePick(e, 'camera')}
          />
        </label>
        <label className={`button secondary ${canShoot ? '' : 'disabled'}`} style={{ textAlign: 'center' }}>
          Choose Gallery
          <input
            hidden
            disabled={!canShoot}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handlePick(e, 'gallery')}
          />
        </label>
      </div>
    </div>
  )
}
