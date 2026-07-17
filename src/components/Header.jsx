import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function Header() {
  const { db, prefs, toggleTheme, user, ui, setUi, notifOpen, setNotifOpen, t } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    function onDown(e) { if (profileWrapRef.current && !profileWrapRef.current.contains(e.target)) setProfileOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [profileOpen]);

  // Ferme le menu profil dès qu'on navigue ailleurs, pour éviter qu'il ne
  // reste ouvert (et refasse son animation d'ouverture) par-dessus la nouvelle page.
  useEffect(() => { setProfileOpen(false); }, [ui.view]);

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
        <div className="profile-menu-wrap" ref={profileWrapRef}>
          <Avatar m={user} size="a30" withPresence onClick={() => setProfileOpen(o => !o)} />
          {profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} />}
        </div>
      </div>
    </header>
  );
}
