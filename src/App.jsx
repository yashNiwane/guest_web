import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import JoinEvent from './components/JoinEvent'
import CameraDashboard from './components/CameraDashboard'
import FilmRoll from './components/FilmRoll'
import RevealCountdown from './components/RevealCountdown'
import DevelopedGallery from './components/DevelopedGallery'
import { photoBucket, supabase, supabaseConfigError } from './config/supabase'
import { useAnonymousAuth } from './hooks/useAnonymousAuth'
import {
  fakeStoragePath,
  parseEventIdFromCurrentUrl,
  parseEventIdFromLink,
} from './utils/event'
import { compressImage } from './utils/compressImage'

const DEFAULT_REVEAL_DELAY_MIN = 2
const EMPTY_REACTIONS = { heart: 0, fire: 0, laugh: 0, wow: 0, crown: 0 }

export default function App() {
  const [joined, setJoined] = useState(false)
  const [eventId, setEventId] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventTheme, setEventTheme] = useState('minimal')
  const [nickname, setNickname] = useState('')
  const [revealAt, setRevealAt] = useState(
    () => new Date(Date.now() + DEFAULT_REVEAL_DELAY_MIN * 60_000),
  )
  const [shotLimit, setShotLimit] = useState(8)
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [now, setNow] = useState(Date.now())
  const detectedEventId = useMemo(() => parseEventIdFromCurrentUrl(), [])

  const { ensureAnonymous, loading: authLoading } = useAnonymousAuth()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const revealed = useMemo(() => now >= revealAt.getTime(), [now, revealAt])

  useEffect(() => {
    if (!joined || !revealed) return
    confetti({
      particleCount: 90,
      spread: 72,
      origin: { y: 0.65 },
    })
    window.navigator.vibrate?.([80, 40, 120])
  }, [joined, revealed])

  useEffect(() => {
    if (joined && revealed && eventId) {
      loadPhotosForEvent(eventId, { shouldSignPhotos: true }).catch((err) => {
        console.error('Failed to refresh revealed photos', err)
      })
    }
  }, [joined, revealed, eventId])

  const headerText = useMemo(() => {
    if (!joined) return 'Join your Eve film'
    return revealed ? 'Your film developed' : 'Film is still developing'
  }, [joined, revealed])

  async function loadPhotosForEvent(
    targetEventId,
    { shouldSignPhotos, currentUserId = '', currentNickname = '' },
  ) {
    if (!supabase) return

    const { data: photoRows, error: photoError } = await supabase
      .from('photos')
      .select(
        'id, caption, source_type, storage_path, user_id, nickname_denormalized, file_size_bytes, created_at',
      )
      .eq('event_id', targetEventId)
      .order('created_at', { ascending: false })

    if (photoError) throw photoError

    const reactionCounts = await loadReactionCounts(photoRows || [])
    const signablePaths = (photoRows || [])
      .filter((photo) => shouldSignPhotos || photo.user_id === currentUserId)
      .map((photo) => photo.storage_path)
    const signedUrls = await signPhotoUrls(signablePaths)

    setPhotos(
      (photoRows || []).map((photo) => ({
        id: photo.id,
        userId: photo.user_id,
        sourceType: photo.source_type,
        caption: photo.caption || '',
        path: photo.storage_path,
        fileSizeBytes: photo.file_size_bytes || 0,
        signedUrl: signedUrls.get(photo.storage_path) || '',
        nickname:
          photo.nickname_denormalized ||
          (photo.user_id === currentUserId && currentNickname
            ? currentNickname
            : `Guest ${photo.user_id.slice(0, 4)}`),
        reactions: reactionCounts.get(photo.id) || { ...EMPTY_REACTIONS },
      })),
    )
  }

  async function loadReactionCounts(photoRows) {
    const photoIds = photoRows.map((photo) => photo.id)
    if (photoIds.length === 0) return new Map()

    const { data, error } = await supabase
      .from('reactions')
      .select('photo_id, reaction')
      .in('photo_id', photoIds)

    if (error) throw error

    return (data || []).reduce((counts, row) => {
      const photoCounts = counts.get(row.photo_id) || { ...EMPTY_REACTIONS }
      photoCounts[row.reaction] = (photoCounts[row.reaction] || 0) + 1
      counts.set(row.photo_id, photoCounts)
      return counts
    }, new Map())
  }

  async function signPhotoUrls(paths) {
    if (paths.length === 0) return new Map()

    const { data, error } = await supabase.storage
      .from(photoBucket)
      .createSignedUrls(paths, 60 * 60)

    if (error) throw error

    return new Map(
      (data || [])
        .filter((item) => item.signedUrl)
        .map((item) => [item.path, item.signedUrl]),
    )
  }

  async function handleJoin({ eventLink, nickname: nick, eventId: directEventId }) {
    const parsedEventId = directEventId || parseEventIdFromLink(eventLink)
    if (!parsedEventId || !nick) {
      alert('Please provide a valid invite link with event_id and nickname.')
      return
    }

    if (!supabase) {
      alert(supabaseConfigError)
      return
    }

    setBusy(true)
    try {
      const session = await ensureAnonymous()
      setCurrentUserId(session.user.id)

      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('id, name, theme, reveal_time, photo_limit, is_revealed')
        .eq('id', parsedEventId)
        .single()

      if (eventError) throw new Error(`Event not found: ${eventError.message}`)

      const { error: guestError } = await supabase.from('guests').upsert(
        {
          event_id: parsedEventId,
          user_id: session.user.id,
          nickname: nick,
        },
        { onConflict: 'event_id,user_id' },
      )
      if (guestError) throw guestError

      const nextRevealAt = new Date(eventRow.reveal_time)
      const nextRevealed =
        Boolean(eventRow.is_revealed) || Date.now() >= nextRevealAt.getTime()

      setEventId(parsedEventId)
      setEventName(eventRow.name || 'Untitled film')
      setEventTheme(eventRow.theme || 'minimal')
      setNickname(nick)
      setRevealAt(nextRevealed ? new Date(Date.now() - 1000) : nextRevealAt)
      setShotLimit(eventRow.photo_limit || 8)
      setJoined(true)
      loadPhotosForEvent(parsedEventId, {
        shouldSignPhotos: nextRevealed,
        currentUserId: session.user.id,
        currentNickname: nick,
      }).catch((err) => {
        console.error('Joined, but existing photos could not be loaded', err)
      })
    } catch (err) {
      alert(`Join failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function uploadOnePhoto({ file, sourceType, caption, session }) {
    const uploadFile = await compressImage(file)
    const path = fakeStoragePath(eventId, uploadFile.name || file.name)
    const { error: uploadError } = await supabase.storage
      .from(photoBucket)
      .upload(path, uploadFile, {
        cacheControl: '3600',
        contentType: uploadFile.type || file.type,
        upsert: false,
      })
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { error: insertError } = await supabase.from('photos').insert({
      event_id: eventId,
      user_id: session.user.id,
      storage_path: path,
      caption: caption || '',
      source_type: sourceType,
      nickname_denormalized: nickname,
      file_size_bytes: uploadFile.size,
    })
    if (insertError) {
      await supabase.storage.from(photoBucket).remove([path])
      throw new Error(`Photo save failed: ${insertError.message}`)
    }
  }

  async function handleAddPhoto({ files, file, sourceType, caption }) {
    if (!supabase || !eventId || revealed) return
    const selectedFiles = files || (file ? [file] : [])
    const remainingShots = Math.max(shotLimit - photos.length, 0)
    const uploadFiles = selectedFiles.slice(0, remainingShots)
    if (uploadFiles.length === 0) return

    setBusy(true)
    setUploadStatus(
      uploadFiles.length > 1 ? `Uploading 1 of ${uploadFiles.length}...` : 'Uploading photo...',
    )
    try {
      const session = await ensureAnonymous()
      for (const [index, uploadFile] of uploadFiles.entries()) {
        setUploadStatus(
          uploadFiles.length > 1
            ? `Uploading ${index + 1} of ${uploadFiles.length}...`
            : 'Uploading photo...',
        )
        await uploadOnePhoto({
          file: uploadFile,
          sourceType,
          caption: uploadFiles.length === 1 ? caption : '',
          session,
        })
      }

      await loadPhotosForEvent(eventId, {
        shouldSignPhotos: revealed,
        currentUserId: session.user.id,
        currentNickname: nickname,
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
      setUploadStatus('')
    }
  }

  async function react(photoId, key) {
    if (!revealed || !supabase) return
    try {
      const session = await ensureAnonymous()
      await supabase.from('reactions').upsert(
        {
          photo_id: photoId,
          user_id: session.user.id,
          reaction: key,
        },
        { onConflict: 'photo_id,user_id,reaction' },
      )
      await loadPhotosForEvent(eventId, {
        shouldSignPhotos: true,
        currentUserId: session.user.id,
        currentNickname: nickname,
      })
    } catch (err) {
      console.error('Reaction failed', err)
    }
  }

  async function editPhotoCaption(photo, caption) {
    if (!supabase || revealed || photo.userId !== currentUserId) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('photos')
        .update({ caption })
        .eq('id', photo.id)
      if (error) throw new Error(`Caption update failed: ${error.message}`)
      setSelectedPhoto(null)
      await loadPhotosForEvent(eventId, {
        shouldSignPhotos: revealed,
        currentUserId,
        currentNickname: nickname,
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deletePhoto(photo) {
    if (!supabase || revealed || photo.userId !== currentUserId) return
    if (!window.confirm('Delete this photo from the event?')) return
    setBusy(true)
    try {
      const { error } = await supabase.from('photos').delete().eq('id', photo.id)
      if (error) throw new Error(`Delete failed: ${error.message}`)
      await supabase.storage.from(photoBucket).remove([photo.path])
      setSelectedPhoto(null)
      await loadPhotosForEvent(eventId, {
        shouldSignPhotos: revealed,
        currentUserId,
        currentNickname: nickname,
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (supabaseConfigError) {
    return (
      <main className="page stack">
        <h1>Configuration needed</h1>
        <div className="card stack">
          <p className="muted">{supabaseConfigError}</p>
          <p className="muted">Current bucket: {photoBucket}</p>
        </div>
      </main>
    )
  }

  return (
    <main className={`page stack theme-${eventTheme}`}>
      <h1>{headerText}</h1>
      <p className="muted">
        Guests join by QR, capture the day, and see the album after reveal.
      </p>

      {!joined && (
        <JoinEvent
          onJoin={handleJoin}
          initialEventId={detectedEventId}
          busy={busy || authLoading}
        />
      )}

      {joined && (
        <>
          <div className="card stack">
            <p>
              <strong>{eventName}</strong>
            </p>
            <p>
              <strong>Nickname:</strong> {nickname}
            </p>
            <p className="muted">
              Anonymous auth: {authLoading ? 'Checking...' : 'Active'}
            </p>
            <p className="muted">{uploadStatus || (busy ? 'Syncing film...' : 'Film synced')}</p>
          </div>

          <CameraDashboard
            shotLimit={shotLimit}
            takenShots={photos.length}
            onAddPhoto={handleAddPhoto}
            revealAt={revealAt}
            disabled={busy || revealed}
          />

          <RevealCountdown revealAt={revealAt} revealed={revealed} />

          <FilmRoll
            photos={photos}
            revealed={revealed}
            currentUserId={currentUserId}
            onOpenPhoto={setSelectedPhoto}
          />
          <DevelopedGallery photos={photos} revealed={revealed} onReact={react} />
        </>
      )}

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          revealed={revealed}
          canManage={selectedPhoto.userId === currentUserId && !revealed}
          onClose={() => setSelectedPhoto(null)}
          onSaveCaption={editPhotoCaption}
          onDelete={deletePhoto}
        />
      )}
    </main>
  )
}

function PhotoModal({
  photo,
  revealed,
  canManage,
  onClose,
  onSaveCaption,
  onDelete,
}) {
  const [caption, setCaption] = useState(photo.caption || '')

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card stack">
        <div className="row">
          <button className="button secondary" onClick={onClose}>
            Close
          </button>
          {canManage && (
            <button className="button danger" onClick={() => onDelete(photo)}>
              Delete
            </button>
          )}
        </div>

        {photo.signedUrl ? (
          <img className="modal-image" src={photo.signedUrl} alt={photo.caption || 'Your event photo'} />
        ) : (
          <div className="locked-preview">
            {photo.caption || 'Photo locked until reveal'}
          </div>
        )}

        {canManage ? (
          <>
            <textarea
              className="input"
              rows="3"
              placeholder="Edit caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <button className="button primary" onClick={() => onSaveCaption(photo, caption.trim())}>
              Save Caption
            </button>
          </>
        ) : (
          <p className="muted">
            {revealed ? photo.caption || 'No caption' : 'You can manage your own shots until reveal.'}
          </p>
        )}
      </div>
    </div>
  )
}
