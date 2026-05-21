export default function FilmRoll({ photos, revealed, currentUserId, onOpenPhoto }) {
  return (
    <div className="card stack">
      <h2>{revealed ? 'Developed Gallery' : 'Mystery Film Roll'}</h2>
      <div className="grid">
        {photos.map((p) => {
          const mine = p.userId === currentUserId
          return (
            <div key={p.id} className="photo">
              <p><strong>{p.nickname}</strong> • {p.sourceType}</p>
              {revealed && p.signedUrl && (
                <img className="photo-img" src={p.signedUrl} alt={p.caption || 'Event memory'} />
              )}
              <p className="muted" style={{ marginTop: 6 }}>
                {revealed || mine ? (p.caption || 'No caption') : 'Locked until reveal'}
              </p>
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
