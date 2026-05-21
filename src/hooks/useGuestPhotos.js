import { useMemo, useState } from 'react'

export function useGuestPhotos({ revealAt }) {
  const [photos, setPhotos] = useState([])

  const revealed = useMemo(() => Date.now() >= revealAt.getTime(), [revealAt])

  function addPhoto({ sourceType, caption, path, nickname }) {
    setPhotos((prev) => [
      {
        id: crypto.randomUUID(),
        sourceType,
        caption,
        path,
        nickname,
        createdAt: new Date().toISOString(),
        reactions: { heart: 0, fire: 0, laugh: 0, wow: 0, crown: 0 },
      },
      ...prev,
    ])
  }

  function react(photoId, key) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? { ...p, reactions: { ...p.reactions, [key]: (p.reactions[key] || 0) + 1 } }
          : p,
      ),
    )
  }

  return { photos, addPhoto, react, revealed }
}
