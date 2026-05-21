import Reactions from './Reactions'

export default function DevelopedGallery({ photos, revealed, onReact }) {
  return (
    <div className="card stack">
      <h2>Everyone's Photos</h2>
      <div className="stack">
        {photos.map((p) => (
          <div key={p.id} className="photo stack">
            <p><strong>{p.nickname}</strong> • {p.sourceType}</p>
            {revealed && p.signedUrl && (
              <img className="photo-img large" src={p.signedUrl} alt={p.caption || 'Event memory'} />
            )}
            <p className="muted">{revealed ? (p.caption || 'No caption') : 'Hidden until reveal'}</p>
            <Reactions photo={p} enabled={revealed} onReact={onReact} />
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="muted">No photos yet.</p>}
    </div>
  )
}
