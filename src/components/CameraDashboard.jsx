import { useMemo, useState } from 'react'
import { Camera, Image, Plus } from 'lucide-react'

export default function CameraDashboard({
  shotLimit,
  takenShots,
  onAddPhoto,
  revealAt,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)

  const remaining = shotLimit - takenShots
  const canShoot = remaining > 0 && !disabled

  if (disabled) return null

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
    onAddPhoto({ files, sourceType })
    setOpen(false)
    e.target.value = ''
  }

  return (
    <>
      <button
        className={`floating-add ${canShoot ? '' : 'disabled'}`}
        disabled={!canShoot}
        onClick={() => setOpen(true)}
      >
        <Plus size={22} />
        Add moment
      </button>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <p className="tiny">
              {remaining} left / {revealText}
            </p>
            <label className="sheet-action">
              <Camera size={22} />
              Use camera
              <input
                hidden
                disabled={!canShoot}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handlePick(e, 'guest_camera')}
              />
            </label>
            <label className="sheet-action">
              <Image size={22} />
              Choose from gallery
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
      )}
    </>
  )
}
