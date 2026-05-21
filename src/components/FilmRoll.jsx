export default function FilmRoll({ photos, revealed }) {
  return (
    <div className="card stack">
      <h2>{revealed ? 'Developed Gallery' : 'Mystery Film Roll'}</h2>
      <div className="grid">
        {photos.map((p) => (
          <div key={p.id} className="photo">
            <p><strong>{p.nickname}</strong> • {p.sourceType}</p>
            <p className="muted" style={{ marginTop: 6 }}>
              {revealed ? (p.caption || 'No caption') : 'Locked until reveal'}
            </p>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="muted">No uploads yet.</p>}
    </div>
  )
}
