import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function Header() {
  const { db, prefs, toggleTheme, user, ui, setUi, go, notifOpen, setNotifOpen, t } = useApp();
  if (!user) return null;
  const unread = db.notifications.filter(n => !n.read).length;
  return (
    <header id="app-header" className="app-header">
      <div className="header-search">
        <Icon name="search" />
        <input
          id="global-search"
          placeholder={t('search')}
          value={ui.searchQuery}
          onChange={e => setUi({ searchQuery: e.target.value })}
        />
      </div>
      <div className="header-right">
        <button className="icon-btn" onClick={toggleTheme} title={t('theme')}>
          <Icon name={prefs.theme === 'light' ? 'moon' : 'sun'} />
        </button>
        <button className="icon-btn" onClick={() => setNotifOpen(o => !o)} title={t('notifications')}>
          <Icon name="bell" />
          {unread > 0 && <span className="dot" />}
        </button>
        <Avatar m={user} size="a30" withPresence onClick={() => go('profile')} />
      </div>
    </header>
  );
}
