import { useState } from 'react'

export default function JoinEvent({ onJoin }) {
  const [eventLink, setEventLink] = useState('')
  const [nickname, setNickname] = useState('')

  return (
    <div className="card stack">
      <h2>Join Event</h2>
      <p className="muted">Paste your invite link, then enter your nickname.</p>
      <input
        className="input"
        placeholder="https://your-domain/join?event_id=..."
        value={eventLink}
        onChange={(e) => setEventLink(e.target.value)}
      />
      <input
        className="input"
        placeholder="Your nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <button
        className="button primary"
        onClick={() => onJoin({ eventLink: eventLink.trim(), nickname: nickname.trim() })}
      >
        Join Event
      </button>
    </div>
  )
}
