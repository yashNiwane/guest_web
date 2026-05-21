import { useMemo, useState } from 'react'
import JoinEvent from './components/JoinEvent'
import CameraDashboard from './components/CameraDashboard'
import FilmRoll from './components/FilmRoll'
import DevelopedGallery from './components/DevelopedGallery'
import { useAnonymousAuth } from './hooks/useAnonymousAuth'
import { useGuestPhotos } from './hooks/useGuestPhotos'
import { fakeStoragePath, parseEventIdFromLink } from './utils/event'

const SHOT_LIMIT = 8
const REVEAL_DELAY_MIN = 2

export default function App() {
  const [joined, setJoined] = useState(false)
  const [eventId, setEventId] = useState('')
  const [nickname, setNickname] = useState('')
  const [revealAt, setRevealAt] = useState(() => new Date(Date.now() + REVEAL_DELAY_MIN * 60_000))

  const { ensureAnonymous, loading: authLoading } = useAnonymousAuth()
  const { photos, addPhoto, react, revealed } = useGuestPhotos({ revealAt })

  const headerText = useMemo(() => {
    if (!joined) return 'Join your Eve event'
    return revealed ? 'Reveal unlocked' : 'Film is still developing'
  }, [joined, revealed])

  async function handleJoin({ eventLink, nickname: nick }) {
    const parsedEventId = parseEventIdFromLink(eventLink)
    if (!parsedEventId || !nick) {
      alert('Please provide a valid invite link with event_id and nickname.')
      return
    }

    try {
      await ensureAnonymous()
      setEventId(parsedEventId)
      setNickname(nick)
      setRevealAt(new Date(Date.now() + REVEAL_DELAY_MIN * 60_000))
      setJoined(true)
    } catch (err) {
      alert(`Join failed: ${err.message}`)
    }
  }

  async function handleAddPhoto({ file, sourceType, caption }) {
    const path = fakeStoragePath(eventId, file.name)
    addPhoto({ sourceType, caption, path, nickname })
  }

  return (
    <main className="page stack">
      <h1>{headerText}</h1>
      <p className="muted">Guest web experience for Eve.</p>

      {!joined && <JoinEvent onJoin={handleJoin} />}

      {joined && (
        <>
          <div className="card stack">
            <p><strong>Event ID:</strong> {eventId}</p>
            <p><strong>Nickname:</strong> {nickname}</p>
            <p className="muted">Anonymous auth: {authLoading ? 'Checking...' : 'Active'}</p>
          </div>

          <CameraDashboard
            shotLimit={SHOT_LIMIT}
            takenShots={photos.length}
            onAddPhoto={handleAddPhoto}
            revealAt={revealAt}
          />

          <FilmRoll photos={photos} revealed={revealed} />
          <DevelopedGallery photos={photos} revealed={revealed} onReact={react} />
        </>
      )}
    </main>
  )
}
