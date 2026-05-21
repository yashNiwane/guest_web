const reactionMap = [
  ['heart', '❤️'],
  ['fire', '🔥'],
  ['laugh', '😂'],
  ['wow', '😮'],
  ['crown', '👑'],
]

export default function Reactions({ photo, enabled, onReact }) {
  return (
    <div className="chips">
      {reactionMap.map(([key, emoji]) => (
        <button key={key} className="chip" disabled={!enabled} onClick={() => onReact(photo.id, key)}>
          {emoji} {photo.reactions[key] || 0}
        </button>
      ))}
    </div>
  )
}
