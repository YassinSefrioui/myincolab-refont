export default function Avatar({ m, size = 'a30', withPresence = false }) {
  return (
    <span className={`avatar ${size}`} style={{ background: m.color }} title={m.name}>
      {m.initials}
      {withPresence && <span className={`presence ${m.presence || 'offline'}`} />}
    </span>
  );
}
