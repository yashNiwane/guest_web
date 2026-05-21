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
    return current.searchParams.get('event_id') || ''
  } catch {
    return ''
  }
}

export function fakeStoragePath(eventId, fileName) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${eventId}/${Date.now()}-${safeName || 'photo.jpg'}`
}
