export function parseEventIdFromLink(link) {
  try {
    const url = new URL(link)
    return url.searchParams.get('event_id') || ''
  } catch {
    return ''
  }
}

export function fakeStoragePath(eventId, fileName) {
  return `${eventId}/${Date.now()}-${fileName}`
}
