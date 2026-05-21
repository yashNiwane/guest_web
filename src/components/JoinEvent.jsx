import { useState } from 'react'

export default function JoinEvent({ onJoin, initialEventId = '', busy = false }) {
  const [eventLink, setEventLink] = useState(
    initialEventId ? `${window.location.origin}/?event_id=${initialEventId}` : '',
  )
  const [nickname, setNickname] = useState('')

  return (
    <div className="card stack">
      <h2>Join Event</h2>
      <p className="muted">
        {initialEventId
          ? 'Event detected from QR link. Enter your nickname to join.'
          : 'Paste your invite link, then enter your nickname.'}
      </p>
      {!initialEventId && (
        <input
          className="input"
          placeholder="https://your-domain/join?event_id=..."
          value={eventLink}
          onChange={(e) => setEventLink(e.target.value)}
        />
      )}
      <input
        className="input"
        placeholder="Your nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <button
        className="button primary"
        disabled={busy}
        onClick={() =>
          onJoin({
            eventLink: eventLink.trim(),
            nickname: nickname.trim(),
            eventId: initialEventId,
          })
        }
      >
        {busy ? 'Joining...' : 'Join Event'}
      </button>
    </div>
  )
}
