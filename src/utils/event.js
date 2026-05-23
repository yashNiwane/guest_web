export function parseEventIdFromLink(link) {
  const trimmed = link.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    return url.searchParams.get('event_id') || ''
  } catch {
    return ''
  }
}

export function parseEventIdFromCurrentUrl() {
  try {
    const current = new URL(window.location.href)
    const queryEventId = current.searchParams.get('event_id')
    if (queryEventId) return queryEventId

    const pathParts = current.pathname.split('/').filter(Boolean)
    const eventIndex = pathParts.findIndex((part) => part === 'event')
    if (eventIndex >= 0 && pathParts[eventIndex + 1]) {
      return pathParts[eventIndex + 1]
    }

    return ''
  } catch {
    return ''
  }
}

export function makePhotoStoragePath(eventId, userId, fileName) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${eventId}/${userId}/${Date.now()}-${safeName || 'photo.jpg'}`
}

export const guestMemoryKey = 'eve.guest_web.profile'
export const guestSessionKey = 'eve.guest_web.session'
export const guestProfilesKey = 'eve.guest_web.profiles'

export function saveGuestMemory({ eventId, nickname, userId }) {
  const profile = { eventId, nickname, userId: userId || '', savedAt: Date.now() }
  window.sessionStorage.setItem(guestSessionKey, JSON.stringify(profile))
  window.localStorage.setItem(guestMemoryKey, JSON.stringify(profile))
  saveGuestProfile(profile)
}

export function loadGuestMemory() {
  try {
    const raw =
      window.sessionStorage.getItem(guestSessionKey) ||
      window.localStorage.getItem(guestMemoryKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.eventId || !parsed?.nickname) return null
    return parsed
  } catch {
    return null
  }
}

export function clearGuestMemory() {
  window.sessionStorage.removeItem(guestSessionKey)
  window.localStorage.removeItem(guestMemoryKey)
}

export function loadGuestProfiles() {
  try {
    const raw = window.localStorage.getItem(guestProfilesKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => item.eventId && item.nickname) : []
  } catch {
    return []
  }
}

export function saveGuestProfile(profile) {
  const profiles = loadGuestProfiles()
  const next = [
    profile,
    ...profiles.filter(
      (item) =>
        item.eventId !== profile.eventId ||
        (profile.userId && item.userId !== profile.userId) ||
        (!profile.userId && item.nickname !== profile.nickname),
    ),
  ].slice(0, 8)
  window.localStorage.setItem(guestProfilesKey, JSON.stringify(next))
}
