function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilmRoll({ photos, revealed, currentUserId, onOpenPhoto }) {
  return (
    <div className="card stack">
      <h2>{revealed ? 'Developed Gallery' : 'Mystery Film Roll'}</h2>
      <div className="grid">
        {photos.map((p) => {
          const mine = p.userId === currentUserId
          const fileSize = formatFileSize(p.fileSizeBytes)
          return (
            <div key={p.id} className={`photo ${revealed ? 'developed' : 'developing'}`}>
              <p><strong>{p.nickname}</strong> / {p.sourceType}</p>
              {p.signedUrl && (
                <img
                  className={`photo-img ${revealed ? '' : 'private-preview'}`}
                  src={p.signedUrl}
                  alt={p.caption || 'Event memory'}
                />
              )}
              {!p.signedUrl && <div className="film-placeholder">developing...</div>}
              <p className="muted" style={{ marginTop: 6 }}>
                {revealed || mine ? (p.caption || 'No caption') : 'Locked until reveal'}
              </p>
              {fileSize && <p className="tiny">{fileSize}</p>}
              {mine && !revealed && (
                <button className="chip wide" onClick={() => onOpenPhoto(p)}>
                  View / Edit
                </button>
              )}
            </div>
          )
        })}
      </div>
      {photos.length === 0 && <p className="muted">No uploads yet.</p>}
    </div>
  )
}
