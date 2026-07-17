import Icon from './Icon.jsx';
import { discussionUnreadTotal } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

const NAV_ITEMS = [
  { key: 'home',          icon: 'home',     label: 'home' },
  { key: 'projects',      icon: 'boards',   label: 'projects' },
  { key: 'messages',      icon: 'messages', label: 'messages', badge: discussionUnreadTotal },
  { key: 'files',         icon: 'files',    label: 'files' },
  { key: 'meet',          icon: 'meet',     label: 'meet' },
  { key: 'calendar',      icon: 'calendar', label: 'calendar' },
  { key: 'groups',        icon: 'groups',   label: 'groups' },
  { key: 'announcements', icon: 'announce', label: 'announcements' },
  { key: 'tutorial',      icon: 'grad',     label: 'tutorial' },
  { key: 'admin',         icon: 'admin',    label: 'admin', adminOnly: true },
];

export default function NavRail() {
  const { db, user, ui, go, t } = useApp();
  if (!user) return null;
  const items = NAV_ITEMS.filter(it =>
    (!it.adminOnly || user.role === 'ADMIN') &&
    (!user.allowedViews || user.allowedViews.includes(it.key))
  );
  return (
    <nav id="left-nav" className="left-nav" aria-label="Navigation principale">
      <img className="nav-logo" src={`${import.meta.env.BASE_URL}logo.jpeg`} alt="INCO LAB" onClick={() => go('home')} />
      {items.map(it => {
        const badge = it.badge ? it.badge(db) : 0;
        return (
          <button key={it.key} className={`nav-item${ui.view === it.key ? ' active' : ''}`} onClick={() => go(it.key)} title={t(it.label)}>
            <Icon name={it.icon} />
            <span className="nav-label">{t(it.label)}</span>
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
