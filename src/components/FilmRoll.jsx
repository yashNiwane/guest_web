import { Check, Download, X } from 'lucide-react'
import { useRef, useState } from 'react'

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSourceType(sourceType) {
  if (sourceType === 'guest_camera') return 'Camera'
  if (sourceType === 'gallery') return 'Gallery'
  return sourceType || 'Moment'
}

export default function FilmRoll({
  photos,
  queuedMoments = [],
  revealed,
  currentUserId,
  onOpenPhoto,
  onRemoveQueuedMoment,
  selectedPhotoIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDownloadSelected,
  downloadingSelection = false,
}) {
  const longPressTimer = useRef(null)
  const longPressTriggered = useRef(false)
  const [pressingPhotoId, setPressingPhotoId] = useState('')
  const selectedCount = selectedPhotoIds.length
  const downloadableCount = photos.filter((photo) => photo.signedUrl).length
  const selectionMode = revealed && selectedCount > 0
  const selectionHint = revealed && downloadableCount > 0 && !selectionMode

  function startLongPress(photo) {
    if (!revealed || selectionMode) return
    window.clearTimeout(longPressTimer.current)
    longPressTriggered.current = false
    setPressingPhotoId(photo.id)
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      onToggleSelect?.(photo)
      setPressingPhotoId('')
      longPressTimer.current = null
    }, 420)
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current)
    setPressingPhotoId('')
    longPressTimer.current = null
  }

  function handlePhotoClick(photo) {
    const wasLongPress = longPressTriggered.current
    longPressTriggered.current = false
    cancelLongPress()
    if (wasLongPress) return
    if (selectionMode) {
      onToggleSelect?.(photo)
      return
    }
    onOpenPhoto?.(photo)
  }

  return (
    <section className="film-section stack">
      <div className="film-heading">
        <h2>{revealed ? 'Developed Gallery' : 'Mystery Film Roll'}</h2>
        {selectionMode && downloadableCount > 0 && (
          <button
            className="selection-link"
            onClick={selectedCount === downloadableCount ? onClearSelection : onSelectAll}
          >
            {selectedCount === downloadableCount ? 'Clear' : 'Select all'}
          </button>
        )}
      </div>
      {selectionMode && (
        <div className="selection-bar">
          <button className="selection-close" aria-label="Clear selection" onClick={onClearSelection}>
            <X size={16} />
          </button>
          <span>{selectedCount} selected</span>
          <button onClick={onDownloadSelected} disabled={downloadingSelection}>
            <Download size={16} />
            {downloadingSelection ? 'Preparing...' : 'Download'}
          </button>
        </div>
      )}
      {selectionHint && <p className="tiny">Long press a photo to select.</p>}
      <div className="grid">
        {queuedMoments.map((moment) => (
          <button
            key={moment.id}
            className={`photo queued ${moment.failed ? 'failed' : ''}`}
            onClick={() => moment.failed && onRemoveQueuedMoment?.(moment)}
          >
            <img className="photo-img no-margin" src={moment.previewUrl} alt="Queued moment" />
            <span className="photo-overlay">
              {moment.failed ? 'Tap to remove' : 'Backing up'}
            </span>
          </button>
        ))}
        {photos.map((p) => {
          const mine = p.userId === currentUserId
          const fileSize = formatFileSize(p.fileSizeBytes)
          const selected = selectedPhotoIds.includes(p.id)
          const pressing = pressingPhotoId === p.id
          return (
            <div
              key={p.id}
              className={`photo ${revealed ? 'developed selectable' : 'developing'} ${selected ? 'selected' : ''} ${selectionMode ? 'selection-mode' : ''} ${pressing ? 'pressing' : ''}`}
              onClick={() => handlePhotoClick(p)}
              onPointerDown={() => startLongPress(p)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(event) => {
                if (revealed) event.preventDefault()
              }}
            >
              {p.signedUrl && (
                <img
                  className={`photo-img ${revealed ? '' : 'private-preview'}`}
                  src={p.signedUrl}
                  alt="Event memory"
                />
              )}
              {!p.signedUrl && <div className="film-placeholder">developing...</div>}
              {selectionMode && (
                <button
                  className="select-check"
                  aria-label={selected ? 'Deselect photo' : 'Select photo'}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleSelect?.(p)
                  }}
                >
                  {selected && <Check size={15} />}
                </button>
              )}
              {fileSize && <p className="tiny">{fileSize}</p>}
              <div className="moment-footer">
                <span>
                  <strong>{p.nickname}</strong> / {formatSourceType(p.sourceType)}
                </span>
                {mine && !revealed && (
                  <button
                    className="moment-action"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenPhoto(p)
                    }}
                  >
                    Open
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {photos.length === 0 && queuedMoments.length === 0 && (
        <p className="muted">No moments yet.</p>
      )}
    </section>
  )
}
