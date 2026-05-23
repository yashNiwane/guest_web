import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import JSZip from 'jszip'
import JoinEvent from './components/JoinEvent'
import CameraDashboard from './components/CameraDashboard'
import FilmRoll from './components/FilmRoll'
import RevealCountdown from './components/RevealCountdown'
import { Camera, Download, Image, LogOut, UserRound, UsersRound, X } from 'lucide-react'
import { coverBucket, photoBucket, supabase, supabaseConfigError } from './config/supabase'
import { useAnonymousAuth } from './hooks/useAnonymousAuth'
import {
  clearGuestMemory,
  loadGuestMemory,
  loadGuestProfiles,
  makePhotoStoragePath,
  parseEventIdFromCurrentUrl,
  parseEventIdFromLink,
  saveGuestMemory,
} from './utils/event'
import { compressImage } from './utils/compressImage'

const DEFAULT_REVEAL_DELAY_MIN = 2

export default function App() {
  const [joined, setJoined] = useState(false)
  const [eventId, setEventId] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventTheme, setEventTheme] = useState('minimal')
  const [coverUrl, setCoverUrl] = useState('')
  const [nickname, setNickname] = useState('')
  const [revealAt, setRevealAt] = useState(
    () => new Date(Date.now() + DEFAULT_REVEAL_DELAY_MIN * 60_000),
  )
  const [shotLimit, setShotLimit] = useState(8)
  const [photos, setPhotos] = useState([])
  const [queuedMoments, setQueuedMoments] = useState([])
  const [busy, setBusy] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [guestProfiles, setGuestProfiles] = useState(() => loadGuestProfiles())
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([])
  const [downloadingSelection, setDownloadingSelection] = useState(false)
  const [now, setNow] = useState(Date.now())
  const detectedEventId = useMemo(() => parseEventIdFromCurrentUrl(), [])

  const { ensureAnonymous, loading: authLoading } = useAnonymousAuth()

  useEffect(() => {
    if (supabaseConfigError || authLoading || joined) return
    const remembered = loadGuestMemory()
    const resumeEventId = detectedEventId || remembered?.eventId
    const resumeNickname = remembered?.nickname
    if (!resumeEventId || !resumeNickname) return
    handleJoin({
      eventLink: '',
      nickname: resumeNickname,
      eventId: resumeEventId,
      silent: true,
    })
  }, [authLoading, detectedEventId, joined])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const revealed = useMemo(() => now >= revealAt.getTime(), [now, revealAt])
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.includes(photo.id) && photo.signedUrl),
    [photos, selectedPhotoIds],
  )

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
      loadPhotosForEvent(eventId, {}).catch((err) => {
        console.error('Failed to refresh revealed photos', err)
      })
    }
  }, [joined, revealed, eventId])

  useEffect(() => {
    if (!joined || !eventId || !supabase) return

    const refreshEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('name, theme, reveal_time, photo_limit, is_revealed, cover_path')
          .eq('id', eventId)
          .single()
        if (error) throw error

        const nextRevealAt = new Date(data.reveal_time)
        const nextRevealed = Boolean(data.is_revealed) || Date.now() >= nextRevealAt.getTime()
        setEventName(data.name || 'Untitled film')
        setEventTheme(data.theme || 'minimal')
        setShotLimit(data.photo_limit || 8)
        setRevealAt(nextRevealed ? new Date(Date.now() - 1000) : nextRevealAt)
        setCoverUrl(await signCoverUrl(data.cover_path))
        if (nextRevealed) {
          await loadPhotosForEvent(eventId, { currentUserId, currentNickname: nickname })
        }
      } catch (err) {
        console.error('Event refresh failed', err)
      }
    }

    const timer = window.setInterval(refreshEvent, 15000)
    return () => window.clearInterval(timer)
  }, [joined, eventId, currentUserId, nickname])

  const headerText = useMemo(() => {
    if (!joined) return 'Join your Eve film'
    return revealed ? 'Your film developed' : 'Film is still developing'
  }, [joined, revealed])

  async function loadPhotosForEvent(targetEventId, { currentUserId = '', currentNickname = '' }) {
    if (!supabase) return

    const { data: photoRows, error: photoError } = await supabase
      .from('photos')
      .select(
        'id, source_type, storage_path, user_id, nickname_denormalized, file_size_bytes, created_at',
      )
      .eq('event_id', targetEventId)
      .order('created_at', { ascending: false })

    if (photoError) throw photoError

    const signablePaths = (photoRows || []).map((photo) => photo.storage_path)
    const signedUrls = await signPhotoUrls(signablePaths)

    setPhotos(
      (photoRows || []).map((photo) => ({
        id: photo.id,
        userId: photo.user_id,
        sourceType: photo.source_type,
        path: photo.storage_path,
        fileSizeBytes: photo.file_size_bytes || 0,
        signedUrl: signedUrls.get(photo.storage_path) || '',
        nickname:
          photo.nickname_denormalized ||
          (photo.user_id === currentUserId && currentNickname
            ? currentNickname
            : `Guest ${photo.user_id.slice(0, 4)}`),
      })),
    )
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

  async function handleJoin({ eventLink, nickname: nick, eventId: directEventId, silent = false }) {
    const parsedEventId = directEventId || parseEventIdFromLink(eventLink)
    if (!parsedEventId || !nick) {
      if (!silent) alert('Please provide a valid invite link with event_id and nickname.')
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
        .select('id, name, theme, reveal_time, photo_limit, is_revealed, cover_path')
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
      setCoverUrl(await signCoverUrl(eventRow.cover_path))
      setNickname(nick)
      setRevealAt(nextRevealed ? new Date(Date.now() - 1000) : nextRevealAt)
      setShotLimit(eventRow.photo_limit || 8)
      setJoined(true)
      saveGuestMemory({ eventId: parsedEventId, nickname: nick, userId: session.user.id })
      setGuestProfiles(loadGuestProfiles())
      loadPhotosForEvent(parsedEventId, {
        currentUserId: session.user.id,
        currentNickname: nick,
      }).catch((err) => {
        console.error('Joined, but existing photos could not be loaded', err)
      })
    } catch (err) {
      clearGuestMemory()
      if (!silent) alert(`Join failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function fetchPublicIpAddress() {
    try {
      const response = await fetch('https://api.ipify.org/?format=json', {
        signal: AbortSignal.timeout?.(3000),
      })
      if (!response.ok) return null
      const body = await response.json()
      return typeof body.ip === 'string' ? body.ip : null
    } catch {
      return null
    }
  }

  async function signCoverUrl(path) {
    if (!path) return ''
    const { data, error } = await supabase.storage
      .from(coverBucket)
      .createSignedUrl(path, 60 * 60)
    if (error) return ''
    return data?.signedUrl || ''
  }

  async function uploadOnePhoto({ file, sourceType, session }) {
    const uploadFile = await compressImage(file)
    const path = makePhotoStoragePath(eventId, session.user.id, uploadFile.name || file.name)
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

    const payload = {
      event_id: eventId,
      user_id: session.user.id,
      storage_path: path,
      source_type: sourceType,
      nickname_denormalized: nickname,
      file_size_bytes: uploadFile.size,
    }
    const capturedIp = await fetchPublicIpAddress()
    if (capturedIp) payload.captured_ip = capturedIp

    const { error: insertError } = await supabase.from('photos').insert(payload)
    if (insertError) {
      await supabase.storage.from(photoBucket).remove([path])
      throw new Error(`Photo save failed: ${insertError.message}`)
    }
  }

  async function handleAddPhoto({ files, file, sourceType }) {
    if (!supabase || !eventId || revealed) return
    const selectedFiles = files || (file ? [file] : [])
    const remainingShots = Math.max(shotLimit - photos.length - queuedMoments.length, 0)
    const uploadFiles = selectedFiles.slice(0, remainingShots)
    if (uploadFiles.length === 0) return

    uploadFiles.forEach((uploadFile, index) => {
      const queueItem = {
        id: crypto.randomUUID(),
        file: uploadFile,
        previewUrl: URL.createObjectURL(uploadFile),
        sourceType,
        failed: false,
      }
      setQueuedMoments((prev) => [queueItem, ...prev])
      backupQueuedMoment(queueItem, index)
    })
  }

  async function backupQueuedMoment(queueItem) {
    try {
      const session = await ensureAnonymous()
      await uploadOnePhoto({
        file: queueItem.file,
        sourceType: queueItem.sourceType,
        session,
      })
      URL.revokeObjectURL(queueItem.previewUrl)
      setQueuedMoments((prev) => prev.filter((item) => item.id !== queueItem.id))
      await loadPhotosForEvent(eventId, {
        currentUserId: session.user.id,
        currentNickname: nickname,
      })
    } catch (err) {
      console.error(err)
      setQueuedMoments((prev) =>
        prev.map((item) =>
          item.id === queueItem.id ? { ...item, failed: true, error: err.message } : item,
        ),
      )
    }
  }

  function removeQueuedMoment(queueItem) {
    URL.revokeObjectURL(queueItem.previewUrl)
    setQueuedMoments((prev) => prev.filter((item) => item.id !== queueItem.id))
  }

  async function leaveGuestView({ forget = false } = {}) {
    queuedMoments.forEach((moment) => URL.revokeObjectURL(moment.previewUrl))
    setQueuedMoments([])
    setPhotos([])
    setSelectedPhoto(null)
    setJoined(false)
    setEventId('')
    setEventName('')
    setCoverUrl('')
    setNickname('')
    setCurrentUserId('')
    if (forget) clearGuestMemory()
  }

  async function switchGuest() {
    await leaveGuestView({ forget: true })
    try {
      await supabase?.auth.signOut({ scope: 'local' })
    } catch (err) {
      console.error('Sign out failed', err)
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
        currentUserId,
        currentNickname: nickname,
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function downloadPhoto(photo) {
    if (!photo.signedUrl) return
    try {
      const response = await fetch(photo.signedUrl)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `eve-${photo.id}.jpg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      alert(err.message || 'Could not download photo.')
    }
  }

  function togglePhotoSelection(photo) {
    if (!revealed || !photo.signedUrl) return
    setSelectedPhotoIds((prev) =>
      prev.includes(photo.id)
        ? prev.filter((id) => id !== photo.id)
        : [...prev, photo.id],
    )
  }

  function selectAllPhotos() {
    setSelectedPhotoIds(photos.filter((photo) => photo.signedUrl).map((photo) => photo.id))
  }

  async function downloadSelectedPhotos() {
    if (selectedPhotos.length === 0 || downloadingSelection) return
    setDownloadingSelection(true)
    try {
      const zip = new JSZip()
      for (const [index, photo] of selectedPhotos.entries()) {
        const response = await fetch(photo.signedUrl)
        if (!response.ok) throw new Error(`Could not download image ${index + 1}`)
        const blob = await response.blob()
        zip.file(`eve-${index + 1}-${photo.id}.jpg`, blob)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${eventName || 'eve'}-moments.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      alert(err.message || 'Could not download selected photos.')
    } finally {
      setDownloadingSelection(false)
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
    <main className={`page theme-${eventTheme} ${joined ? 'guest-home' : 'join-home'}`}>
      {!joined && (
        <header className="join-header">
          <p className="eyebrow">Eve guest</p>
          <h1>{headerText}</h1>
          <p className="muted">Capture moments now. The gallery unlocks when the host reveals it.</p>
        </header>
      )}

      {!joined && (
        <JoinEvent
          onJoin={handleJoin}
          initialEventId={detectedEventId}
          busy={busy || authLoading}
          savedProfiles={guestProfiles}
        />
      )}

      {joined && (
        <>
          <header className="guest-topbar">
            <button
              className="icon-button"
              aria-label="Leave guest view"
              onClick={() => leaveGuestView()}
            >
              <X size={25} />
            </button>
            <div className="guest-session">
              <span>{nickname}</span>
              {guestProfiles.length > 1 && (
                <small>
                  <UsersRound size={13} />
                  {guestProfiles.length} guests saved
                </small>
              )}
            </div>
            <button className="icon-button" aria-label="Switch guest" onClick={switchGuest}>
              <LogOut size={22} />
            </button>
          </header>

          <section className="mobile-guest-hero">
            <div className="hero-copy">
              <h1>{eventName}</h1>
              <div className="guest-metrics">
                <span>
                  <Image size={16} />
                  {photos.length + queuedMoments.length} moments
                </span>
                <span>
                  <UserRound size={16} />
                  {revealed ? 'Unlocked' : timeStatus(revealAt)}
                </span>
              </div>
            </div>
            <div className="cover-tile">
              {coverUrl ? (
                <img src={coverUrl} alt="" />
              ) : (
                <div className="cover-placeholder">
                  <Camera size={34} />
                </div>
              )}
            </div>
          </section>

          <CameraDashboard
            shotLimit={shotLimit}
            takenShots={photos.length + queuedMoments.length}
            onAddPhoto={handleAddPhoto}
            revealAt={revealAt}
            disabled={busy || revealed}
          />

          <RevealCountdown revealAt={revealAt} revealed={revealed} />

          <FilmRoll
            photos={photos}
            queuedMoments={queuedMoments}
            revealed={revealed}
            currentUserId={currentUserId}
            onOpenPhoto={setSelectedPhoto}
            onRemoveQueuedMoment={removeQueuedMoment}
            selectedPhotoIds={selectedPhotoIds}
            onToggleSelect={togglePhotoSelection}
            onSelectAll={selectAllPhotos}
            onClearSelection={() => setSelectedPhotoIds([])}
            onDownloadSelected={downloadSelectedPhotos}
            downloadingSelection={downloadingSelection}
          />
        </>
      )}

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          revealed={revealed}
          canManage={selectedPhoto.userId === currentUserId && !revealed}
          onClose={() => setSelectedPhoto(null)}
          onDelete={deletePhoto}
          onDownload={downloadPhoto}
        />
      )}
    </main>
  )
}

function timeStatus(revealAt) {
  const remaining = revealAt.getTime() - Date.now()
  if (remaining <= 0) return 'Unlocking'
  const minutes = Math.floor(remaining / 60000)
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d left`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h left`
  return `${Math.max(1, minutes)}m left`
}

function PhotoModal({
  photo,
  revealed,
  canManage,
  onClose,
  onDelete,
  onDownload,
}) {
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
          <img className="modal-image" src={photo.signedUrl} alt="Your event moment" />
        ) : (
          <div className="locked-preview">Photo locked until reveal</div>
        )}

        {!canManage && (
          <p className="muted">
            {revealed ? 'Shared moment' : 'You can manage your own shots until reveal.'}
          </p>
        )}
        {photo.signedUrl && (
          <button className="button primary download-button" onClick={() => onDownload(photo)}>
            <Download size={18} />
            Download
          </button>
        )}
      </div>
    </div>
  )
}
