import { useApp } from '../state/AppContext.jsx';
import MemberProfileModal from './MemberProfileModal.jsx';

export default function Avatar({ m, size = 'a30', withPresence = false, onClick, clickable = true }) {
  const { openModal } = useApp();

  function handleClick(e) {
    if (onClick) { onClick(e); return; }
    if (!clickable || !m?.id) return;
    e.stopPropagation();
    openModal(<MemberProfileModal memberId={m.id} />);
  }

  const isInteractive = !!(onClick || (clickable && m?.id));

  return (
    <span
      className={`avatar ${size}${isInteractive ? ' avatar-clickable' : ''}`}
      style={{ background: m.color }}
      title={m.name}
      onClick={isInteractive ? handleClick : undefined}
    >
      {m.initials}
      {withPresence && <span className={`presence ${m.presence || 'offline'}`} />}
    </span>
  );
}
