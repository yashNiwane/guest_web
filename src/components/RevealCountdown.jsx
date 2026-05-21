import { useEffect, useMemo, useState } from 'react'

export default function RevealCountdown({ revealAt, revealed }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((revealAt.getTime() - now) / 1000)),
    [now, revealAt],
  )

  if (revealed || secondsLeft > 10) return null

  return (
    <div className="reveal-countdown" aria-live="polite">
      <p className="muted">Developing in</p>
      <strong>{secondsLeft}</strong>
      <p>Keep the room together. The film is almost ready.</p>
    </div>
  )
}
